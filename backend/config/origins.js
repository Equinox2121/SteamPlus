const CANONICAL_FRONTEND = "https://www.steamplus.xyz";
const DEFAULT_FRONTEND = process.env.FRONTEND_URL || CANONICAL_FRONTEND;

const ALLOWED_FRONTENDS = (
    process.env.ALLOWED_FRONTENDS ||
    [CANONICAL_FRONTEND, "https://steamplus.xyz", "http://localhost:5173"].join(",")
)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

if (!ALLOWED_FRONTENDS.includes(DEFAULT_FRONTEND)) {
    ALLOWED_FRONTENDS.push(DEFAULT_FRONTEND);
}

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

    return DEFAULT_FRONTEND;
}

const isProd = process.env.NODE_ENV === "production";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || (isProd ? ".steamplus.xyz" : undefined);

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
