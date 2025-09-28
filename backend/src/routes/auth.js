const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { validationRules, handleValidationErrors } = require('../utils/validation');
const AIService = require('../utils/aiService');
const logger = require('../utils/logger');

const router = express.Router();

// Signup endpoint
router.post('/signup', validationRules.signup, handleValidationErrors, async (req, res) => {
  try {
    const { email, password, first_name, last_name, risk_appetite } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    // Get AI password analysis
    const passwordAnalysis = await AIService.analyzePasswordStrength(password);

    // Create user
    const user = await User.createUser({
      email,
      password_hash: password, // Will be hashed by the model hook
      first_name,
      last_name,
      risk_appetite: risk_appetite || 'moderate'
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON(),
      token,
      passwordAnalysis
    });
  } catch (error) {
    logger.error('Signup error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error during registration'
    });
  }
});

// Login endpoint
router.post('/login', validationRules.login, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error during login'
    });
  }
});

// Password strength check endpoint
router.post('/check-password-strength', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        error: 'Password required',
        message: 'Please provide a password to analyze'
      });
    }

    const analysis = await AIService.analyzePasswordStrength(password);

    res.json({
      message: 'Password analysis completed',
      analysis
    });
  } catch (error) {
    logger.error('Password strength check error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: 'Unable to analyze password strength'
    });
  }
});

// Forgot password endpoint
router.post('/forgot-password', validationRules.forgotPassword, handleValidationErrors, async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({
        message: 'If an account with this email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    // Update user with reset token
    await user.update({
      reset_token: resetToken,
      reset_token_expires: resetTokenExpires
    });

    // In a real application, you would send an email here
    // For demo purposes, we'll return the token (DON'T DO THIS IN PRODUCTION)
    logger.info(`Password reset requested for: ${email}`);

    res.json({
      message: 'Password reset instructions sent to your email',
      // Remove this in production - only for demo
      resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: 'Unable to process password reset request'
    });
  }
});

// Reset password endpoint
router.post('/reset-password', validationRules.resetPassword, handleValidationErrors, async (req, res) => {
  try {
    const { token, password } = req.body;

    // Find user with valid reset token
    const user = await User.findOne({
      where: {
        reset_token: token,
        reset_token_expires: {
          [require('sequelize').Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired token',
        message: 'The password reset token is invalid or has expired'
      });
    }

    // Get AI password analysis
    const passwordAnalysis = await AIService.analyzePasswordStrength(password);

    // Update password and clear reset token
    await user.update({
      password_hash: password, // Will be hashed by the model hook
      reset_token: null,
      reset_token_expires: null
    });

    logger.info(`Password reset completed for user: ${user.email}`);

    res.json({
      message: 'Password reset successful',
      passwordAnalysis
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      error: 'Password reset failed',
      message: 'Unable to reset password'
    });
  }
});

// Verify token endpoint
router.get('/verify-token', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Access token is required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'User not found'
      });
    }

    res.json({
      message: 'Token is valid',
      user: user.toJSON()
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'The provided token has expired'
      });
    }

    res.status(500).json({
      error: 'Token verification failed',
      message: 'Unable to verify token'
    });
  }
});

module.exports = router;