const BASE = "https://www.allkeyshop.com/blog";
const USER_AGENT = "SteamPlusBot/1.0 (+https://www.steamplus.xyz; school project)";
const PAGE_TTL_MS = 6 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 60 * 1000;
const SLUG_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = Number(process.env.AKS_FETCH_TIMEOUT_MS) || 6000;
const MAX_CONCURRENT_FETCHES = Number(process.env.AKS_MAX_CONCURRENT) || 2;
const RETRY_DELAYS_MS = [];
const CIRCUIT_TRIP_FAILURES = Number(process.env.AKS_CIRCUIT_TRIP) || 2;
const CIRCUIT_OPEN_MS = 60 * 60 * 1000;
const PROVIDER_DISABLED = process.env.DEALS_PROVIDER === "disabled";

const dealsCache = new Map();
const slugCache = new Map();
const inflight = new Map();

let activeFetches = 0;
const fetchQueue = [];
let consecutiveFailures = 0;
let circuitOpenUntil = 0;

const isFresh = (entry) => entry && Date.now() < entry.expiresAt;
const setCache = (cache, key, value, ttl) => cache.set(key, { value, expiresAt: Date.now() + ttl });

const stripPrefixes = [
    /^tom clancy'?s\s+/i,
    /^sid meier'?s\s+/i,
    /^american mcgee'?s\s+/i,
    /^warhammer\s+40,?000:\s+/i,
];

const slugify = (title) => {
    if (!title || typeof title !== "string") return "";
    return title
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/&/g, " and ")
        .replace(/['‘’‛ʼ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-+/g, "-");
};

const slugVariants = (title) => {
    if (!title) return [];
    const candidates = new Set();
    candidates.add(title);
    for (const re of stripPrefixes) {
        const stripped = title.replace(re, "");
        if (stripped && stripped !== title) candidates.add(stripped);
    }

    const out = new Set();
    for (const c of candidates) {
        const base = slugify(c);
        if (!base) continue;
        out.add(base);
        if (base.startsWith("the-")) out.add(base.slice(4));
        else out.add(`the-${base}`);
        out.add(base.replace(/-(\d{4})$/, "$1"));
        out.add(base.replace(/-edition$/, ""));
        out.add(base.replace(/-deluxe$/, ""));
        out.add(base.replace(/-remastered$/, ""));
        out.add(base.replace(/-remake$/, ""));
        out.add(base.replace(/-legacy$/, ""));
        out.add(base.replace(/-definitive-edition$/, ""));
        out.add(base.replace(/-goty$/, ""));
        out.add(base.replace(/:\s*/g, " "));
        const colonSplit = base.split("-");
        if (colonSplit.length > 4) out.add(colonSplit.slice(0, 4).join("-"));
    }
    return [...out].filter(Boolean);
};

const acquireSlot = () =>
    new Promise((resolve) => {
        if (activeFetches < MAX_CONCURRENT_FETCHES) {
            activeFetches++;
            resolve();
        } else {
            fetchQueue.push(resolve);
        }
    });

const releaseSlot = () => {
    activeFetches--;
    const next = fetchQueue.shift();
    if (next) {
        activeFetches++;
        next();
    }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchOnce = async (url) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "en-US,en;q=0.9",
            },
            signal: ctrl.signal,
            redirect: "follow",
        });
        if (!res.ok) return { status: res.status, html: null, url };
        const html = await res.text();
        return { status: 200, html, url: res.url || url };
    } catch (err) {
        return { status: 0, html: null, url, error: err.message };
    } finally {
        clearTimeout(timer);
    }
};

const fetchPage = async (slug) => {
    if (Date.now() < circuitOpenUntil) {
        return { status: 0, html: null, url: `${BASE}/buy-${slug}-cd-key-compare-prices/`, error: "circuit_open" };
    }
    const url = `${BASE}/buy-${slug}-cd-key-compare-prices/`;
    await acquireSlot();
    try {
        let res = await fetchOnce(url);
        for (const delay of RETRY_DELAYS_MS) {
            const transient = res.status === 0 || res.status === 429 || res.status === 503;
            if (!transient) break;
            await sleep(delay);
            res = await fetchOnce(url);
        }
        if (res.status === 200) {
            consecutiveFailures = 0;
        } else if (res.status === 0 || res.status === 429 || res.status === 503) {
            consecutiveFailures++;
            if (consecutiveFailures >= CIRCUIT_TRIP_FAILURES) {
                circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
                console.warn(`[allKeyShop] circuit opened after ${consecutiveFailures} failures; AKS unreachable for ${CIRCUIT_OPEN_MS / 60000}min`);
            }
        }
        return res;
    } finally {
        releaseSlot();
    }
};

const parseGamePageTrans = (html) => {
    if (!html) return null;
    const start = html.indexOf("gamePageTrans");
    if (start < 0) return null;
    const eq = html.indexOf("=", start);
    if (eq < 0) return null;
    let i = html.indexOf("{", eq);
    if (i < 0) return null;
    let depth = 0;
    let inStr = false;
    let escape = false;
    let strChar = "";
    for (let j = i; j < html.length; j++) {
        const c = html[j];
        if (escape) { escape = false; continue; }
        if (inStr) {
            if (c === "\\") { escape = true; continue; }
            if (c === strChar) { inStr = false; }
            continue;
        }
        if (c === "\"" || c === "'") { inStr = true; strChar = c; continue; }
        if (c === "{") depth++;
        else if (c === "}") {
            depth--;
            if (depth === 0) {
                const blob = html.slice(i, j + 1);
                try { return JSON.parse(blob); } catch { return null; }
            }
        }
    }
    return null;
};

const parseProductId = (html) => {
    const m = html.match(/productId\s*=\s*(\d+)/);
    return m ? Number(m[1]) : null;
};

const buildOfferUrl = (offer, currency) => {
    const cur = (currency || "usd").toLowerCase();
    return `https://www.allkeyshop.com/redirection/offer/${cur}/${offer.id}?locale=en&merchant=${offer.merchant}`;
};

const normalize = (data, currency) => {
    if (!data) return null;
    const merchants = data.merchants || {};
    const editions = data.editions || {};
    const regions = data.regions || {};
    const prices = Array.isArray(data.prices) ? data.prices : [];

    const allEditionIds = new Set(prices.map((p) => String(p.edition)));
    const editionList = [...allEditionIds].map((id) => ({
        id,
        name: editions[id]?.name || `Edition ${id}`,
    }));

    const offers = prices.map((p) => {
        const merchantMeta = merchants[String(p.merchant)] || {};
        const editionMeta = editions[String(p.edition)] || {};
        const regionMeta = regions[String(p.region)] || {};
        const discountPct = p.originalPrice > 0 && p.price > 0 && p.originalPrice > p.price
            ? Math.round((1 - p.price / p.originalPrice) * 100)
            : 0;
        return {
            id: p.id,
            merchantId: p.merchant,
            merchantName: p.merchantName || merchantMeta.name || "Unknown",
            merchantIcon: p.merchantIcon || merchantMeta.logo || null,
            isOfficial: !!p.isOfficial,
            isFirstParty: !!p.isFirstParty,
            rating: merchantMeta.rating ? {
                score: merchantMeta.rating.score,
                count: merchantMeta.rating.count,
                max: merchantMeta.rating.maximum,
            } : null,
            reviewLink: merchantMeta.review_link || null,
            edition: { id: String(p.edition), name: editionMeta.name || `Edition ${p.edition}` },
            region: {
                id: String(p.region),
                name: regionMeta.region_name || regionMeta.filter_name || null,
                shortDesc: regionMeta.region_short_description || null,
            },
            price: Number(p.price),
            originalPrice: Number(p.originalPrice),
            discountPercent: discountPct,
            voucher: p.voucher_code ? {
                code: p.voucher_code,
                value: p.voucher_discount_value,
                type: p.voucher_discount_type,
            } : null,
            availability: p.dispo,
            account: !!p.account,
            activationPlatform: p.activationPlatform || null,
            url: buildOfferUrl(p, currency),
        };
    });

    return {
        currency: currency || "USD",
        editions: editionList,
        offers,
    };
};

const searchAks = async (title) => {
    if (!title) return [];
    await acquireSlot();
    try {
        const url = `https://www.allkeyshop.com/blog/?s=${encodeURIComponent(title)}`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, "Accept": "text/html" },
            signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) return [];
        const html = await res.text();
        const re = /href="https:\/\/www\.allkeyshop\.com\/blog\/(?:en-[a-z]{2}\/)?buy-([a-z0-9-]+)-cd-key-compare-prices\/"/g;
        const slugs = new Set();
        let m;
        while ((m = re.exec(html)) !== null) slugs.add(m[1]);
        return [...slugs];
    } catch {
        return [];
    } finally {
        releaseSlot();
    }
};

const scoreSlugMatch = (slug, target) => {
    if (slug === target) return 100;
    if (slug.startsWith(target) || target.startsWith(slug)) return 80;
    const slugTokens = new Set(slug.split("-"));
    const targetTokens = target.split("-");
    const hits = targetTokens.filter((t) => slugTokens.has(t)).length;
    return Math.round((hits / Math.max(targetTokens.length, 1)) * 70);
};

const tryResolveSlug = async (steamAppId, title) => {
    const cached = slugCache.get(steamAppId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const variants = slugVariants(title);
    for (const slug of variants) {
        const page = await fetchPage(slug);
        if (page.status === 200 && page.html && page.html.includes("gamePageTrans")) {
            const productId = parseProductId(page.html);
            const result = { slug, productId, html: page.html, sourceUrl: page.url };
            setCache(slugCache, steamAppId, result, SLUG_TTL_MS);
            return result;
        }
    }

    if (title) {
        const candidates = await searchAks(title);
        const target = slugify(title);
        const ranked = candidates
            .map((slug) => ({ slug, score: scoreSlugMatch(slug, target) }))
            .filter((c) => c.score >= 50)
            .sort((a, b) => b.score - a.score);

        for (const cand of ranked.slice(0, 3)) {
            const page = await fetchPage(cand.slug);
            if (page.status === 200 && page.html && page.html.includes("gamePageTrans")) {
                const productId = parseProductId(page.html);
                const result = { slug: cand.slug, productId, html: page.html, sourceUrl: page.url };
                setCache(slugCache, steamAppId, result, SLUG_TTL_MS);
                return result;
            }
        }
    }

    setCache(slugCache, steamAppId, null, NEGATIVE_TTL_MS);
    return null;
};

const fetchAndCache = async (steamAppId, title) => {
    const resolved = await tryResolveSlug(steamAppId, title);
    if (!resolved) {
        const value = { available: false, reason: "not_found_on_aks" };
        setCache(dealsCache, steamAppId, value, NEGATIVE_TTL_MS);
        return value;
    }

    const data = parseGamePageTrans(resolved.html);
    if (!data) {
        const value = { available: false, reason: "parse_failed" };
        setCache(dealsCache, steamAppId, value, NEGATIVE_TTL_MS);
        return value;
    }

    const normalized = normalize(data, "USD");
    const value = {
        available: true,
        slug: resolved.slug,
        productId: resolved.productId,
        sourceUrl: resolved.sourceUrl,
        ...normalized,
        fetchedAt: new Date().toISOString(),
    };
    setCache(dealsCache, steamAppId, value, PAGE_TTL_MS);
    return value;
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
    await Promise.all(
        entries.map(async ({ appid, title }) => {
            try {
                out[appid] = await getDealsFor(appid, title);
            } catch (err) {
                out[appid] = { available: false, reason: err.message || "error" };
            }
        })
    );
    return out;
};

const stats = () => ({
    cachedAppids: dealsCache.size,
    slugMappings: slugCache.size,
    inflightFetches: inflight.size,
    activeFetches,
    queuedFetches: fetchQueue.length,
    consecutiveFailures,
    circuitOpen: Date.now() < circuitOpenUntil,
    circuitOpenUntil: circuitOpenUntil > 0 ? new Date(circuitOpenUntil).toISOString() : null,
});

const probeReachability = async () => {
    if (PROVIDER_DISABLED) {
        console.log("[allKeyShop] provider disabled via DEALS_PROVIDER=disabled");
        circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
        return;
    }
    const probeUrl = `${BASE}/buy-elden-ring-cd-key-compare-prices/`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
        const res = await fetch(probeUrl, {
            method: "HEAD",
            headers: { "User-Agent": USER_AGENT },
            signal: ctrl.signal,
            redirect: "follow",
        });
        if (res.ok) {
            console.log("[allKeyShop] reachability probe OK");
        } else {
            console.warn(`[allKeyShop] reachability probe returned ${res.status}; opening circuit`);
            circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
        }
    } catch (err) {
        console.warn(`[allKeyShop] reachability probe failed (${err.message}); opening circuit for ${CIRCUIT_OPEN_MS / 60000}min`);
        circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
    } finally {
        clearTimeout(timer);
    }
};

module.exports = {
    getDealsFor,
    getDealsBatch,
    peekDealsFor,
    stats,
    probeReachability,
    _internal: { slugify, slugVariants, parseGamePageTrans, parseProductId, normalize },
};
