const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // 1. Extract the Authorization header (Expected format: "Bearer <token>")
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Access denied. No authentication token provided or format is invalid.' 
      });
    }

    // 2. Parse out the raw token string
    const token = authHeader.split(' ')[1];

    // 3. Cryptographically verify the token using your high-entropy secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Attach the validated user details payload directly to the request object
    req.user = { id: decoded.userId };

    // 5. Pass control safely to the next controller function in line
    next();

  } catch (error) {
    console.error('JWT Verification Warning:', error.message);
    
    // Explicitly handle token expiration vs malicious tampering
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    }
    
    return res.status(403).json({ error: 'Authentication failed. Token is corrupted or invalid.' });
  }
};