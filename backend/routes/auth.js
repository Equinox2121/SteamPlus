const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database.js');
const { getTokenFromRequest, verifyToken } = require('../middleware/authMiddleware');
const { authCookieOptions } = require('../config/origins');

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const SESSION_TTL_JWT = `${SESSION_TTL_DAYS}d`;

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) return res.status(400).json({ error: 'email, username, and password are required' });
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.status(201).json({ message: 'User registered successfully' });

  } catch (error) {

    console.error('Error during user registration:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});


router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  try {

    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];

    if (user && !user.password_hash && user.steam_id) {
      return res.status(401).json({ error: 'Must sign in with steam' });
    }

    const storedHash = user?.password_hash ?? user?.password;


    if (user && storedHash && await bcrypt.compare(password, storedHash)) {

      const payload = { 
          id: user.id, 
          username: user.username,
          steamid: user.steam_id 
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: SESSION_TTL_JWT });

      res.cookie('token', token, authCookieOptions({ maxAge: SESSION_TTL_MS }));

      return res.json({ message: 'Login successful', token });
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

router.get('/test', async (req, res) => {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(403).json({ error: 'Access denied' });
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });

  return res.json({
      ok: true,
      user: {
          id: decoded.id,
          username: decoded.username,
          steamid: decoded.steamid,
          avatar: decoded.avatar
      }
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', authCookieOptions());
  res.json({ message: 'Logged out' });
});

router.post('/complete-steam-profile', async (req, res) => {
  const pendingToken = getTokenFromRequest(req);
  const pending = pendingToken ? verifyToken(pendingToken) : null;
  if (!pending || !pending.pending || !pending.steamid) {
    return res.status(401).json({ error: 'Not authenticated with Steam' });
  }

  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  const steamId = pending.steamid;
  const avatar = pending.avatar || null;

  try {
    const [existing] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const [result] = await pool.execute(
      'INSERT INTO users (username, email, steam_id) VALUES (?, ?, ?)',
      [username, null, steamId]
    );

    const newUser = { id: result.insertId, username, steamid: steamId };
    const payload = { id: newUser.id, username: newUser.username, steamid: newUser.steamid, avatar };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: SESSION_TTL_JWT });
    res.cookie('token', token, authCookieOptions({ maxAge: SESSION_TTL_MS }));

    res.json({ message: 'Profile completed successfully', user: newUser, token });
  } catch (error) {
    console.error('Error during profile completion:', error);
    res.status(500).json({ error: 'Failed to complete profile' });
  }
});

module.exports = router;