const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Route configurations mapped out to business controllers
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;