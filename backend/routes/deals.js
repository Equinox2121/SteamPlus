const express = require("express");
const aks = require("../services/allKeyShop");
const warmer = require("../services/dealsWarmer");

const router = express.Router();

router.get("/health", (req, res) => {
    res.json({ provider: "allkeyshop", ...aks.stats() });
});

router.get("/by-steam-app-ids", async (req, res) => {
    const raw = (req.query.ids || "").toString();
    const titlesRaw = (req.query.titles || "").toString();
    const ids = raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)).slice(0, 25);
    if (ids.length === 0) return res.status(400).json({ error: "ids query parameter required" });

    const titles = titlesRaw.split("|").map((t) => t.trim());
    const peeked = {};
    const need = [];
    ids.forEach((id, idx) => {
        const cached = aks.peekDealsFor(id);
        if (cached) {
            peeked[id] = cached;
        } else {
            need.push({ appid: id, title: titles[idx] || null });
        }
    });

    const fresh = await aks.getDealsBatch(need);
    const result = { ...peeked, ...fresh };

    res.json({ deals: result });
});

router.get("/:appid", async (req, res) => {
    const appid = Number(req.params.appid);
    if (!Number.isFinite(appid)) return res.status(400).json({ error: "invalid appid" });
    const title = (req.query.title || "").toString();
    const data = await aks.getDealsFor(appid, title);
    res.json({ appid, ...data });
});

router.post("/warm", express.json(), async (req, res) => {
    const entries = Array.isArray(req.body?.games) ? req.body.games.slice(0, 50) : [];
    if (entries.length === 0) return res.status(400).json({ error: "games array required" });
    const result = await warmer.warmExplicit(entries);
    res.json(result);
});

module.exports = router;
