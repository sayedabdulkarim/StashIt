const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const auth = require('../middleware/auth');

const REDIRECT_URI = process.env.NODE_ENV === 'production'
  ? 'https://stashit-production.up.railway.app/api/auth/google/callback'
  : 'http://localhost:3000/api/auth/google/callback';

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

// @route   GET /api/auth/google/login
// @desc    Redirect to Google OAuth
// @access  Public
router.get('/google/login', (req, res) => {
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['email', 'profile'],
    prompt: 'select_account'
  });
  res.redirect(authUrl);
});

// @route   GET /api/auth/google/callback
// @desc    Google OAuth callback
// @access  Public
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send('Authorization code missing');
    }

    // Exchange code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get user info
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const payload = await response.json();
    const { sub: googleId, email, name, picture } = payload;

    // Find or create user
    let user = await User.findOne({ googleId });

    if (user) {
      user.lastLoginAt = new Date();
      await user.save();
    } else {
      user = await User.create({
        googleId,
        email,
        name,
        avatar: picture
      });
    }

    // Generate JWT (20 days expiry)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '20d' }
    );

    // Get extension ID from environment
    const extensionId = process.env.EXTENSION_ID;

    // Send HTML that saves token and closes tab
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>StashIt - Login Successful</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0f0f;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
          }
          .container {
            text-align: center;
            padding: 40px;
          }
          .icon { font-size: 64px; margin-bottom: 20px; }
          h1 { color: #6366f1; margin-bottom: 10px; }
          p { color: #9ca3af; }
          .status { margin-top: 10px; font-size: 14px; }
          .success { color: #10b981; }
          .error { color: #ef4444; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">🔐</div>
          <h1>Login Successful!</h1>
          <p>Saving your session...</p>
          <p class="status" id="status"></p>
        </div>
        <script>
          const token = '${token}';
          const extensionId = '${extensionId || ''}';
          const statusEl = document.getElementById('status');

          // Try to send token to extension
          if (extensionId && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage(
              extensionId,
              { action: 'saveToken', token: token },
              (response) => {
                if (chrome.runtime.lastError) {
                  statusEl.innerHTML = '<span class="error">Could not connect to extension. Please copy this token manually:</span><br><code style="font-size:10px;word-break:break-all;">' + token + '</code>';
                } else if (response && response.success) {
                  statusEl.innerHTML = '<span class="success">✓ You are logged in! You can close this tab now.</span>';
                  setTimeout(() => window.close(), 1500);
                }
              }
            );
          } else {
            // Fallback - store in localStorage for manual retrieval
            localStorage.setItem('stashit_token', token);
            statusEl.innerHTML = '<span class="success">✓ You are logged in! Close this tab and open the extension.</span>';
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Google callback error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Login Failed</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1>Login Failed</h1>
        <p>${error.message}</p>
        <a href="/api/auth/google/login">Try Again</a>
      </body>
      </html>
    `);
  }
});

// @route   POST /api/auth/google
// @desc    Authenticate with Google token (for API calls)
// @access  Public
router.post('/google', async (req, res) => {
  try {
    const { googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({ error: 'Google token is required' });
    }

    // Verify Google token
    let payload;
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });

      if (!response.ok) {
        throw new Error('Failed to verify Google token');
      }

      payload = await response.json();
    } catch (error) {
      console.error('Google verification error:', error);
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    const { sub: googleId, email, name, picture } = payload;

    // Find or create user
    let user = await User.findOne({ googleId });

    if (user) {
      user.lastLoginAt = new Date();
      await user.save();
    } else {
      user = await User.create({
        googleId,
        email,
        name,
        avatar: picture
      });
    }

    // Generate JWT (20 days expiry)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '20d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// @route   GET /api/auth/verify
// @desc    Verify JWT token
// @access  Private
router.get('/verify', auth, (req, res) => {
  res.json({
    id: req.user._id,
    email: req.user.email,
    name: req.user.name,
    avatar: req.user.avatar
  });
});

// @route   POST /api/auth/logout
// @desc    Logout (client-side token removal)
// @access  Private
router.post('/logout', auth, (req, res) => {
  // JWT is stateless, so logout is handled client-side
  // This endpoint can be used for logging/analytics
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
