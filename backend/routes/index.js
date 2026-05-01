const express = require("express");
const passport = require("passport");
const https = require("https");
const jwt = require("jsonwebtoken");
const pool = require("../config/database.js");
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // ***USE THIS FOR ANY ROUTES THAT REQUIRE AUTH
const {
    buildUserTasteProfile,
    computeCandidateStats,
    scoreCandidateForUser,
    rerankForDiversity,
    categorizeRecommendations,
    defaultDailySeed
} = require("../services/recommendationEngine");

const STEAM_API_KEY = process.env.STEAM_API_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// user status route
router.get("/user", async (req, res) => {
    const token = req.cookies?.token;
    let user = null;

    if (token) {
        try {
            user = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
        }
    }

    if (!user && req.user) {
        user = req.user;
    }

    if (user) {
        // user exists in DB?
        try {
            const userId = user.id;
            // check if userId is numeric or looks like a Steam ID string
            const isSteamId = typeof userId === 'string' && (userId.length > 15 || userId.includes('http'));
            
            let query = 'SELECT * FROM users WHERE id = ?';
            let queryParam = userId;

            if (isSteamId) {
                query = 'SELECT * FROM users WHERE steam_id = ?';
                if (typeof userId === 'string' && userId.includes('https://steamcommunity.com/openid/id/')) {
                    queryParam = userId.split('https://steamcommunity.com/openid/id/')[1];
                }
            }

            const [rows] = await pool.execute(query, [queryParam]);
            if (rows.length === 0) {
                // user no longer exists in db
                if (token) {
                    res.clearCookie('token', {
                        httpOnly: true,
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                        secure: process.env.NODE_ENV === 'production',
                    });
                }
                return res.json({ loggedIn: false });
            }
            
            const dbUser = rows[0];
            const username = dbUser.username || "Steam User";

            const avatarUser = req.user || user;
            const avatar = (avatarUser.photos && avatarUser.photos[2] && avatarUser.photos[2].value) ||
                (avatarUser._json && (avatarUser._json.avatarfull || avatarUser._json.avatarmedium || avatarUser._json.avatar)) ||
                avatarUser.avatar ||
                null;
            
            res.json({ loggedIn: true, username, avatar });
        } catch (dbError) {
            console.error("Database error in /user check:", dbError);
            res.json({ loggedIn: false });
        }
    } else {
        res.json({ loggedIn: false });
    }
});

// steam auth routes
router.get("/auth/steam", (req, res, next) => {
    console.log("AUTHENTICATING STEAM");
    passport.authenticate("steam", { failureRedirect: "/" })(req, res, next);
});

router.get("/auth/steam/return",
    passport.authenticate("steam", { failureRedirect: "/" }),
    async (req, res) => {
        const profile = req.user;
        let steamId = profile.id;
        if (steamId && typeof steamId === 'string' && steamId.includes('https://steamcommunity.com/openid/id/')) {
            steamId = steamId.split('https://steamcommunity.com/openid/id/')[1];
        }

        try {
            const [rows] = await pool.execute('SELECT * FROM users WHERE steam_id = ?', [steamId]);
            const user = rows[0];

            if (user) {
                // user already exists
                const avatar = (profile.photos && profile.photos[2] && profile.photos[2].value) ||
                    (profile._json && (profile._json.avatarfull || profile._json.avatarmedium || profile._json.avatar)) ||
                    null;
                const payload = {
                    id: user.id,
                    username: user.username,
                    steamid: user.steam_id,
                    avatar: avatar
                };
                const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
                res.cookie('token', token, {
                    httpOnly: true,
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                        secure: process.env.NODE_ENV === 'production',
                    maxAge: 60 * 60 * 1000
                });
                res.redirect(`${FRONTEND_URL}/home`);
            } else {
                // new user, redirect to username choice
                res.redirect(`${FRONTEND_URL}/complete-profile`);
            }
        } catch (error) {
            console.error('Error during Steam return:', error);
            res.redirect(`${FRONTEND_URL}/home`);
        }
    }
);

// logout route
router.post('/logout', (req, res) => {

    res.clearCookie('token', {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        secure: process.env.NODE_ENV === 'production',
    });

    req.logout(function(err) {
        if (err) {
            console.error("Passport logout error:", err);
        }

        req.session.destroy(() => {
            res.clearCookie("connect.sid");
            res.json({ ok: true });
        });
    });
});

// steam library route
router.get("/steam/library", (req, res) => {
    const token = req.cookies?.token;
    let user = null;

    if (token) {
        try {
            user = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            console.error("JWT verify error in library route:", error);
        }
    }

    if (!user && req.user) {
        user = req.user;
    }

    if (!user) {
        return res.status(401).json({ error: "no auth" });
    }

    // JWT: user.steamid
    let steamId = user.steamid || (user._json && (user._json.steamid || user._json.steamid64)) || user.id;

    if (steamId && typeof steamId === 'string' && steamId.includes('https://steamcommunity.com/openid/id/')) {
        steamId = steamId.split('https://steamcommunity.com/openid/id/')[1];
    }

    // steam ID 64 is a string of 17 digits
    const isActuallySteamId = steamId && typeof steamId === 'string' && steamId.length >= 15 && /^\d+$/.test(steamId);

    if (!isActuallySteamId) {
        return res.status(400).json({ error: "steamid not found or invalid" });
    }

    if (!STEAM_API_KEY) {
        console.error("STEAM_API_KEY is missing");
        return res.status(500).json({ error: "Steam API key not configured" });
    }

    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`;

    https.get(url, (apiRes) => {
        const { statusCode } = apiRes;
        const contentType = apiRes.headers['content-type'];

        let data = "";
        apiRes.on("data", (chunk) => (data += chunk));
        apiRes.on("end", () => {
            try {
                if (statusCode !== 200) {
                    console.error(`Steam API returned status code ${statusCode}`);
                    console.error(`Response data: ${data.substring(0, 500)}`);
                    return res.status(statusCode === 403 ? 403 : 502).json({ 
                        error: "Steam API error", 
                        message: `Steam returned status ${statusCode}` 
                    });
                }

                if (!contentType || !contentType.includes("application/json")) {
                    console.error(`Unexpected content-type: ${contentType}`);
                    console.error(`Response data: ${data.substring(0, 500)}`);
                    return res.status(502).json({ error: "Steam API returned non-JSON response" });
                }

                const parsed = JSON.parse(data);
                const games = (parsed && parsed.response && parsed.response.games) ? parsed.response.games : [];
                const simplified = games.map(g => ({
                    appid: g.appid,
                    name: g.name,
                    playtime_forever: g.playtime_forever,
                    header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`
                }));
                res.json({ games: simplified });
            } catch (e) {
                console.error("api error", e);
                res.status(500).json({ error: "steam parse failure" });
            }
        });
    }).on("error", (err) => {
        console.error("api error", err);
        res.status(502).json({ error: "cant get steam" });
    });
});

router.get("/steam/top-games", async (req, res) => {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), 200)
        : 50;

    try {
        const [rows] = await pool.execute(
            `
                SELECT app_id, name, owners, owners_estimate, players_2weeks, average_forever, median_forever, score_rank, header_image, updated_at
                FROM steam_top_games
                ORDER BY score_rank ASC
                LIMIT ?
            `,
            [limit]
        );

        return res.json({ games: rows });
    } catch (error) {
        console.error("Failed to load preloaded Steam top games:", error.message);
        return res.json({ games: [] });
    }
});


//friends feature route
async function fetchSteamJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (apiRes) => {
            const { statusCode } = apiRes;
            let data = "";
            apiRes.on("data", (chunk) => (data += chunk));
            apiRes.on("end", () => {
                try {
                    resolve({ statusCode, data: JSON.parse(data) });
                } catch (e) {
                    reject(e);
                }
            });
        }).on("error", reject);
    });
}


function getSteamPersonaState(state) {
    switch (state) {
        case 0:
            return 'Offline';
        case 1:
            return 'Online';
        case 2:
            return 'Busy';
        case 3:
            return 'Away';
        case 4:
            return 'Snooze';
        case 5:
            return 'Looking to trade';
        case 6:
            return 'Looking to play';
        default:
            return 'Unknown';
    }
}


router.get("/steam/friends-activity", async (req, res) => {
    const token = req.cookies?.token;
    let user = null;


    if (token) {
        try {
            user = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            console.error("JWT verify error in friends activity route:", error);
        }
    }


    if (!user && req.user) {
        user = req.user;
    }


    if (!user) {
        return res.status(401).json({ error: "no auth" });
    }


    let steamId = user.steamid || (user._json && (user._json.steamid || user._json.steamid64)) || user.id;
    if (steamId && typeof steamId === 'string' && steamId.includes('https://steamcommunity.com/openid/id/')) {
        steamId = steamId.split('https://steamcommunity.com/openid/id/')[1];
    }


    const isActuallySteamId = steamId && typeof steamId === 'string' && steamId.length >= 15 && /^\d+$/.test(steamId);
    if (!isActuallySteamId) {
        return res.status(400).json({ error: "steamid not found or invalid" });
    }


    if (!STEAM_API_KEY) {
        console.error("STEAM_API_KEY is missing");
        return res.status(500).json({ error: "Steam API key not configured" });
    }


    try {
        const friendsUrl = `https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&relationship=friend`;
        const friendsResp = await fetchSteamJson(friendsUrl);


        if (friendsResp.statusCode !== 200 || !friendsResp.data.friendslist?.friends) {
            return res.status(502).json({ error: "Unable to load Steam friends list" });
        }


        const friendIds = friendsResp.data.friendslist.friends
            .map((friend) => friend.steamid)
            .filter(Boolean)
            .slice(0, 12);


        if (friendIds.length === 0) {
            return res.json({ friends: [] });
        }


        const summariesUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${friendIds.join(',')}`;
        const summariesResp = await fetchSteamJson(summariesUrl);
        const players = summariesResp.data.response?.players || [];


        const friendActivities = await Promise.all(players.map(async (player) => {
            const recentUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${STEAM_API_KEY}&steamid=${player.steamid}&count=3`;
            let recentGames = [];
            try {
                const recentResp = await fetchSteamJson(recentUrl);
                recentGames = recentResp.data.response?.games || [];
            } catch (e) {
                console.error(`Failed loading recent games for ${player.steamid}:`, e.message);
                recentGames = [];
            }
            return {
                steamid: player.steamid,
                username: player.personaname || 'Steam Friend',
                avatar: player.avatarfull || player.avatarmedium || player.avatar || null,
                status: getSteamPersonaState(player.personastate),
                currentGame: player.gameextrainfo || null,
                recentGames: recentGames.map((game) => ({
                    appid: game.appid,
                    name: game.name,
                    playtime_2weeks: game.playtime_2weeks || 0,
                    playtime_forever: game.playtime_forever || 0,
                    header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`
                }))
            };
        }));


        res.json({ friends: friendActivities });
    } catch (error) {
        console.error("friends activity error", error);
        res.status(500).json({ error: "Failed to load friend activity" });
    }
});

// steam game details route
router.get("/steam/game/:appid", async (req, res) => {
    const { appid } = req.params;
    if (!appid) {
        return res.status(400).json({ error: "appid is required" });
    }

    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us`;

    https.get(url, async (apiRes) => {
        if (apiRes.statusCode !== 200) {
            console.error(`Steam API returned status ${apiRes.statusCode}`);
            return res.status(502).json({ error: "Steam API error", details: `Steam returned ${apiRes.statusCode}` });
        }
        let data = "";
        apiRes.on("data", (chunk) => (data += chunk));
        apiRes.on("end", async () => {
            try {
                const parsed = JSON.parse(data);
                if (parsed[appid] && parsed[appid].success) {
                    const gameData = parsed[appid].data;
                    
                    // fetch user tags from SteamSpy
                    const spyData = await fetchSteamSpy(appid);
                    if (spyData && spyData.tags) {
                        // get top 15 tags by vote count
                        const tags = Object.entries(spyData.tags)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 15)
                            .map(t => t[0]);
                        gameData.user_tags = tags;
                    }
                    
                    res.json(gameData);
                } else {
                    res.status(404).json({ error: "game not found or success: false from steam" });
                }
            } catch (e) {
                console.error("api error", e);
                res.status(500).json({ error: "steam parse failure" });
            }
        });
    }).on("error", (err) => {
        console.error("api error", err);
        res.status(502).json({ error: "cant get steam" });
    });
});

// cache for game details
const gameCache = {};
const steamSpyCache = {};

// helper to fetch from SteamSpy
async function fetchSteamSpy(appid) {
    if (steamSpyCache[appid]) return steamSpyCache[appid];

    const url = `https://steamspy.com/api.php?request=appdetails&appid=${appid}`;
    try {
        const data = await new Promise((resolve, reject) => {
            https.get(url, (apiRes) => {
                if (apiRes.statusCode !== 200) {
                    return resolve(null);
                }
                let d = "";
                apiRes.on("data", (chunk) => (d += chunk));
                apiRes.on("end", () => {
                    try {
                        resolve(JSON.parse(d));
                    } catch (e) {
                        resolve(null);
                    }
                });
            }).on("error", reject);
        });
        if (data && data.tags) {
            steamSpyCache[appid] = data;
            return data;
        }
    } catch (e) {
        console.error(`SteamSpy error for ${appid}:`, e.message);
    }
    return null;
}

async function fetchSteamSpyBatch(appIds, concurrency = 12) {
    const ids = [...new Set(
        (Array.isArray(appIds) ? appIds : [])
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value > 0)
    )];

    if (!ids.length) return new Map();

    const results = new Map();
    let cursor = 0;
    const workerCount = Math.max(1, Math.min(concurrency, ids.length));

    const workers = Array.from({ length: workerCount }, async () => {
        while (cursor < ids.length) {
            const index = cursor;
            cursor += 1;
            const appid = ids[index];

            try {
                const spy = await fetchSteamSpy(appid);
                if (spy && spy.tags) {
                    results.set(appid, spy);
                }
            } catch (error) {
                console.error(`SteamSpy batch fetch failed for ${appid}:`, error.message);
            }
        }
    });

    await Promise.all(workers);
    return results;
}

function buildRecommendationCard(row, reason = "Popular on Steam right now") {
    const gameId = Number(row.app_id);
    return {
        appid: gameId,
        name: row.name,
        header_image: row.header_image || `https://cdn.cloudflare.steamstatic.com/steam/apps/${gameId}/header.jpg`,
        price: "View on Steam",
        relevance: 0,
        confidence: 0,
        reason,
        signals: null,
        tags: []
    };
}

function buildRecommendationMeta(options = {}) {
    const {
        mode = "personalized",
        ownedGames = 0,
        profileGamesUsed = 0,
        profileTagCount = 0,
        candidatePool = 0,
        scoredCandidates = 0,
        limit = 12,
        seed = null,
        recommendations = []
    } = options;

    const cards = Array.isArray(recommendations) ? recommendations : [];
    const avgRelevance = cards.length
        ? Number((cards.reduce((sum, card) => sum + Number(card?.relevance || 0), 0) / cards.length).toFixed(2))
        : 0;
    const avgConfidence = cards.length
        ? Math.round(cards.reduce((sum, card) => sum + Number(card?.confidence || 0), 0) / cards.length)
        : 0;

    return {
        algorithm: "steam-owned-v3.0",
        mode,
        ownedGames,
        profileGamesUsed,
        profileTagCount,
        candidatePool,
        scoredCandidates,
        requestedLimit: limit,
        returned: cards.length,
        avgRelevance,
        avgConfidence,
        seed,
        generatedAt: new Date().toISOString()
    };
}

const parseTags = (raw) => {
    if (!raw) return null;
    if (typeof raw === "object") return raw;
    try { return JSON.parse(raw); } catch (e) { return null; }
};

function mergeRecommendations(primary, fallback, limit) {
    const merged = [];
    const seen = new Set();

    const addCandidate = (candidate) => {
        const appid = Number(candidate?.appid);
        if (!Number.isFinite(appid) || seen.has(appid)) return;
        seen.add(appid);
        merged.push(candidate);
    };

    (Array.isArray(primary) ? primary : []).forEach(addCandidate);
    (Array.isArray(fallback) ? fallback : []).forEach(addCandidate);

    return merged.slice(0, limit);
}




router.get("/steam/recommendations/owned", async (req, res) => {
    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), 24)
        : 12;

    const token = req.cookies?.token;
    let user = null;

    if (token) {
        try {
            user = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            console.error("JWT verify error in owned recommendations route:", error.message);
        }
    }

    if (!user && req.user) {
        user = req.user;
    }

    if (!user) {
        return res.status(401).json({ error: "no auth" });
    }

    let steamId = user.steamid || (user._json && (user._json.steamid || user._json.steamid64)) || user.id;
    if (steamId && typeof steamId === "string" && steamId.includes("https://steamcommunity.com/openid/id/")) {
        steamId = steamId.split("https://steamcommunity.com/openid/id/")[1];
    }

    const isActuallySteamId = steamId && typeof steamId === "string" && steamId.length >= 15 && /^\d+$/.test(steamId);
    if (!isActuallySteamId) {
        return res.status(400).json({ error: "steamid not found or invalid" });
    }

    if (!STEAM_API_KEY) {
        return res.status(500).json({ error: "Steam API key not configured" });
    }

    try {
        const seedParam = Number(req.query.seed);
        const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : defaultDailySeed();

        const ownedGamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&include_played_free_games=1&format=json`;
        const ownedResponse = await fetchSteamJson(ownedGamesUrl);
        const ownedGames = (ownedResponse.data && ownedResponse.data.response && ownedResponse.data.response.games) || [];

        const [topGamesRows] = await pool.execute(
            `
                SELECT app_id, name, owners_estimate, players_2weeks, average_forever, median_forever, score_rank, header_image, tags
                FROM steam_top_games
                ORDER BY score_rank ASC
                LIMIT 2000
            `
        );

        const dbTagsByAppId = new Map();
        for (const row of topGamesRows) {
            const tags = parseTags(row.tags);
            if (tags && typeof tags === "object") {
                dbTagsByAppId.set(Number(row.app_id), { name: row.name, tags });
            }
        }

        const ownedAppIds = new Set(ownedGames.map((g) => Number(g.appid)).filter((id) => Number.isFinite(id)));
        const nonOwnedRows = topGamesRows.filter((row) => !ownedAppIds.has(Number(row.app_id)));

        const fallbackRecommendations = nonOwnedRows
            .slice(0, limit)
            .map((row) => buildRecommendationCard(row, "Popular with Steam players"));

        if (!ownedGames.length) {
            return res.json({
                recommendations: fallbackRecommendations,
                categories: null,
                meta: buildRecommendationMeta({
                    mode: "fallback_no_owned_games",
                    ownedGames: 0,
                    candidatePool: nonOwnedRows.length,
                    limit,
                    seed,
                    recommendations: fallbackRecommendations
                })
            });
        }

        const profileGames = [...ownedGames]
            .sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0))
            .slice(0, 50);

        const candidatePool = nonOwnedRows.slice(0, 1000);

        const steamSpyMap = new Map();
        for (const [appId, entry] of dbTagsByAppId.entries()) {
            steamSpyMap.set(appId, entry);
        }
        const missingOwnedIds = profileGames
            .map((g) => Number(g.appid))
            .filter((id) => Number.isFinite(id) && !steamSpyMap.has(id));
        if (missingOwnedIds.length) {
            const fetched = await fetchSteamSpyBatch(missingOwnedIds, 8);
            for (const [appId, spy] of fetched.entries()) {
                if (spy?.tags) steamSpyMap.set(appId, spy);
            }
        }

        const userProfile = buildUserTasteProfile(profileGames, steamSpyMap, {
            maxGames: 50,
            profileTagLimit: 16
        });

        if (!userProfile.tagCount) {
            return res.json({
                recommendations: fallbackRecommendations,
                categories: null,
                meta: buildRecommendationMeta({
                    mode: "fallback_no_profile_tags",
                    ownedGames: ownedGames.length,
                    profileGamesUsed: userProfile.gamesUsed,
                    profileTagCount: userProfile.tagCount,
                    candidatePool: candidatePool.length,
                    limit,
                    seed,
                    recommendations: fallbackRecommendations
                })
            });
        }

        const candidateStats = computeCandidateStats(candidatePool);
        const scoredRecommendations = [];

        for (const row of candidatePool) {
            const gameId = Number(row.app_id);
            if (!Number.isFinite(gameId) || ownedAppIds.has(gameId)) continue;

            const spyData = steamSpyMap.get(gameId);
            if (!spyData?.tags) continue;

            const scored = scoreCandidateForUser({
                candidateRow: row,
                candidateSpy: spyData,
                userProfile,
                candidateStats,
                options: { candidateTagLimit: 10 }
            });

            if (scored) {
                scoredRecommendations.push(scored);
            }
        }


        const rankedRecommendations = rerankForDiversity(scoredRecommendations, limit, { lambda: 0.72, seed, noise: 0.14 })
            .map(({ _score, _tagSet, ...card }) => card);

        const recommendations = mergeRecommendations(rankedRecommendations, fallbackRecommendations, limit);


        const categories = categorizeRecommendations(scoredRecommendations, userProfile, { seed, perCategory: 6 });
        const cleanCategory = (items) => items.map(({ _score, _tagSet, ...card }) => card);
        const categorized = {
            topPicks: cleanCategory(categories.topPicks),
            becauseYouPlay: cleanCategory(categories.becauseYouPlay),
            trending: cleanCategory(categories.trending),
            deepDives: cleanCategory(categories.deepDives),
            discoveries: cleanCategory(categories.discoveries)
        };

        const candidatesWithDbTags = candidatePool.filter((r) => dbTagsByAppId.has(Number(r.app_id))).length;
        console.log("[owned-recs] debug:", {
            steamId,
            ownedGames: ownedGames.length,
            profileGamesUsed: userProfile.gamesUsed,
            profileTagCount: userProfile.tagCount,
            profileTopTags: userProfile.topTags,
            candidatePool: candidatePool.length,
            candidatesWithDbTags,
            dbTagsTotalRows: dbTagsByAppId.size,
            ownedFetchedFromSpy: missingOwnedIds.length,
            scoredCandidates: scoredRecommendations.length,
            rankedReturned: rankedRecommendations.length,
            categorySizes: {
                topPicks: categorized.topPicks.length,
                becauseYouPlay: categorized.becauseYouPlay.length,
                trending: categorized.trending.length,
                deepDives: categorized.deepDives.length,
                discoveries: categorized.discoveries.length
            },
            sampleScored: scoredRecommendations.slice(0, 3).map((c) => ({
                appid: c.appid,
                name: c.name,
                relevance: c.relevance,
                confidence: c.confidence,
                signals: c.signals,
                tags: c.tags
            }))
        });

        return res.json({
            recommendations,
            categories: categorized,
            meta: buildRecommendationMeta({
                mode: rankedRecommendations.length ? "personalized" : "fallback_merge",
                ownedGames: ownedGames.length,
                profileGamesUsed: userProfile.gamesUsed,
                profileTagCount: userProfile.tagCount,
                candidatePool: candidatePool.length,
                scoredCandidates: scoredRecommendations.length,
                limit,
                seed,
                recommendations
            })
        });
    } catch (error) {
        console.error("Owned recommendations error:", error.message);
        return res.status(500).json({ error: "failed to get owned recommendations" });
    }
});

router.get("/steam/recommendations/:appid", async (req, res) => {
    const { appid } = req.params;
    if (!appid) {
        return res.status(400).json({ error: "appid is required" });
    }

    try {
        const seedParam = Number(req.query.seed);
        const seed = Number.isFinite(seedParam) && seedParam > 0 ? seedParam : defaultDailySeed();


        const [currentRow] = await pool.execute(
            "SELECT app_id, name, header_image, tags, score_rank, owners_estimate, players_2weeks, average_forever, median_forever FROM steam_top_games WHERE app_id = ?",
            [Number(appid)]
        );

        let currentSpyData = null;
        if (currentRow.length > 0) {
            const row = currentRow[0];
            const tags = parseTags(row.tags);
            if (tags) {
                currentSpyData = { name: row.name, tags };
            }
        }

        if (!currentSpyData) {
            currentSpyData = await fetchSteamSpy(appid);
        }

        if (!currentSpyData || !currentSpyData.tags) {

            return res.json({ recommendations: [] });
        }


        const steamSpyMap = new Map();
        steamSpyMap.set(Number(appid), currentSpyData);
        
        const mockProfile = buildUserTasteProfile(
            [{ appid: Number(appid), playtime_forever: 100 }],
            steamSpyMap,
            { profileTagLimit: 24 }
        );


        const [topGamesRows] = await pool.execute(
            `
                SELECT app_id, name, owners_estimate, players_2weeks, average_forever, median_forever, score_rank, header_image, tags
                FROM steam_top_games
                WHERE app_id <> ?
                ORDER BY score_rank ASC
                LIMIT 1000
            `,
            [Number(appid)]
        );

        const candidateStats = computeCandidateStats(topGamesRows);
        const scoredRecommendations = [];

        for (const row of topGamesRows) {
            const tags = parseTags(row.tags);
            if (!tags) continue;

            const scored = scoreCandidateForUser({
                candidateRow: row,
                candidateSpy: { name: row.name, tags },
                userProfile: mockProfile,
                candidateStats,
                options: { candidateTagLimit: 12 }
            });

            if (scored) {
                scoredRecommendations.push(scored);
            }
        }


        const rankedRecommendations = rerankForDiversity(scoredRecommendations, 6, { 
            lambda: 0.62, 
            seed, 
            noise: 0.04 
        }).map(({ _score, _tagSet, ...card }) => card);

        res.json({ recommendations: rankedRecommendations });
    } catch (e) {
        console.error("recommendations error", e);
        res.status(500).json({ error: "failed to get recommendations" });
    }
});

// *** Implement better caching & less redundant calls to Steam API for production
// Basic user stats shown at top of profile (account level, recent playtime, total games owned, etc.) 
router.get("/steam/user-stats", authMiddleware, async (req, res) => {
    const user = req.user;
    let steamId = user.steamid || (user._json && user._json.steamid) || user.id;
    if (steamId.includes('openid/id/')) steamId = steamId.split('openid/id/')[1];

    try {
        const recentGamesUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}`;
        const steamLevelUrl = `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${STEAM_API_KEY}&steamid=${steamId}`;
        const ownedGamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&include_played_free_games=1`;

        const [recentRes, levelRes, ownedRes] = await Promise.all([
            fetch(recentGamesUrl).then(r => r.json()),
            fetch(steamLevelUrl).then(r => r.json()),
            fetch(ownedGamesUrl).then(r => r.json())
        ]);

        const recentGames = recentRes.response?.games || [];
        const totalRecentMinutes = recentGames.reduce((acc, g) => acc + g.playtime_2weeks, 0);

        res.json({
            steamLevel: levelRes.response?.player_level || 0,
            recentPlaytimeHrs: Math.round(totalRecentMinutes / 60),
            recentGamesCount: recentRes.response?.total_count || 0,
            totalGamesOwned: ownedRes.response?.game_count || 0,
        });
    } catch (e) {
        console.error("Steam API Error:", e);
        res.status(500).json({ error: "failed to fetch steam stats" });
    }
});

// *** Implement better caching & less redundant calls to Steam API for production
// Extended user stats dropdown (genre distribution, achievement completion rate, playtime trends, etc.)
router.get("/steam/user-extended-stats", authMiddleware, async (req, res) => {
    const user = req.user;

    let steamId = user.steamid || (user._json && user._json.steamid) || user.id;
    if (steamId.includes('openid/id/')) {
        steamId = steamId.split('openid/id/')[1];
    }

    try {
        const ownedUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1`;
        const ownedData = await fetch(ownedUrl).then(r => r.json());
        const games = ownedData.response?.games || [];

        const mostPlayed = games.reduce((max, g) => (!max || g.playtime_forever > max.playtime_forever) ? g : max, null);

        const totalMinutes = games.reduce((sum, g) => sum + g.playtime_forever, 0);
        const avgPlaytime = games.length > 0 ? Math.round((totalMinutes / games.length) / 60) : 0;

        const tagCounts = {};
        const limitedGames = games.slice(0, 30); // prevent rate explosion

        await Promise.all(limitedGames.map(async (g) => {
            const spy = await fetchSteamSpy(g.appid);
            if (spy?.tags) {
                Object.keys(spy.tags).forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        }));

        const topGenres = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(t => t[0]);

        let totalUnlocked = 0;
        let totalAchievements = 0;
        
        const sampleGames = games.slice(0, 20);

        await Promise.all(sampleGames.map(async (g) => {
            try {
                const url = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${g.appid}&key=${STEAM_API_KEY}&steamid=${steamId}`;
                const data = await fetch(url).then(r => r.json());

                if (data.playerstats?.success) {
                    const achs = data.playerstats.achievements || [];
                    totalAchievements += achs.length;
                    totalUnlocked += achs.filter(a => a.achieved === 1).length;
                }
            } catch {}
        }));

        res.json({
            totalAchievementsUnlocked: totalUnlocked,
            totalAchievements,
            topGenres,
            mostPlayed: mostPlayed ? {
                name: mostPlayed.name,
                hours: Math.round(mostPlayed.playtime_forever / 60)
            } : null,
            avgPlaytime,
        });

    } catch (e) {
        console.error("extended stats error:", e);
        res.status(500).json({ error: "failed extended stats" });
    }
});

// Cache for game stats
const gameStatsCache = {};

// *** Implement better caching & less redundant calls to Steam API for production
// Detailed Game Stats (Achievements + Game Stats (if available))
router.get("/steam/game-stats/:appid", authMiddleware, async (req, res) => {
    const { appid } = req.params;
    const user = req.user;

    let steamId = user.steamid || (user._json && user._json.steamid) || user.id;
    if (steamId.includes('openid/id/')) {
        steamId = steamId.split('openid/id/')[1];
    }

    const cacheKey = `${steamId}_${appid}`;
    if (gameStatsCache[cacheKey]) {
        return res.json(gameStatsCache[cacheKey]);
    }

    try {
        const userAchUrl = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid}&key=${STEAM_API_KEY}&steamid=${steamId}`;
        const globalAchUrl = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appid}`;
        const schemaUrl = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_API_KEY}&appid=${appid}`;
        const userStatsUrl = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=${appid}&key=${STEAM_API_KEY}&steamid=${steamId}`;

        const [userAchRes, globalAchRes, schemaRes, userStatsRes] = await Promise.allSettled([
            fetch(userAchUrl).then(r => r.json()),
            fetch(globalAchUrl).then(r => r.json()),
            fetch(schemaUrl).then(r => r.json()),
            fetch(userStatsUrl).then(r => r.json())
        ]);

        // Achievements
        let achievements = [];
        let unlockedCount = 0;
        let totalCount = 0;

        if (userAchRes.status === 'fulfilled' && userAchRes.value.playerstats?.success) {
            const uAchs = userAchRes.value.playerstats.achievements || [];
            const gAchs = globalAchRes.status === 'fulfilled'
                ? globalAchRes.value.achievementpercentages?.achievements || []
                : [];
            const schemaAchs = schemaRes.status === 'fulfilled'
                ? schemaRes.value.game?.availableGameStats?.achievements || []
                : [];

            achievements = uAchs.map(ua => {
                const meta = schemaAchs.find(s => s.name === ua.apiname);
                const ga = gAchs.find(g => g.name === ua.apiname);

                return {
                    name: meta?.displayName || ua.apiname,
                    description: meta?.description || "",
                    icon: meta?.icon || null,
                    unlocked: ua.achieved === 1,
                    rarity: ga ? parseFloat(ga.percent) : 0
                };
            });

            unlockedCount = uAchs.filter(a => a.achieved === 1).length;
            totalCount = uAchs.length;
        }

        // Debug logs
        // console.log("User Achievements:", userAchRes.value);
        // console.log("Schema:", schemaRes.value);
        // console.log("Global:", globalAchRes.value);

        // Custom Stats
        let customStats = [];
        if (userStatsRes.status === 'fulfilled' && userStatsRes.value.playerstats?.stats) {
            customStats = userStatsRes.value.playerstats.stats.map(s => ({
                label: s.name.replace(/_/g, ' '),
                value: s.value
            }));
        }

        const responseData = {
            appid,
            unlocked: unlockedCount,
            total: totalCount,
            percentage: totalCount > 0
                ? Math.round((unlockedCount / totalCount) * 100)
                : 0,
            achievements: achievements.sort((a, b) => a.rarity - b.rarity),
            customStats
        };

        // cache result
        gameStatsCache[cacheKey] = responseData;
        res.json(responseData);

    } catch (e) {
        console.error("Steam Stats Error:", e);
        res.status(500).json({ error: "Failed to fetch game statistics" });
    }
});

router.get("/", (req, res) => {
    res.redirect(`${FRONTEND_URL}/home`);
});

module.exports = router;