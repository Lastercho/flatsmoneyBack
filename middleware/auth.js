const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    console.log('Auth middleware - headers:', req.headers);
    
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log('No authorization header found');
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    // console.log('Token:', token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log('Decoded token:', decoded);

    req.user = { id: decoded.id };
    // console.log('User set in request:', req.user);

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ message: 'Token expired', error: error.message });
    } else {
      res.status(401).json({ message: 'Invalid token', error: error.message });
    }
  }
};

module.exports = auth;