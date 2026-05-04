const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const TOKEN_KEY = 'sp_jwt';
const CACHE_TTL_MS = 5 * 60 * 1000;

const gameCache = new Map();
const recsCache = new Map();
const dealsCache = new Map();
const searchCache = new Map();
const reviewSummaryCache = new Map();
const inflight = new Map();
const REVIEW_SUMMARY_TTL_MS = 60 * 1000;

const idle = (cb) => {
    if (typeof window === 'undefined') return;
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(cb, { timeout: 2000 });
    } else {
        setTimeout(cb, 200);
    }
};

const authHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const fresh = (entry) => entry && Date.now() - entry.ts < CACHE_TTL_MS;

const memoFetch = (key, url, store) => {
    const cached = store.get(key);
    if (fresh(cached)) return Promise.resolve(cached.value);
    if (inflight.has(key)) return inflight.get(key);

    const promise = fetch(url, { credentials: 'include', headers: authHeaders() })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((value) => {
            store.set(key, { value, ts: Date.now() });
            inflight.delete(key);
            return value;
        })
        .catch((err) => {
            inflight.delete(key);
            throw err;
        });

    inflight.set(key, promise);
    return promise;
};

export const prefetchGame = (appid) => {
    const id = Number(appid);
    if (!Number.isFinite(id)) return Promise.resolve(null);
    return memoFetch(`game:${id}`, `${BACKEND_URL}/steam/game/${id}`, gameCache).catch(() => null);
};

export const getCachedGame = (appid) => {
    const entry = gameCache.get(`game:${Number(appid)}`);
    return fresh(entry) ? entry.value : null;
};

export const prefetchSimilar = (appid) => {
    const id = Number(appid);
    if (!Number.isFinite(id)) return Promise.resolve(null);
    return memoFetch(`similar:${id}`, `${BACKEND_URL}/steam/recommendations/${id}`, recsCache).catch(() => null);
};

export const getCachedSimilar = (appid) => {
    const entry = recsCache.get(`similar:${Number(appid)}`);
    return fresh(entry) ? entry.value : null;
};

export const preloadImage = (src) => {
    if (!src || typeof window === 'undefined') return;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
};

export const idlePrefetchRoutes = (loaders) => {
    idle(() => {
        loaders.forEach((load) => {
            try { load(); } catch {}
        });
    });
};

export const warmBackend = () => {
    if (!BACKEND_URL) return;
    idle(() => {
        fetch(`${BACKEND_URL}/user`, { credentials: 'include', headers: authHeaders() }).catch(() => {});
    });
};

export const prefetchDeals = (appid, title) => {
    const id = Number(appid);
    if (!Number.isFinite(id)) return Promise.resolve(null);
    const url = title
        ? `${BACKEND_URL}/deals/${id}?title=${encodeURIComponent(title)}`
        : `${BACKEND_URL}/deals/${id}`;
    return memoFetch(`deals:${id}`, url, dealsCache).catch(() => null);
};

export const getCachedDeals = (appid) => {
    const entry = dealsCache.get(`deals:${Number(appid)}`);
    return fresh(entry) ? entry.value : null;
};

export const fetchReviewSummaries = async (appids) => {
    const ids = [...new Set(appids.map((n) => Number(n)).filter((n) => Number.isFinite(n)))];
    if (ids.length === 0) return {};

    const result = {};
    const need = [];
    const now = Date.now();
    for (const id of ids) {
        const cached = reviewSummaryCache.get(id);
        if (cached && now < cached.expiresAt) {
            result[id] = cached.value;
        } else {
            need.push(id);
        }
    }
    if (need.length === 0) return result;

    const key = `summary:${need.sort((a, b) => a - b).join(',')}`;
    let promise = inflight.get(key);
    if (!promise) {
        promise = fetch(`${BACKEND_URL}/reviews/summary?ids=${need.join(',')}`, {
            credentials: 'include',
            headers: authHeaders(),
        })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .finally(() => inflight.delete(key));
        inflight.set(key, promise);
    }

    try {
        const data = await promise;
        const summaries = (data && data.summaries) || {};
        need.forEach((id) => {
            const value = summaries[id] || summaries[String(id)] || { total: 0, positivePercent: null, label: 'No site reviews yet' };
            reviewSummaryCache.set(id, { value, expiresAt: Date.now() + REVIEW_SUMMARY_TTL_MS });
            result[id] = value;
        });
    } catch {
        need.forEach((id) => { result[id] = null; });
    }
    return result;
};

export const fetchReviews = (appid) => {
    const id = Number(appid);
    if (!Number.isFinite(id)) return Promise.resolve(null);
    return fetch(`${BACKEND_URL}/reviews/${id}`, { credentials: 'include', headers: authHeaders() })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))));
};

export const submitReview = (appid, payload) => {
    const id = Number(appid);
    if (!Number.isFinite(id)) return Promise.reject(new Error('invalid appid'));
    return fetch(`${BACKEND_URL}/reviews/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
    }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
    });
};

export const deleteReview = (appid) => {
    const id = Number(appid);
    if (!Number.isFinite(id)) return Promise.reject(new Error('invalid appid'));
    return fetch(`${BACKEND_URL}/reviews/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
    }).then(async (res) => {
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `HTTP ${res.status}`);
        }
        return { ok: true };
    });
};

export const searchSteam = (query, { limit = 12, signal } = {}) => {
    const q = (query || '').trim();
    if (q.length < 2) return Promise.resolve({ query: q, results: [] });
    const key = `search:${limit}:${q.toLowerCase()}`;
    const cached = searchCache.get(key);
    if (fresh(cached)) return Promise.resolve(cached.value);
    if (inflight.has(key)) return inflight.get(key);

    const url = `${BACKEND_URL}/steam/search?q=${encodeURIComponent(q)}&limit=${limit}`;
    const promise = fetch(url, { credentials: 'include', headers: authHeaders(), signal })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((value) => {
            searchCache.set(key, { value, ts: Date.now() });
            inflight.delete(key);
            return value;
        })
        .catch((err) => {
            inflight.delete(key);
            throw err;
        });

    inflight.set(key, promise);
    return promise;
};
