const API_KEY = process.env.ITAD_API_KEY;
const BASE = "https://api.isthereanydeal.com";
const COUNTRY = process.env.ITAD_COUNTRY || "US";
const PROVIDER_DISABLED = process.env.DEALS_PROVIDER === "disabled" || !API_KEY;

const PAGE_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 60 * 1000;
const ID_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = Number(process.env.ITAD_FETCH_TIMEOUT_MS) || 8000;
const CAPACITY = Number(process.env.ITAD_CAPACITY) || 16;
const CIRCUIT_TRIP_FAILURES = Number(process.env.ITAD_CIRCUIT_TRIP) || 5;
const CIRCUIT_OPEN_MS = 15 * 60 * 1000;
const PRICES_BATCH_SIZE = 200;

const dealsCache = new Map();
const idCache = new Map();
const inflight = new Map();

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

const isFresh = (entry) => entry && Date.now() < entry.expiresAt;
const setCache = (cache, key, value, ttl) => cache.set(key, { value, expiresAt: Date.now() + ttl });

const fetchWithTimeout = async (url, opts = {}) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
        return await fetch(url, { ...opts, signal: ctrl.signal });
    } finally {
        clearTimeout(timer);
    }
};

const recordSuccess = () => { consecutiveFailures = 0; };
const recordFailure = (label) => {
    consecutiveFailures++;
    if (consecutiveFailures >= CIRCUIT_TRIP_FAILURES) {
        circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
        console.warn(`[itad] circuit opened after ${consecutiveFailures} failures (${label})`);
    }
};

const lookupItadId = async (steamAppId) => {
    const cached = idCache.get(steamAppId);
    if (isFresh(cached)) return cached.value;

    const url = `${BASE}/games/lookup/v1?key=${encodeURIComponent(API_KEY)}&appid=${steamAppId}`;
    try {
        const res = await fetchWithTimeout(url);
        if (!res.ok) {
            recordFailure(`lookup ${res.status}`);
            return null;
        }
        const data = await res.json();
        recordSuccess();
        if (!data.found || !data.game) {
            setCache(idCache, steamAppId, null, NEGATIVE_TTL_MS);
            return null;
        }
        setCache(idCache, steamAppId, data.game, ID_TTL_MS);
        return data.game;
    } catch (err) {
        recordFailure(`lookup err ${err.message}`);
        return null;
    }
};

const fetchPrices = async (itadIds) => {
    if (itadIds.length === 0) return [];
    const url = `${BASE}/games/prices/v3?key=${encodeURIComponent(API_KEY)}&country=${encodeURIComponent(COUNTRY)}&capacity=${CAPACITY}&nondeals=true&vouchers=true`;
    try {
        const res = await fetchWithTimeout(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(itadIds),
        });
        if (!res.ok) {
            recordFailure(`prices ${res.status}`);
            return null;
        }
        const data = await res.json();
        recordSuccess();
        return Array.isArray(data) ? data : [];
    } catch (err) {
        recordFailure(`prices err ${err.message}`);
        return null;
    }
};

const OFFICIAL_SHOPS = new Set([
    "Steam", "GOG", "GOG.COM", "Epic Game Store", "Humble Store",
    "Fanatical", "Green Man Gaming", "GamersGate", "Microsoft Store",
    "Ubisoft Store", "Ubisoft Connect", "EA App", "Origin",
    "Battle.net", "Blizzard", "Indiegala", "DLGamer", "WinGameStore",
    "AllYouPlay", "2Game", "Gamesplanet", "Gamesplanet UK", "Gamesplanet US",
    "Gamesplanet DE", "Voidu", "Nuuvem", "Direct2Drive", "GameBillet",
]);

const normalizeDeal = (d) => {
    const price = d.price?.amount ?? null;
    const original = d.regular?.amount ?? price;
    const discount = Number.isFinite(d.cut)
        ? Math.round(d.cut)
        : (original > 0 && price >= 0 && original > price
            ? Math.round((1 - price / original) * 100)
            : 0);
    const shopName = d.shop?.name || "Unknown";
    const drmList = Array.isArray(d.drm) ? d.drm.map((x) => x.name).filter(Boolean) : [];
    const platforms = Array.isArray(d.platforms) ? d.platforms.map((x) => x.name).filter(Boolean) : [];
    const activation = drmList.length ? drmList.join(", ") : (platforms.length ? platforms.join(", ") : null);
    const currency = d.price?.currency || "USD";
    return {
        id: `${d.shop?.id ?? "?"}-${d.url || shopName}-${price}`,
        merchantId: d.shop?.id ?? null,
        merchantName: shopName,
        merchantIcon: null,
        isOfficial: OFFICIAL_SHOPS.has(shopName),
        isFirstParty: shopName === "Steam",
        rating: null,
        reviewLink: null,
        edition: { id: "default", name: "Standard" },
        region: { id: COUNTRY, name: COUNTRY, shortDesc: null },
        price: Number(price ?? 0),
        originalPrice: Number(original ?? price ?? 0),
        discountPercent: discount,
        voucher: d.voucher ? { code: d.voucher, value: null, type: null } : null,
        availability: null,
        account: false,
        activationPlatform: activation,
        url: d.url || null,
        currency,
    };
};

const buildResponse = (game, deals) => {
    if (!Array.isArray(deals) || deals.length === 0) {
        return { available: false, reason: "no_deals" };
    }
    const offers = deals.map(normalizeDeal).filter((o) => o.url);
    if (offers.length === 0) {
        return { available: false, reason: "no_deals" };
    }
    return {
        available: true,
        slug: game?.slug || null,
        productId: game?.id || null,
        sourceUrl: game?.slug ? `https://isthereanydeal.com/game/${game.slug}/info/` : null,
        currency: offers[0]?.currency || "USD",
        editions: [{ id: "default", name: "Standard" }],
        offers,
        fetchedAt: new Date().toISOString(),
    };
};

const fetchAndCache = async (steamAppId, title) => {
    const game = await lookupItadId(steamAppId);
    if (!game) {
        const value = { available: false, reason: "not_found_on_itad" };
        setCache(dealsCache, steamAppId, value, NEGATIVE_TTL_MS);
        return value;
    }
    const pricesArr = await fetchPrices([game.id]);
    if (pricesArr === null) {
        return { available: false, reason: "provider_unreachable" };
    }
    const entry = pricesArr.find((p) => p.id === game.id) || pricesArr[0];
    const response = buildResponse(game, entry?.deals);
    const ttl = response.available ? PAGE_TTL_MS : NEGATIVE_TTL_MS;
    setCache(dealsCache, steamAppId, response, ttl);
    return response;
};

const getDealsFor = async (steamAppId, title) => {
    const id = Number(steamAppId);
    if (!Number.isFinite(id)) return { available: false, reason: "invalid_appid" };
    if (PROVIDER_DISABLED) return { available: false, reason: "provider_disabled" };

    const cached = dealsCache.get(id);
    if (isFresh(cached)) return cached.value;

    if (Date.now() < circuitOpenUntil) return { available: false, reason: "provider_unreachable" };

    if (inflight.has(id)) return inflight.get(id);

    const promise = fetchAndCache(id, title).finally(() => inflight.delete(id));
    inflight.set(id, promise);
    return promise;
};

const peekDealsFor = (steamAppId) => {
    const cached = dealsCache.get(Number(steamAppId));
    return isFresh(cached) ? cached.value : null;
};

const getDealsBatch = async (entries) => {
    const out = {};

    if (PROVIDER_DISABLED) {
        for (const { appid } of entries) out[appid] = { available: false, reason: "provider_disabled" };
        return out;
    }

    const needLookup = [];
    for (const { appid, title } of entries) {
        const id = Number(appid);
        if (!Number.isFinite(id)) {
            out[appid] = { available: false, reason: "invalid_appid" };
            continue;
        }
        const cached = dealsCache.get(id);
        if (isFresh(cached)) {
            out[id] = cached.value;
            continue;
        }
        needLookup.push({ appid: id, title });
    }
    if (needLookup.length === 0) return out;

    if (Date.now() < circuitOpenUntil) {
        for (const { appid } of needLookup) out[appid] = { available: false, reason: "provider_unreachable" };
        return out;
    }

    const games = await Promise.all(
        needLookup.map((e) => lookupItadId(e.appid).then((g) => ({ appid: e.appid, game: g })))
    );
    const validGames = games.filter((g) => g.game);
    for (const { appid, game } of games) {
        if (!game) {
            const value = { available: false, reason: "not_found_on_itad" };
            setCache(dealsCache, appid, value, NEGATIVE_TTL_MS);
            out[appid] = value;
        }
    }
    if (validGames.length === 0) return out;

    const itadIdToAppid = new Map();
    for (const { appid, game } of validGames) itadIdToAppid.set(game.id, appid);

    const allIds = validGames.map((g) => g.game.id);
    const byId = new Map();

    for (let i = 0; i < allIds.length; i += PRICES_BATCH_SIZE) {
        const slice = allIds.slice(i, i + PRICES_BATCH_SIZE);
        const arr = await fetchPrices(slice);
        if (arr === null) {
            for (const itadId of slice) {
                const appid = itadIdToAppid.get(itadId);
                out[appid] = { available: false, reason: "provider_unreachable" };
            }
            continue;
        }
        for (const entry of arr) byId.set(entry.id, entry);
    }

    for (const { appid, game } of validGames) {
        if (out[appid]) continue;
        const entry = byId.get(game.id);
        const response = buildResponse(game, entry?.deals);
        const ttl = response.available ? PAGE_TTL_MS : NEGATIVE_TTL_MS;
        setCache(dealsCache, appid, response, ttl);
        out[appid] = response;
    }

    return out;
};

const stats = () => ({
    cachedAppids: dealsCache.size,
    idMappings: idCache.size,
    inflightFetches: inflight.size,
    consecutiveFailures,
    circuitOpen: Date.now() < circuitOpenUntil,
    circuitOpenUntil: circuitOpenUntil > 0 ? new Date(circuitOpenUntil).toISOString() : null,
});

const probeReachability = async () => {
    if (PROVIDER_DISABLED) {
        console.log(`[itad] provider disabled${API_KEY ? "" : " (ITAD_API_KEY missing)"}`);
        circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
        return;
    }
    try {
        const res = await fetchWithTimeout(`${BASE}/service/shops/v1?country=${encodeURIComponent(COUNTRY)}`);
        if (res.ok) {
            console.log("[itad] reachability probe OK");
        } else {
            console.warn(`[itad] reachability probe returned ${res.status}; opening circuit`);
            circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
        }
    } catch (err) {
        console.warn(`[itad] reachability probe failed (${err.message}); opening circuit`);
        circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
    }
};

module.exports = {
    getDealsFor,
    getDealsBatch,
    peekDealsFor,
    stats,
    probeReachability,
};
