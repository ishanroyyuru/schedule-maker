const express = require('express');
const { getCalendarApi, setCredentials, refreshAccessToken } = require('../config/google');
const CalendarConnection = require('../models/CalendarConnection');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// This entire route is protected
router.use(authMiddleware);

// Get all available calendars
router.get('/list', async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Calendar list request for user ID:', userId);
        
        // Find the user's Google calendar connection
        const [connection] = await CalendarConnection.findByUserAndProvider(userId, 'google');
        console.log('Calendar connection found:', !!connection);
        
        if (!connection) {
            console.log('No Google Calendar connection found for user:', userId);
            return res.status(404).json({ error: 'Google Calendar connection not found for this user.' });
        }

        console.log('Setting credentials with access token length:', connection.access_token?.length);
        console.log('Setting credentials with refresh token length:', connection.refresh_token?.length);

        // Set credentials for the Google Calendar API
        setCredentials(connection.access_token, connection.refresh_token);

        const calendar = getCalendarApi();
        
        // Get list of all calendars
        const calendarList = await calendar.calendarList.list();
        
        if (!calendarList.data.items || calendarList.data.items.length === 0) {
            return res.json({ 
                calendars: [],
                message: 'No calendars accessible. Please check your Google Calendar permissions.'
            });
        }

        res.json({ 
            calendars: calendarList.data.items,
            message: `Found ${calendarList.data.items.length} calendar(s)`
        });

    } catch (error) {
        console.error('Error fetching calendar list:', error);
        
        if (error.code === 403) {
            return res.status(403).json({ 
                error: 'Calendar access denied. Please check your Google Calendar permissions.',
                details: 'The app does not have permission to access your calendars.'
            });
        }
        
        res.status(500).json({ error: 'Failed to fetch calendar list.' });
    }
});

// Get events from all accessible calendars
router.get('/events', async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Calendar events request for user ID:', userId);
        
        // Find the user's Google calendar connection
        const [connection] = await CalendarConnection.findByUserAndProvider(userId, 'google');
        console.log('Calendar connection found for events:', !!connection);

        if (!connection) {
            console.log('No Google Calendar connection found for user (events):', userId);
            return res.status(404).json({ error: 'Google Calendar connection not found for this user.' });
        }

        console.log('Setting credentials for events with access token length:', connection.access_token?.length);
        console.log('Setting credentials for events with refresh token length:', connection.refresh_token?.length);

        // Set credentials for the Google Calendar API
        setCredentials(connection.access_token, connection.refresh_token);

        const calendar = getCalendarApi();
        
        // First, get list of all calendars
        const calendarList = await calendar.calendarList.list();
        
        if (!calendarList.data.items || calendarList.data.items.length === 0) {
            return res.json({ 
                events: [],
                message: 'No calendars accessible. Please check your Google Calendar permissions.',
                calendars: []
            });
        }

        // Get events from all calendars
        const allEvents = [];
        const calendarInfo = [];

        for (const cal of calendarList.data.items) {
            try {
                const events = await calendar.events.list({
                    calendarId: cal.id,
                    timeMin: new Date().toISOString(),
                    maxResults: 50,
                    singleEvents: true,
                    orderBy: 'startTime'
                });

                if (events.data.items) {
                    events.data.items.forEach(event => {
                        event.calendarName = cal.summary;
                        event.calendarId = cal.id;
                        allEvents.push(event);
                    });
                }

                calendarInfo.push({
                    id: cal.id,
                    name: cal.summary,
                    accessRole: cal.accessRole
                });

            } catch (calendarError) {
                console.error(`Error fetching events from calendar ${cal.summary}:`, calendarError);
                // Continue with other calendars even if one fails
            }
        }

        // Sort all events by start time
        allEvents.sort((a, b) => {
            const aTime = a.start.dateTime || a.start.date;
            const bTime = b.start.dateTime || b.start.date;
            return new Date(aTime) - new Date(bTime);
        });

        res.json({ 
            events: allEvents,
            calendars: calendarInfo,
            message: `Found ${allEvents.length} events across ${calendarInfo.length} calendar(s)`
        });

    } catch (error) {
        console.error('Error fetching calendar events:', error);
        
        if (error.code === 403) {
            return res.status(403).json({ 
                error: 'Calendar access denied. Please check your Google Calendar permissions.',
                details: 'The app does not have permission to access your calendars.'
            });
        }
        
        res.status(500).json({ error: 'Failed to fetch calendar events.' });
    }
});

// Get calendar events
router.get('/:calendarId/events', async (req, res) => {
  try {
    // TODO: Implement calendar events fetching logic
    res.json({ message: 'Calendar events endpoints coming soon' });
  } catch (error) {
    console.error('Error getting calendar events:', error);
    res.status(500).json({ error: 'Failed to get calendar events' });
  }
});

// Create calendar event
router.post('/:calendarId/events', async (req, res) => {
  try {
    // TODO: Implement calendar event creation logic
    res.json({ message: 'Calendar event creation coming soon' });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

module.exports = router; 