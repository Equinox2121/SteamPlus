const jwt = require('jsonwebtoken');

function getTokenFromRequest(req) {
    const auth = req.headers && req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim();
    return (req.cookies && req.cookies.token) || null;
}

function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return null;
    }
}

const authMiddleware = (req, res, next) => {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });

    req.user = decoded;
    next();
};

module.exports = authMiddleware;
module.exports.getTokenFromRequest = getTokenFromRequest;
module.exports.verifyToken = verifyToken;
