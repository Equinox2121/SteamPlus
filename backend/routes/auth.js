// backend/auth.js TEMPLATE
//
// Authentication routes for Sprint 2.
//
// WHAT THIS FILE DOES
// - Registers new users (hashes passwords before storing)
// - Logs users in (verifies password, issues JWT as an HTTP-only cookie)
// - Verifies active sessions (/auth/test) using a middleware-free, minimal check here
// - Logs users out by clearing the cookie
//
// IMPORTANT BACKEND REQUIREMENTS (configured in app.js):
// 1) cookie-parser must be enabled so we can read/write cookies:
//      import cookieParser from 'cookie-parser';
//      app.use(cookieParser());
// 2) CORS must allow credentials from the frontend origin:
//      app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
// 3) JWT_SECRET must be set in .env


const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database.js');

const router = express.Router();

/**
 * Registers a new user by hashing the password and storing user data in the database.
 * @route POST /auth/register
 * @body {string} username - Unique username for the user.
 * @body {string} password - Plaintext password (hashed before storage).
 * @returns {JSON} Success message or error details.
 */
router.post('/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) return res.status(400).json({ error: 'email, username, and password are required' });
  try {
    // 1) Hash the user's password with a reasonable work factor
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2) Insert the user into the DB (UNIQUE constraints will throw on duplicates)
    //    Change `password_hash` to `password` here if your table uses that column.
    await pool.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    // 3) Respond success
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    // Common causes:
    // - Duplicate username (unique constraint violation)
    // - DB connectivity issues
    console.error('Error during user registration:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

/**
 * Authenticates a user by verifying the password and sets a signed JWT in an HTTP-only cookie.
 * @route POST /auth/login
 * @body {string} username - The username.
 * @body {string} password - The plaintext password.
 * @returns {JSON} Success message or error details.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Basic input guards
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  try {
    // 1) Fetch user by username
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];

    // 2) Decide which column holds the hash (supports either schema during transition)
    //    Prefer `password_hash`; fall back to `password` if needed.
    const storedHash = user?.password_hash ?? user?.password;

    // 3) Validate user exists and password matches
    if (user && storedHash && await bcrypt.compare(password, storedHash)) {
      // 4) Create a JWT payload with minimal claims
      const payload = { id: user.id, username: user.username };

      // 5) Sign the JWT
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

      // 6) Set the JWT as an HTTP-only cookie
      //    - httpOnly: JS cannot read the cookie (XSS protection)
      //    - sameSite: 'strict' prevents CSRF across sites during dev
      //    - secure: only over HTTPS in production
      //    - maxAge: 1 hour in milliseconds (align with JWT expiry)
      res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000
      });

      // 7) Frontend just needs to know it worked (no token in body)
      return res.json({ 
        ok: true, 
        message: 'Login successful', 
        user: { id: user.id, username: user.username } 
      });
    }

    // Invalid credentials
    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});




/**
 * Verifies the current session by validating the JWT cookie.
 * The frontend calls this on app load to determine if the user is authenticated.
 * @route GET /auth/test
 * @returns {JSON} { ok: true, user: { id, username } } on success; 401/403 on failure.
 */
router.get('/test', (req, res) => {
  // 1. Check if Passport (Steam) session exists
  const isSteamAuth = req.isAuthenticated && req.isAuthenticated();
  
  // 2. Check if JWT cookie exists
  const token = req.cookies?.token;

  if (isSteamAuth) {
    return res.json({ ok: true, method: 'steam' });
  }

  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      return res.json({ ok: true, method: 'jwt' });
    } catch (err) {
      // Token expired or invalid
    }
  }

  // 3. If neither, return 401 Unauthorized
  return res.status(401).json({ ok: false, error: 'Not authenticated' });
});

/**
 * Logs the user out by clearing the JWT cookie.
 * @route POST /auth/logout
 * @returns {JSON} Success message.
 */
router.post('/logout', (req, res) => {
  // Clear JWT
  res.clearCookie('token', { httpOnly: true, sameSite: 'strict' });

  // Clear Steam Session
  if (req.logout) {
    req.logout(() => {
      if (req.session) req.session.destroy();
      res.json({ ok: true, message: 'Logged out' });
    });
  } else {
    res.json({ ok: true });
  }
});

/**
 * NEW: Add this route inside auth.js so Home.jsx can fetch the user
 */
router.get("/user", (req, res) => {
    // 1. Check Steam (Passport)
    if (req.isAuthenticated && req.isAuthenticated()) {
        const user = req.user || {};
        const username = user.personaname || user.displayName || "Steam User";
        const avatar = user.photos?.[2]?.value || null;
        return res.json({ loggedIn: true, username, avatar });
    }

    // 2. Check General (JWT)
    const token = req.cookies?.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            return res.json({ loggedIn: true, username: decoded.username, avatar: null });
        } catch (err) {
            // Token invalid
        }
    }
    res.json({ loggedIn: false });
});

// CRITICAL: This was missing and caused your crash
module.exports = router;