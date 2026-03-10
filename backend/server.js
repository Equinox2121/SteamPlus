const express = require("express");
const session = require("express-session");
const passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const cors = require("cors");

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
    passport.authenticate("steam", { failureRedirect: "/" }),
    (req, res) => {
        console.log(req.user); //this is what user logged is compiled of

        res.redirect("http://localhost:5173");
    }
);

app.get("/", (req, res) => {
    res.send("running");
});

//look for port 5000 requests
app.listen(5000, () => {
    console.log("running on port 5000");
});
