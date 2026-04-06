const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database.js');

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

      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

      res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000
      });

      return res.json({ message: 'Login successful' });
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

router.get('/test', async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    return res.json({ 
        ok: true, 
        user: { 
            id: decoded.id, 
            username: decoded.username,
            steamid: decoded.steamid,
            avatar: decoded.avatar
        } 
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });
  res.json({ message: 'Logged out' });
});

router.post('/complete-steam-profile', async (req, res) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Not authenticated with Steam' });
  }
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  let steamId = req.user.id;
  if (steamId && typeof steamId === 'string' && steamId.includes('https://steamcommunity.com/openid/id/')) {
    steamId = steamId.split('https://steamcommunity.com/openid/id/')[1];
  }
  const email = (req.user.emails && req.user.emails[0] && req.user.emails[0].value) || null;

  try {

    const [existing] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const [result] = await pool.execute(
      'INSERT INTO users (username, email, steam_id) VALUES (?, ?, ?)',
      [username, email, steamId]
    );

    const newUser = {
      id: result.insertId,
      username: username,
      steamid: steamId
    };

    const avatar = (req.user.photos && req.user.photos[2] && req.user.photos[2].value) ||
      (req.user._json && (req.user._json.avatarfull || req.user._json.avatarmedium || req.user._json.avatar)) ||
      null;

    const payload = {
      id: newUser.id,
      username: newUser.username,
      steamid: newUser.steamid,
      avatar: avatar
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 1000
    });

    res.json({ message: 'Profile completed successfully', user: newUser });
  } catch (error) {
    console.error('Error during profile completion:', error);
    res.status(500).json({ error: 'Failed to complete profile' });
  }
});

module.exports = router;