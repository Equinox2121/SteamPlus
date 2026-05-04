const express = require("express");
const pool = require("../config/database.js");
const authMiddleware = require("../middleware/authMiddleware");
const { getTokenFromRequest, verifyToken } = require("../middleware/authMiddleware");

const router = express.Router();

const MAX_BODY_LENGTH = 4000;

const SUMMARY_CACHE_TTL_MS = 60 * 1000;
const summaryCache = new Map();

const tryGetUser = (req) => {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    return verifyToken(token);
};

router.get("/summary", async (req, res) => {
    const raw = (req.query.ids || "").toString();
    const ids = [...new Set(raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)))].slice(0, 50);
    if (ids.length === 0) return res.json({ summaries: {} });

    const result = {};
    const need = [];
    for (const id of ids) {
        const cached = summaryCache.get(id);
        if (cached && Date.now() < cached.expiresAt) {
            result[id] = cached.value;
        } else {
            need.push(id);
        }
    }

    if (need.length > 0) {
        try {
            const placeholders = need.map(() => "?").join(",");
            const [rows] = await pool.execute(
                `SELECT appid,
                        COUNT(*) AS total,
                        SUM(CASE WHEN recommended = 1 THEN 1 ELSE 0 END) AS positives
                 FROM reviews
                 WHERE appid IN (${placeholders})
                 GROUP BY appid`,
                need
            );
            const present = new Map();
            rows.forEach((r) => {
                const total = Number(r.total || 0);
                const positives = Number(r.positives || 0);
                const positivePercent = total > 0 ? Math.round((positives / total) * 100) : null;
                present.set(Number(r.appid), {
                    total,
                    positives,
                    negatives: total - positives,
                    positivePercent,
                    label: summaryLabel(total, positivePercent),
                });
            });
            need.forEach((id) => {
                const value = present.get(id) || { total: 0, positives: 0, negatives: 0, positivePercent: null, label: "No site reviews yet" };
                summaryCache.set(id, { value, expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS });
                result[id] = value;
            });
        } catch (err) {
            console.error("reviews summary error:", err);
            return res.status(500).json({ error: "failed to load review summaries" });
        }
    }

    res.json({ summaries: result });
});

router.get("/:appid", async (req, res) => {
    const appid = Number(req.params.appid);
    if (!Number.isFinite(appid)) return res.status(400).json({ error: "invalid appid" });

    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    try {
        const [aggRows] = await pool.execute(
            `SELECT COUNT(*) AS total,
                    SUM(CASE WHEN recommended = 1 THEN 1 ELSE 0 END) AS positives
             FROM reviews
             WHERE appid = ?`,
            [appid]
        );
        const total = Number(aggRows[0]?.total || 0);
        const positives = Number(aggRows[0]?.positives || 0);
        const positivePercent = total > 0 ? Math.round((positives / total) * 100) : null;

        const [rows] = await pool.execute(
            `SELECT r.id, r.recommended, r.body, r.created_at, r.updated_at,
                    u.id AS user_id, u.username
             FROM reviews r
             JOIN users u ON u.id = r.user_id
             WHERE r.appid = ?
             ORDER BY r.updated_at DESC
             LIMIT ${limit} OFFSET ${offset}`,
            [appid]
        );

        const reviews = rows.map((r) => ({
            id: r.id,
            recommended: !!r.recommended,
            body: r.body || "",
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            user: { id: r.user_id, username: r.username },
        }));

        const me = tryGetUser(req);
        let mine = null;
        if (me && me.id) {
            const [mineRows] = await pool.execute(
                `SELECT id, recommended, body, created_at, updated_at
                 FROM reviews WHERE user_id = ? AND appid = ?`,
                [me.id, appid]
            );
            if (mineRows.length > 0) {
                const r = mineRows[0];
                mine = {
                    id: r.id,
                    recommended: !!r.recommended,
                    body: r.body || "",
                    createdAt: r.created_at,
                    updatedAt: r.updated_at,
                };
            }
        }

        res.json({
            appid,
            summary: {
                total,
                positives,
                negatives: total - positives,
                positivePercent,
                label: summaryLabel(total, positivePercent),
            },
            reviews,
            mine,
        });
    } catch (err) {
        console.error("reviews list error:", err);
        res.status(500).json({ error: "failed to load reviews" });
    }
});

router.put("/:appid", authMiddleware, async (req, res) => {
    const appid = Number(req.params.appid);
    if (!Number.isFinite(appid)) return res.status(400).json({ error: "invalid appid" });

    const { recommended, body } = req.body || {};
    if (typeof recommended !== "boolean") {
        return res.status(400).json({ error: "recommended must be boolean" });
    }
    const trimmed = typeof body === "string" ? body.trim() : "";
    if (trimmed.length > MAX_BODY_LENGTH) {
        return res.status(400).json({ error: `review exceeds ${MAX_BODY_LENGTH} characters` });
    }

    try {
        await pool.execute(
            `INSERT INTO reviews (user_id, appid, recommended, body)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE recommended = VALUES(recommended), body = VALUES(body)`,
            [req.user.id, appid, recommended ? 1 : 0, trimmed || null]
        );
        summaryCache.delete(appid);

        const [rows] = await pool.execute(
            `SELECT id, recommended, body, created_at, updated_at
             FROM reviews WHERE user_id = ? AND appid = ?`,
            [req.user.id, appid]
        );
        const r = rows[0];
        res.json({
            id: r.id,
            recommended: !!r.recommended,
            body: r.body || "",
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        });
    } catch (err) {
        console.error("reviews upsert error:", err);
        res.status(500).json({ error: "failed to save review" });
    }
});

router.delete("/:appid", authMiddleware, async (req, res) => {
    const appid = Number(req.params.appid);
    if (!Number.isFinite(appid)) return res.status(400).json({ error: "invalid appid" });

    try {
        await pool.execute(
            `DELETE FROM reviews WHERE user_id = ? AND appid = ?`,
            [req.user.id, appid]
        );
        summaryCache.delete(appid);
        res.json({ ok: true });
    } catch (err) {
        console.error("reviews delete error:", err);
        res.status(500).json({ error: "failed to delete review" });
    }
});

function summaryLabel(total, positivePercent) {
    if (!total) return "No site reviews yet";
    if (positivePercent >= 95 && total >= 50) return "Overwhelmingly Positive";
    if (positivePercent >= 80) return "Very Positive";
    if (positivePercent >= 70) return "Mostly Positive";
    if (positivePercent >= 40) return "Mixed";
    if (positivePercent >= 20) return "Mostly Negative";
    if (positivePercent >= 5) return "Very Negative";
    return "Overwhelmingly Negative";
}

module.exports = router;
