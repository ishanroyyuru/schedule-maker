const express = require('express');
const { google } = require('googleapis');
const CalendarSyncService = require('../services/CalendarSyncService');
const CalendarConnection = require('../models/CalendarConnection');
const User = require('../models/User');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const router = express.Router();
const calendarSyncService = new CalendarSyncService();

// ---- helpers ----
function safeParseJSON(value, fallback = []) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return value.trim() ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }
  if (typeof value === 'object') return value; // already json/jsonb
  return fallback;
}

// Rate limiting for sync operations (conservative limits)
const syncLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 3, // Allow 3 sync requests per minute per user
  message: {
    success: false,
    error: 'Too many sync requests. Please wait a minute before trying again.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip, // Rate limit by user ID
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many sync requests. Please wait a minute before trying again.',
      retryAfter: 60
    });
  }
});

// Get user's calendar events with hybrid storage
router.get('/events', auth, async (req, res) => {
  try {
    const { startDate, endDate, useCache = 'true', forceSync = 'false' } = req.query;
    
    const options = {
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      useCache: useCache === 'true',
      forceSync: forceSync === 'true'
    };

    const events = await calendarSyncService.getUserEvents(req.user.id, options);
    
    res.json({
      success: true,
      events: events.map(event => ({
        id: event.event_id,
        title: event.title,
        description: event.description,
        location: event.location,
        startTime: event.start_time,
        endTime: event.end_time,
        isAllDay: event.is_all_day,
        status: event.status,
        attendees: safeParseJSON(event.attendees, []), // <- safe either string or object
        recurrence: safeParseJSON(event.recurrence, []),
        provider: event.provider,
        calendarId: event.calendar_id,
        calendarName: event.calendar_summary || event.calendar_id,
        calendarColor: event.calendar_color || '#4285f4'
      }))
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calendar events',
      details: error.message
    });
  }
});

// Google Calendar webhook for automatic sync
router.post('/webhook', async (req, res) => {
  try {
    const { headers, body } = req;
    
    // Verify the webhook is from Google
    const resourceId = headers['x-goog-resource-id'];
    const resourceUri = headers['x-goog-resource-uri'];
    const resourceState = headers['x-goog-resource-state'];
    
    console.log('Google Calendar webhook received:', {
      resourceId,
      resourceUri,
      resourceState
    });

    // Only process if it's a calendar change
    if (resourceState === 'sync' || resourceState === 'exists') {
      // Extract calendar ID from resource URI
      const calendarId = resourceUri.split('/').pop();
      
      // Find all users with this calendar
      const connections = await CalendarConnection.findByCalendarId(calendarId);
      
      // Sync each user's calendar
      for (const connection of connections) {
        try {
          console.log(`Auto-syncing calendar for user ${connection.user_id}`);
          await calendarSyncService.syncConnection(connection, true);
        } catch (error) {
          console.error(`Error auto-syncing user ${connection.user_id}:`, error);
        }
      }
    }

    // Always return 200 to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error');
  }
});

// Set up webhook subscription for a user's calendar
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { calendarId = 'primary' } = req.body;
    
    // Get user's calendar connection
    const connections = await CalendarConnection.findByUserId(req.user.id);
    const connection = connections.find(c => c.calendar_id === calendarId);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Calendar connection not found'
      });
    }

    // Set up Google Calendar API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Create webhook subscription
    const webhookUrl = `${process.env.BASE_URL || 'http://localhost:3001'}/api/calendars/webhook`;
    
    const subscription = await calendar.events.watch({
      calendarId: calendarId,
      resource: {
        id: `calendar-sync-${req.user.id}-${Date.now()}`,
        type: 'web_hook',
        address: webhookUrl,
        params: {
          ttl: '86400' // 24 hours
        }
      }
    });

    console.log('Webhook subscription created:', subscription.data);

    res.json({
      success: true,
      message: 'Webhook subscription created',
      subscription: subscription.data
    });

  } catch (error) {
    console.error('Error setting up webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set up webhook',
      details: error.message
    });
  }
});

// Get user's availability
router.get('/availability', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const availability = await calendarSyncService.getAvailability(
      req.user.id,
      new Date(startDate),
      new Date(endDate)
    );
    
    res.json({
      success: true,
      availability
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch availability',
      details: error.message
    });
  }
});

// Find conflicts for a time period
router.get('/conflicts', auth, async (req, res) => {
  try {
    const { startTime, endTime, excludeEventId } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'startTime and endTime are required'
      });
    }

    const conflicts = await calendarSyncService.findConflicts(
      req.user.id,
      new Date(startTime),
      new Date(endTime),
      excludeEventId
    );
    
    res.json({
      success: true,
      conflicts: conflicts.map(event => ({
        id: event.event_id,
        title: event.title,
        startTime: event.start_time,
        endTime: event.end_time
      }))
    });
  } catch (error) {
    console.error('Error finding conflicts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find conflicts',
      details: error.message
    });
  }
});

// Sync calendar manually (with rate limiting)
router.post('/sync', auth, syncLimiter, async (req, res) => {
  try {
    // Always force sync for manual refresh
    const forceSync = true;
    
    const syncResults = await calendarSyncService.syncUserCalendar(req.user.id, forceSync);
    
    res.json({
      success: true,
      message: 'Calendar refreshed successfully',
      results: syncResults
    });
  } catch (error) {
    console.error('Error syncing calendar:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync calendar',
      details: error.message
    });
  }
});

// Get calendar connections
router.get('/connections', auth, async (req, res) => {
  try {
    const connections = await CalendarConnection.findByUserId(req.user.id);
    
    res.json({
      success: true,
      connections: connections.map(conn => ({
        id: conn.id,
        provider: conn.provider,
        calendarId: conn.calendar_id,
        createdAt: conn.created_at,
        updatedAt: conn.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching calendar connections:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch calendar connections',
      details: error.message
    });
  }
});

// Disconnect calendar
router.delete('/connections/:id', auth, async (req, res) => {
  try {
    const connection = await CalendarConnection.findById(req.params.id);
    
    if (!connection || connection.user_id !== req.user.id) {
      return res.status(404).json({
        success: false,
        error: 'Calendar connection not found'
      });
    }

    await CalendarConnection.delete(req.params.id);
    
    res.json({
      success: true,
      message: 'Calendar connection removed successfully'
    });
  } catch (error) {
    console.error('Error removing calendar connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove calendar connection',
      details: error.message
    });
  }
});

module.exports = router;
