const express = require("express");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const cors = require("cors");
const https = require("https");

// General Login Addition
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.js"); // Points to your auth.js template

const app = express();

// General Login Addition
app.use(express.json()); 
app.use(cookieParser());


const envPath = path.join(__dirname, "..", ".env");
console.log("Loading .env from:", envPath);
require("dotenv").config({ path: envPath });

console.log("current environment: ", {
    BACKEND_URL: process.env.BACKEND_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    PORT: process.env.BACKEND_PORT
});
const STEAM_API_KEY = process.env.STEAM_API_KEY;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

console.log("Steam Strategy Config:", {
    returnURL: `${BACKEND_URL}/auth/steam/return`,
    realm: `${BACKEND_URL}/`,
    apiKey: STEAM_API_KEY ? "EXISTS" : "MISSING"
});

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new SteamStrategy({
        returnURL: `${BACKEND_URL}/auth/steam/return`,
        realm: `${BACKEND_URL}/`,
        apiKey: STEAM_API_KEY
    },
    function(identifier, profile, done) {
        console.log("Verified Steam identifier:", identifier);
        return done(null, profile);
    }
));

// Debug strategy registration
const strategy = passport._strategies ? passport._strategies.steam : null;
if (strategy) {
    console.log("Strategy successfully registered.");
} else {
    console.warn("Strategy registration might have failed.");
}

app.use(cors({
    origin: FRONTEND_URL,
    credentials: true
}));

const SESSION_SECRET = process.env.SESSION_SECRET;

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        sameSite: "lax"
    }
}));


// General Login Addition
app.use("/auth", authRoutes);




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
        const avatar = (user.photos && user.photos[2] && user.photos[2].value) ||
            (user._json && (user._json.avatarfull || user._json.avatarmedium || user._json.avatar)) ||
            null;
        res.json({ loggedIn: true, username, avatar });
    } else {
        res.json({ loggedIn: false });
    }
});

//passport.serializeUser is now earlier
//passport.deserializeUser is now earlier
//passport.use is now earlier

app.get("/auth/steam", (req, res, next) => {
    console.log("AUTHENTICATING STEAM");
    passport.authenticate("steam", { failureRedirect: "/" })(req, res, next);
});

app.get("/auth/steam/return",
    passport.authenticate("steam", { failureRedirect: "/login" }),
    (req, res) => {
        console.log(req.user); //this is what user logged is compiled of

        res.redirect(`${FRONTEND_URL}/home`);
    }
);

app.post('/logout', (req, res) => {
    req.logout(function(err) {
        if (err) {
            return res.status(500).json({ error: "logout failure" }); //likely the account is already logged out
        }

        // General Login Addition
        res.clearCookie("token", {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV === 'production'
        });

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

//look for port requests
const PORT = process.env.BACKEND_PORT || 5000;
app.listen(PORT, () => {
    console.log(`running on port ${PORT}`);
});
