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
router.get("/steam/game/:appid", (req, res) => {
    const { appid } = req.params;
    if (!appid) {
        return res.status(400).json({ error: "appid is required" });
    }

    const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=us`;

    https.get(url, (apiRes) => {
        let data = "";
        apiRes.on("data", (chunk) => (data += chunk));
        apiRes.on("end", () => {
            try {
                const parsed = JSON.parse(data);
                if (parsed[appid] && parsed[appid].success) {
                    res.json(parsed[appid].data);
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

router.get("/", (req, res) => {
    res.redirect(`${FRONTEND_URL}/home`);
});

module.exports = router;
