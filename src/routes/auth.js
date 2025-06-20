const express = require('express');
const jwt = require('jsonwebtoken');
const { 
  getAuthUrl, 
  getTokensFromCode, 
  verifyIdToken,
  refreshAccessToken 
} = require('../config/google');
const User = require('../models/User');
const CalendarConnection = require('../models/CalendarConnection');

const router = express.Router();

// Initialize Google OAuth login
router.get('/google', (req, res) => {
  try {
    const authUrl = getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);
    
    // Get user info from Google
    const userInfo = await verifyIdToken(tokens.id_token);
    
    // Find or create user
    let user = await User.findByEmail(userInfo.email);
    
    if (!user) {
      user = await User.create({
        email: userInfo.email,
        name: userInfo.name,
        googleId: userInfo.sub,
        timezone: userInfo.locale || 'UTC'
      });
    }

    // Save or update calendar connection
    await CalendarConnection.upsert({
      userId: user.id,
      provider: 'google',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      calendarId: 'primary'
    });

    // Generate JWT token
    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Set session
    req.session.userId = user.id;
    req.session.jwtToken = jwtToken;

    // Redirect to frontend with token in query params
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/?token=${jwtToken}`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(`
        <div style="font-family: sans-serif; padding: 20px;">
            <h1>Authentication Failed</h1>
            <p>Something went wrong during the Google login process.</p>
            <p><b>Error:</b> ${error.message || 'Failed to exchange authorization code.'}</p>
            <p>This can happen if you refresh the page during login. Please try again.</p>
            <a href="/">Go back to login</a>
        </div>
    `);
  }
});

// Refresh access token
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const newTokens = await refreshAccessToken(refreshToken);
    
    // Update the stored refresh token if a new one was provided
    if (newTokens.refresh_token) {
      await CalendarConnection.updateRefreshToken(refreshToken, newTokens.refresh_token);
    }

    res.json({
      access_token: newTokens.access_token,
      expires_in: newTokens.expiry_date ? Math.floor((newTokens.expiry_date - Date.now()) / 1000) : null
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Failed to refresh token' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    // Try to get token from Authorization header first, then from session
    const token = req.headers.authorization?.replace('Bearer ', '') || req.session.jwtToken;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's calendar connections
    const calendarConnections = await CalendarConnection.findByUserId(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        timezone: user.timezone,
        createdAt: user.createdAt
      },
      calendarConnections
    });

  } catch (error) {
    console.error('Get user error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Failed to get user information' });
  }
});

// Check authentication status
router.get('/status', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.session.jwtToken;
  
  if (!token) {
    return res.json({ authenticated: false });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.json({ authenticated: false });
    }

    res.json({ 
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        timezone: user.timezone
      }
    });
  } catch (error) {
    res.json({ authenticated: false });
  }
});

module.exports = router; 