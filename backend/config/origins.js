const CANONICAL_FRONTEND = "https://www.steamplus.xyz";
const FALLBACK_FRONTENDS = [CANONICAL_FRONTEND, "https://steamplus.xyz", "http://localhost:5173"];
const isProd = process.env.NODE_ENV === "production";

const DEFAULT_FRONTEND = process.env.FRONTEND_URL || (isProd ? CANONICAL_FRONTEND : "http://localhost:5173");

const ALLOWED_FRONTENDS = (
    process.env.ALLOWED_FRONTENDS || FALLBACK_FRONTENDS.join(",")
)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

if (!ALLOWED_FRONTENDS.includes(DEFAULT_FRONTEND)) ALLOWED_FRONTENDS.push(DEFAULT_FRONTEND);
if (!ALLOWED_FRONTENDS.includes(CANONICAL_FRONTEND)) ALLOWED_FRONTENDS.push(CANONICAL_FRONTEND);

function normalizeOrigin(value) {
    if (!value) return null;
    try {
        const u = new URL(value);
        return `${u.protocol}//${u.host}`;
    } catch {
        return null;
    }
}

function isAllowedOrigin(origin) {
    const normalized = normalizeOrigin(origin);
    return !!normalized && ALLOWED_FRONTENDS.includes(normalized);
}

function pickFrontend(req) {
    const fromSession = req && req.session && req.session.return_to;
    if (isAllowedOrigin(fromSession)) return normalizeOrigin(fromSession);

    const fromQuery = req && req.query && req.query.return_to;
    if (isAllowedOrigin(fromQuery)) return normalizeOrigin(fromQuery);

    const fromReferer = req && req.get && req.get("referer");
    const refererOrigin = normalizeOrigin(fromReferer);
    if (refererOrigin && isAllowedOrigin(refererOrigin)) return refererOrigin;

    if (isProd) return CANONICAL_FRONTEND;
    return DEFAULT_FRONTEND;
}

function backendIsOnSharedSite() {
    try {
        const host = new URL(process.env.BACKEND_URL || "").host.toLowerCase();
        return host === "steamplus.xyz" || host.endsWith(".steamplus.xyz");
    } catch {
        return false;
    }
}

const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN
    || (isProd && backendIsOnSharedSite() ? ".steamplus.xyz" : undefined);

function authCookieOptions(extra = {}) {
    return {
        httpOnly: true,
        sameSite: isProd ? "none" : "strict",
        secure: isProd,
        ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
        ...extra,
    };
}

module.exports = {
    CANONICAL_FRONTEND,
    DEFAULT_FRONTEND,
    ALLOWED_FRONTENDS,
    isAllowedOrigin,
    normalizeOrigin,
    pickFrontend,
    authCookieOptions,
    COOKIE_DOMAIN,
};
