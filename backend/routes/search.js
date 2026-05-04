const express = require("express");
const router = express.Router();

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();

router.get("/steam/search", async (req, res) => {
    const q = (req.query.q || "").toString().trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 25);
    const cc = (req.query.cc || "us").toString().toLowerCase();

    if (q.length < 2) {
        return res.json({ query: q, results: [] });
    }

    const key = `${cc}|${limit}|${q.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
        return res.json(cached.value);
    }

    const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=english&cc=${cc}`;

    try {
        const r = await fetch(url, { headers: { Accept: "application/json" } });
        if (!r.ok) {
            return res.status(502).json({ error: `steam returned ${r.status}` });
        }
        const data = await r.json();
        const items = Array.isArray(data.items) ? data.items : [];

        const results = items.slice(0, limit).map((item) => ({
            appid: item.id,
            name: item.name,
            type: item.type || null,
            header_image: item.tiny_image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${item.id}/header.jpg`,
            price: item.price ? {
                initial: item.price.initial,
                final: item.price.final,
                discountPercent: item.price.discount_percent,
                currency: item.price.currency,
            } : null,
            metascore: item.metascore || null,
            platforms: item.platforms || null,
        }));

        const value = { query: q, results, total: items.length };
        cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        res.json(value);
    } catch (err) {
        console.error("steam search error:", err);
        res.status(502).json({ error: "search failed" });
    }
});

module.exports = router;
