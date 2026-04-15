const express = require("express");
const passport = require("passport");
const https = require("https");
const jwt = require("jsonwebtoken");
const pool = require("../config/database.js");
const router = express.Router();

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
                        sameSite: 'strict',
                        secure: process.env.NODE_ENV === 'production'
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
                    sameSite: 'strict',
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
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
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


router.get("/steam/recommendations/:appid", async (req, res) => {
    const { appid } = req.params;
    if (!appid) {
        return res.status(400).json({ error: "appid is required" });
    }

    try {

        const currentSpyData = await fetchSteamSpy(appid);
        const currentTags = currentSpyData && currentSpyData.tags ? Object.keys(currentSpyData.tags) : [];
        

        const featuredUrl = "https://store.steampowered.com/api/featured/";
        const categoriesUrl = "https://store.steampowered.com/api/featuredcategories/";
        
        const [featuredData, categoriesData] = await Promise.all([
            new Promise((resolve, reject) => {
                https.get(featuredUrl, (apiRes) => {
                    if (apiRes.statusCode !== 200) {
                        return reject(new Error(`Steam featured API returned status ${apiRes.statusCode}`));
                    }
                    let d = "";
                    apiRes.on("data", (chunk) => (d += chunk));
                    apiRes.on("end", () => {
                        try {
                            resolve(JSON.parse(d));
                        } catch (e) {
                            reject(e);
                        }
                    });
                }).on("error", reject);
            }),
            new Promise((resolve, reject) => {
                https.get(categoriesUrl, (apiRes) => {
                    if (apiRes.statusCode !== 200) {
                        return reject(new Error(`Steam categories API returned status ${apiRes.statusCode}`));
                    }
                    let d = "";
                    apiRes.on("data", (chunk) => (d += chunk));
                    apiRes.on("end", () => {
                        try {
                            resolve(JSON.parse(d));
                        } catch (e) {
                            reject(e);
                        }
                    });
                }).on("error", reject);
            })
        ]);


        const pool = (categoriesData.top_sellers?.items || [])
            .filter(g => g && (g.id || g.appid) && (g.id || g.appid).toString() !== appid);

        const uniquePool = [];
        const seen = new Set();
        for (const g of pool) {
            const gid = g.id || g.appid;
            if (gid && !seen.has(gid)) {
                seen.add(gid);
                uniquePool.push(g);
            }
            if (uniquePool.length >= 20) break;
        }


        const recommendations = [];
        for (const game of uniquePool) {
            const gameId = game.id || game.appid;
            const spyData = await fetchSteamSpy(gameId);
            
            if (spyData && spyData.tags) {
                const tags = Object.keys(spyData.tags);
                const overlap = tags.filter(t => currentTags.includes(t));
                
                if (overlap.length > 0 || currentTags.length === 0) {
                    recommendations.push({
                        appid: gameId,
                        name: spyData.name || game.name,
                        header_image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${gameId}/header.jpg`,
                        price: game.final_price ? (game.final_price / 100).toFixed(2) + " " + (game.currency || "USD") : "Free",
                        relevance: overlap.length,
                        tags: tags.slice(0, 3)
                    });
                }
            }
        }

        recommendations.sort((a, b) => b.relevance - a.relevance);

        res.json({ recommendations: recommendations.slice(0, 6) });
    } catch (e) {
        console.error("recommendations error", e);
        res.status(500).json({ error: "failed to get recommendations" });
    }
});




router.get("/steam/user-stats", async (req, res) => {
    const token = req.cookies?.token;
    let user = null;

    if (token) {
        try { user = jwt.verify(token, process.env.JWT_SECRET); } catch (e) {}
    }
    if (!user && req.user) user = req.user;
    if (!user) return res.status(401).json({ error: "no auth" });

    let steamId = user.steamid || (user._json && user._json.steamid) || user.id;
    if (steamId.includes('openid/id/')) steamId = steamId.split('openid/id/')[1];

    try {
        const recentGamesUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}`;
        const steamLevelUrl = `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${STEAM_API_KEY}&steamid=${steamId}`;
        const ownedGamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&include_played_free_games=1`;

        // We fetch everything in parallel here. This is much faster and 
        // keeps everything in the async scope.
        const [recentRes, levelRes, ownedRes] = await Promise.all([
            fetch(recentGamesUrl).then(r => r.json()),
            fetch(steamLevelUrl).then(r => r.json()),
            fetch(ownedGamesUrl).then(r => r.json())
        ]);

        const games = recentRes.response?.games || [];
        const totalRecentMinutes = games.reduce((acc, g) => acc + g.playtime_2weeks, 0);

        res.json({
            steamLevel: levelRes.response?.player_level || 0,
            recentPlaytimeHrs: Math.round(totalRecentMinutes / 60),
            recentGamesCount: recentRes.response?.total_count || 0,
            totalGamesOwned: ownedRes.response?.game_count || 0,
            games: games.map(g => ({
                name: g.name,
                appid: g.appid,
                playtime: Math.round(g.playtime_forever / 60)
            }))
        });
    } catch (e) {
        console.error("Steam API Error:", e);
        res.status(500).json({ error: "failed to fetch steam stats" });
    }
});













// Detailed Game Stats with Rarity
router.get("/steam/game-stats/:appid", async (req, res) => {
    const { appid } = req.params;
    const token = req.cookies?.token;
    let user = null;
    
    // Auth Logic
    if (token) try { user = jwt.verify(token, process.env.JWT_SECRET); } catch (e) {}
    if (!user && req.user) user = req.user;
    if (!user) return res.status(401).json({ error: "no auth" });

    let steamId = user.steamid || (user._json && user._json.steamid) || user.id;
    if (steamId.includes('openid/id/')) steamId = steamId.split('openid/id/')[1];

    try {
        const userAchUrl = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid}&key=${STEAM_API_KEY}&steamid=${steamId}`;
        const globalAchUrl = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appid}`;
        const userStatsUrl = `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v0002/?appid=${appid}&key=${STEAM_API_KEY}&steamid=${steamId}`;

        // We use allSettled because GetUserStatsForGame often fails/returns 400 if a game doesn't support it
        const [userAchRes, globalAchRes, userStatsRes] = await Promise.allSettled([
            fetch(userAchUrl).then(r => r.json()),
            fetch(globalAchUrl).then(r => r.json()),
            fetch(userStatsUrl).then(r => r.json())
        ]);

        // 1. Process Achievements (Most Games)
        let achievements = [];
        let unlockedCount = 0;
        let totalCount = 0;

        if (userAchRes.status === 'fulfilled' && userAchRes.value.playerstats?.success) {
            const uAchs = userAchRes.value.playerstats.achievements || [];
            const gAchs = (globalAchRes.status === 'fulfilled') ? globalAchRes.value.achievementpercentages.achievements : [];

            achievements = uAchs.map(ua => {
                const ga = gAchs.find(g => g.name === ua.apiname);
                return {
                    name: ua.apiname,
                    unlocked: ua.achieved === 1,
                    rarity: ga ? parseFloat(ga.percent).toFixed(1) : 0
                };
            });

            unlockedCount = uAchs.filter(a => a.achieved === 1).length;
            totalCount = uAchs.length;
        }

        // 2. Process Numeric Stats (CS2, TF2, Rust, etc.)
        let customStats = [];
        if (userStatsRes.status === 'fulfilled' && userStatsRes.value.playerstats?.stats) {
            customStats = userStatsRes.value.playerstats.stats.map(s => ({
                label: s.name.replace(/_/g, ' '), // Prettify "total_kills" to "total kills"
                value: s.value
            }));
        }

        res.json({
            appid,
            unlocked: unlockedCount,
            total: totalCount,
            percentage: totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0,
            achievements: achievements.sort((a, b) => a.rarity - b.rarity), // Rarest first
            customStats: customStats // Will be empty if game doesn't support numerical stats
        });

    } catch (e) {
        console.error("Steam Stats Error:", e);
        res.status(500).json({ error: "Failed to fetch game statistics" });
    }
});









router.get("/", (req, res) => {
    res.redirect(`${FRONTEND_URL}/home`);
});

module.exports = router;
