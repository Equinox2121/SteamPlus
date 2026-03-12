const express = require("express");
const session = require("express-session");
const passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const cors = require("cors");
const https = require("https");

//Backend Host will be port 5000

const app = express();
const STEAM_API_KEY = "CAA4749CAF9399C2F00E5B805F46349B"; //our steam key under domain localhost

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.use(session({
    secret: "steam-login-secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        sameSite: "lax"
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.get("/user", (req, res) => {
    if (req.isAuthenticated()) {
        const user = req.user || {};
        const username = //many fallbacks recommended as steam passport api is not consistent
            user.personaname ||
            user.displayName ||
            (user._json && user._json.personaname) ||
            user.username ||
            user.id ||
            "Steam User";
        res.json({ loggedIn: true, username });
    } else {
        res.json({ loggedIn: false });
    }
});

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new SteamStrategy({
        returnURL: "http://localhost:5000/auth/steam/return",
        realm: "http://localhost:5000/",
        apiKey: STEAM_API_KEY
    },
    function(identifier, profile, done) {
        return done(null, profile);
    }
));


app.get("/auth/steam",
    passport.authenticate("steam", { failureRedirect: "/" })
);

app.get("/auth/steam/return",
    passport.authenticate("steam", { failureRedirect: "/login" }),
    (req, res) => {
        console.log(req.user); //this is what user logged is compiled of

        res.redirect("http://localhost:5173/home");
    }
);

app.post('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) {
            return res.status(500).json({ error: "logout failure" }); //likely the account is already logged out
        }

        req.session.destroy(() => {
            res.clearCookie("connect.sid");
            res.json({ ok: true });
        });
    });
});

// return map of user games
app.get("/steam/library", (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "no auth" });
    }

    const user = req.user || {};
    const steamId = user.id || (user._json && (user._json.steamid || user._json.steamid64)) || user.steamid;

    if (!steamId) {
        return res.status(400).json({ error: "steamid not found" });
    }

    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`;

    https.get(url, (apiRes) => {
        let data = "";
        apiRes.on("data", (chunk) => (data += chunk));
        apiRes.on("end", () => { //prepare for games map
            try {
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

app.get("/", (req, res) => {
    res.send("running");
});

//look for port 5000 requests
app.listen(5000, () => {
    console.log("running on port 5000");
});
