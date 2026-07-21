const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// POST /api/v1/auth/register
exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // 1. Basic Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields (email, password, name) are required.' });
    }

    // 2. Check if the user already exists in PostgreSQL
    const checkUserQuery = 'SELECT id FROM users WHERE email = $1';
    const existingUser = await db.query(checkUserQuery, [email.toLowerCase().trim()]);
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // 3. Crypto Hash the password (10 salt rounds is industry standard strength/speed ratio)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 4. Save to the Database
    const insertUserQuery = `
      INSERT INTO users (email, password_hash, name) 
      VALUES ($1, $2, $3) 
      RETURNING id, email, name, created_at;
    `;
    const newUserResult = await db.query(insertUserQuery, [
      email.toLowerCase().trim(), 
      passwordHash, 
      name.trim()
    ]);
    const newUser = newUserResult.rows[0];

    // 5. Issue the JWT Token Passport
    const token = jwt.sign(
      { userId: newUser.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' } // Valid for 1 week
    );

    // 6. Respond with user details + token
    return res.status(201).json({
      message: 'Registration successful!',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
      }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
};

// POST /api/v1/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Basic Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // 2. Fetch the user profile by email
    const findUserQuery = 'SELECT id, email, password_hash, name FROM users WHERE email = $1';
    const userResult = await db.query(findUserQuery, [email.toLowerCase().trim()]);
    
    if (userResult.rows.length === 0) {
      // Security Tip: Use a generic error message so attackers don't know if the email or password was wrong
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userResult.rows[0];

    // 3. Verify the password hash matches the plaintext password input
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // 4. Re-issue fresh JWT Token Passport
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
};