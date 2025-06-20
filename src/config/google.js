const { OAuth2Client } = require('google-auth-library');
const { google } = require('googleapis');

// Google OAuth2 client configuration
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Scopes required for calendar access
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

// Generate authorization URL
const getAuthUrl = () => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // This ensures we get a refresh token
  });
};

// Exchange authorization code for tokens
const getTokensFromCode = async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Error getting tokens:', error);
    throw new Error('Failed to exchange authorization code for tokens');
  }
};

// Set credentials for the OAuth2 client
const setCredentials = (accessToken, refreshToken) => {
  console.log('Setting OAuth2 credentials:');
  console.log('- Access token length:', accessToken?.length);
  console.log('- Refresh token length:', refreshToken?.length);
  console.log('- Access token preview:', accessToken?.substring(0, 20) + '...');
  
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  
  console.log('OAuth2 credentials set successfully');
};

// Get Google Calendar API instance
const getCalendarApi = () => {
  return google.calendar({ version: 'v3', auth: oauth2Client });
};

// Refresh access token
const refreshAccessToken = async (refreshToken) => {
  try {
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials;
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw new Error('Failed to refresh access token');
  }
};

// Verify ID token
const verifyIdToken = async (idToken) => {
  try {
    const ticket = await oauth2Client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    return ticket.getPayload();
  } catch (error) {
    console.error('Error verifying ID token:', error);
    throw new Error('Invalid ID token');
  }
};

module.exports = {
  oauth2Client,
  SCOPES,
  getAuthUrl,
  getTokensFromCode,
  setCredentials,
  getCalendarApi,
  refreshAccessToken,
  verifyIdToken
}; 