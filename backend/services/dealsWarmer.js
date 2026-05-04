const pool = require("../config/database");
const aks = require("./allKeyShop");

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const WARM_LIMIT = 30;
const REFRESH_LIMIT = 60;
const INITIAL_DELAY_MS = 5000;

let refreshTimer = null;

const fetchTopGames = async (limit) => {
    try {
        const [rows] = await pool.execute(
            `SELECT app_id, name FROM steam_top_games WHERE name IS NOT NULL ORDER BY score_rank ASC LIMIT ?`,
            [limit]
        );
        return rows.map((r) => ({ appid: Number(r.app_id), title: r.name })).filter((e) => Number.isFinite(e.appid) && e.title);
    } catch (err) {
        console.error("[dealsWarmer] DB query failed:", err.message);
        return [];
    }
};

const warmFromList = async (entries) => {
    const valid = entries.filter((e) => e.appid && e.title);
    if (valid.length === 0) return { warmed: 0, total: 0 };
    console.log(`[dealsWarmer] warming ${valid.length} games...`);
    const t0 = Date.now();
    const results = await aks.getDealsBatch(valid);
    let ok = 0;
    for (const id of Object.keys(results)) {
        if (results[id]?.available) ok++;
    }
    console.log(`[dealsWarmer] warmed ${ok}/${valid.length} in ${Date.now() - t0}ms (${aks.stats().cachedAppids} total cached)`);
    return { warmed: ok, total: valid.length };
};

const refresh = async () => {
    const top = await fetchTopGames(REFRESH_LIMIT);
    if (top.length === 0) return;
    await warmFromList(top);
};

const start = async () => {
    setTimeout(async () => {
        try {
            const top = await fetchTopGames(WARM_LIMIT);
            if (top.length === 0) {
                console.log("[dealsWarmer] no top-games in DB; skipping initial warm");
                return;
            }
            await warmFromList(top);
        } catch (err) {
            console.error("[dealsWarmer] initial warm failed:", err.message);
        }
    }, INITIAL_DELAY_MS);

    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
        refresh().catch((err) => console.error("[dealsWarmer] refresh failed:", err.message));
    }, REFRESH_INTERVAL_MS);
};

const warmExplicit = async (entries) => warmFromList(entries);

module.exports = { start, refresh, warmExplicit };
