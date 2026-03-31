const express = require("express");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
require("dotenv").config({ path: envPath });

const session = require("express-session");
const passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;
const cors = require("cors");
const cookieParser = require("cookie-parser");
const routes = require("./routes/index");
const authRoutes = require("./routes/auth");

const app = express();

console.log("current environment: ", {
    BACKEND_URL: process.env.BACKEND_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    PORT: process.env.BACKEND_PORT
});
const STEAM_API_KEY = process.env.STEAM_API_KEY;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

console.log("steam strategy:", {
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

// debug strategy registration
const strategy = passport._strategies ? passport._strategies.steam : null;
if (strategy) {
    console.log("strategy successfully registered.");
} else {
    console.warn("strategy registration might have failed.");
}

app.use(cors({
    origin: FRONTEND_URL,
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

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

app.use(passport.initialize());
app.use(passport.session());

app.use("/", routes);
app.use("/auth", authRoutes);

//look for port requests
const PORT = process.env.BACKEND_PORT || 5000;
app.listen(PORT, () => {
    console.log(`running on port ${PORT}`);
});
