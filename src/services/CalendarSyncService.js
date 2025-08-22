const { google } = require('googleapis');
const CalendarEvent = require('../models/CalendarEvent');
const CalendarConnection = require('../models/CalendarConnection');
const User = require('../models/User');

class CalendarSyncService {
  constructor() {
    // Remove the global OAuth2 client - we'll create user-specific ones
    this.clientId = process.env.GOOGLE_CLIENT_ID;
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    this.redirectUri = process.env.GOOGLE_REDIRECT_URI;
  }

  // Create a user-specific OAuth2 client
  createUserOAuth2Client(connection) {
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
    
    oauth2Client.setCredentials({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token
    });
    
    return oauth2Client;
  }

  async syncUserCalendar(userId, forceSync = false) {
    try {
      console.log(`Starting sync for user ${userId}, forceSync: ${forceSync}`);
      
      const connections = await CalendarConnection.findByUserId(userId);
      console.log(`Found ${connections.length} calendar connections`);
      
      if (!connections.length) {
        throw new Error('No calendar connections found for user');
      }

      const syncResults = [];
      
      for (const connection of connections) {
        try {
          console.log(`Syncing connection ${connection.id} (${connection.provider})`);
          const result = await this.syncConnection(connection, forceSync);
          syncResults.push(result);
          console.log(`Sync result for connection ${connection.id}:`, result);
        } catch (error) {
          console.error(`Error syncing connection ${connection.id}:`, error);
          syncResults.push({
            connectionId: connection.id,
            success: false,
            error: error.message
          });
        }
      }

      console.log('All sync results:', syncResults);
      return syncResults;
    } catch (error) {
      console.error('Error syncing user calendar:', error);
      throw error;
    }
  }

  async syncConnection(connection, forceSync = false) {
    try {
      console.log(`Syncing connection ${connection.id}, forceSync: ${forceSync}`);
      
      if (!forceSync) {
        const lastSync = connection.updated_at;
        const syncThreshold = new Date(Date.now() - 60 * 60 * 1000);
        
        console.log(`Last sync: ${lastSync}, threshold: ${syncThreshold}`);
        
        if (lastSync > syncThreshold) {
          console.log('No sync needed - data is fresh');
          return {
            connectionId: connection.id,
            success: true,
            message: 'No sync needed - data is fresh',
            eventsCount: 0
          };
        }
      }

      console.log('Refreshing token if needed...');
      await this.refreshTokenIfNeeded(connection);

      console.log('Setting up Google Calendar API...');
      // Create user-specific OAuth2 client
      const userOAuth2Client = this.createUserOAuth2Client(connection);

      const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });

      const now = new Date();
      const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      console.log(`Fetching events from ${now.toISOString()} to ${oneWeekFromNow.toISOString()}`);

      const response = await calendar.events.list({
        calendarId: connection.calendar_id,
        timeMin: now.toISOString(),
        timeMax: oneWeekFromNow.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      console.log(`Found ${events.length} events from Google Calendar`);

      let syncedCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;

      // Get existing events for this connection
      const existingEvents = await CalendarEvent.findByConnectionId(connection.id);
      const existingEventIds = new Set(existingEvents.map(e => e.event_id));
      const newEventIds = new Set(events.map(e => e.id));

      // Delete events that no longer exist in Google Calendar
      for (const existingEvent of existingEvents) {
        if (!newEventIds.has(existingEvent.event_id)) {
          await CalendarEvent.delete(existingEvent.id);
          deletedCount++;
        }
      }

      // Upsert new/updated events
      for (const event of events) {
        const transformedEvent = this.transformGoogleEvent(event, connection.user_id, connection.id);
        await CalendarEvent.upsert(transformedEvent);
        syncedCount++;
      }

      // Update connection's last sync time
      await CalendarConnection.updateLastSync(connection.id);

      const result = {
        connectionId: connection.id,
        success: true,
        message: 'Sync completed successfully',
        eventsCount: events.length,
        syncedCount,
        updatedCount,
        deletedCount
      };

      console.log('Sync completed with result:', result);
      return result;

    } catch (error) {
      console.error('Error syncing connection:', error);
      throw error;
    }
  }

  async refreshTokenIfNeeded(connection) {
    if (!connection.expires_at || new Date() < connection.expires_at) {
      return;
    }

    try {
      // Create user-specific OAuth2 client for token refresh
      const userOAuth2Client = this.createUserOAuth2Client(connection);

      const { credentials } = await userOAuth2Client.refreshAccessToken();
      
      await CalendarConnection.updateAccessToken(
        connection.id,
        credentials.access_token,
        credentials.expiry_date ? new Date(credentials.expiry_date) : null
      );

      connection.access_token = credentials.access_token;
      connection.expires_at = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
    } catch (error) {
      console.error('Error refreshing token:', error);
      
      // Check if it's an invalid_grant error (token is permanently invalid)
      if (error.response && error.response.data && error.response.data.error === 'invalid_grant') {
        console.log(`Token for connection ${connection.id} is permanently invalid, marking for re-authentication`);
        
        // Mark this connection as needing re-authentication
        await this.markConnectionForReauth(connection.id);
        
        throw new Error('TOKEN_INVALID_NEEDS_REAUTH');
      }
      
      throw new Error('Failed to refresh access token');
    }
  }

  // Mark a connection as needing re-authentication
  async markConnectionForReauth(connectionId) {
    try {
      // You could add a 'needs_reauth' field to your database
      // For now, we'll just log it and the user will need to re-authenticate
      console.log(`Connection ${connectionId} needs re-authentication`);
      
      // Optionally, you could update the connection status in the database
      // await CalendarConnection.updateStatus(connectionId, 'needs_reauth');
    } catch (error) {
      console.error('Error marking connection for re-auth:', error);
    }
  }

  transformGoogleEvent(googleEvent, userId, calendarConnectionId) {
    const start = googleEvent.start.dateTime || googleEvent.start.date;
    const end = googleEvent.end.dateTime || googleEvent.end.date;
    
    return {
      userId,
      calendarConnectionId,
      eventId: googleEvent.id,
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description || null,
      location: googleEvent.location || null,
      startTime: new Date(start),
      endTime: new Date(end),
      isAllDay: !googleEvent.start.dateTime,
      status: googleEvent.status || 'confirmed',
      attendees: googleEvent.attendees ? JSON.stringify(googleEvent.attendees) : null,
      recurrence: googleEvent.recurrence ? JSON.stringify(googleEvent.recurrence) : null,
      colorId: googleEvent.colorId || null
    };
  }

  async getUserEvents(userId, options = {}) {
    const { startDate, endDate, useCache = true, forceSync = false } = options;

    try {
      if (forceSync || !useCache) {
        await this.syncUserCalendar(userId, forceSync);
      } else {
        const connections = await CalendarConnection.findByUserId(userId);
        const needsSync = connections.some(conn => {
          const lastSync = new Date(conn.updated_at);
          const syncThreshold = new Date(Date.now() - 60 * 60 * 1000);
          return lastSync < syncThreshold;
        });

        if (needsSync) {
          await this.syncUserCalendar(userId, false);
        }
      }

      return await CalendarEvent.findByUserId(userId, { startDate, endDate });
    } catch (error) {
      console.error('Error getting user events:', error);
      
      if (useCache) {
        console.log('Falling back to cached data');
        return await CalendarEvent.findByUserId(userId, { startDate, endDate });
      }
      
      throw error;
    }
  }

  async getAvailability(userId, startDate, endDate) {
    try {
      await this.syncUserCalendar(userId, false);
      return await CalendarEvent.getAvailability(userId, startDate, endDate);
    } catch (error) {
      console.error('Error getting availability:', error);
      throw error;
    }
  }

  async findConflicts(userId, startTime, endTime, excludeEventId = null) {
    try {
      await this.syncUserCalendar(userId, false);
      return await CalendarEvent.findConflicts(userId, startTime, endTime, excludeEventId);
    } catch (error) {
      console.error('Error finding conflicts:', error);
      throw error;
    }
  }

  async createEvent(userId, eventData) {
    try {
      const connections = await CalendarConnection.findByUserId(userId);
      const primaryConnection = connections.find(c => c.calendar_id === 'primary') || connections[0];
      
      if (!primaryConnection) {
        throw new Error('No calendar connection found for user');
      }

      await this.refreshTokenIfNeeded(primaryConnection);

      this.googleAuth.setCredentials({
        access_token: primaryConnection.access_token,
        refresh_token: primaryConnection.refresh_token
      });

      const calendar = google.calendar({ version: 'v3', auth: this.googleAuth });

      const googleEvent = await calendar.events.insert({
        calendarId: primaryConnection.calendar_id,
        resource: {
          summary: eventData.title,
          description: eventData.description,
          location: eventData.location,
          start: {
            dateTime: eventData.startTime.toISOString(),
            timeZone: eventData.timezone || 'UTC'
          },
          end: {
            dateTime: eventData.endTime.toISOString(),
            timeZone: eventData.timezone || 'UTC'
          },
          attendees: eventData.attendees || []
        }
      });

      const localEventData = this.transformGoogleEvent(
        googleEvent.data,
        userId,
        primaryConnection.id
      );
      
      const savedEvent = await CalendarEvent.upsert(localEventData);
      
      return savedEvent;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  }

  async updateEvent(userId, eventId, eventData) {
    try {
      const connections = await CalendarConnection.findByUserId(userId);
      const event = await CalendarEvent.findByEventId(userId, connections[0].id, eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }

      await this.refreshTokenIfNeeded(connections[0]);

      this.googleAuth.setCredentials({
        access_token: connections[0].access_token,
        refresh_token: connections[0].refresh_token
      });

      const calendar = google.calendar({ version: 'v3', auth: this.googleAuth });

      const googleEvent = await calendar.events.update({
        calendarId: connections[0].calendar_id,
        eventId: eventId,
        resource: {
          summary: eventData.title,
          description: eventData.description,
          location: eventData.location,
          start: {
            dateTime: eventData.startTime.toISOString(),
            timeZone: eventData.timezone || 'UTC'
          },
          end: {
            dateTime: eventData.endTime.toISOString(),
            timeZone: eventData.timezone || 'UTC'
          },
          attendees: eventData.attendees || []
        }
      });

      const localEventData = this.transformGoogleEvent(
        googleEvent.data,
        userId,
        connections[0].id
      );
      
      const updatedEvent = await CalendarEvent.upsert(localEventData);
      
      return updatedEvent;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  async deleteEvent(userId, eventId) {
    try {
      const connections = await CalendarConnection.findByUserId(userId);
      const event = await CalendarEvent.findByEventId(userId, connections[0].id, eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }

      await this.refreshTokenIfNeeded(connections[0]);

      this.googleAuth.setCredentials({
        access_token: connections[0].access_token,
        refresh_token: connections[0].refresh_token
      });

      const calendar = google.calendar({ version: 'v3', auth: this.googleAuth });

      await calendar.events.delete({
        calendarId: connections[0].calendar_id,
        eventId: eventId
      });

      await CalendarEvent.deleteByEventId(userId, connections[0].id, eventId);
      
      return { success: true, message: 'Event deleted successfully' };
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }
}

module.exports = CalendarSyncService; 