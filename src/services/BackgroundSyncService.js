const CalendarSyncService = require('./CalendarSyncService');
const CalendarConnection = require('../models/CalendarConnection');

class BackgroundSyncService {
  constructor() {
    this.calendarSyncService = new CalendarSyncService();
    this.syncInterval = null;
    this.isRunning = false;
  }

  // Start background sync service
  start(intervalMinutes = 30) {
    if (this.isRunning) {
      console.log('Background sync service is already running');
      return;
    }

    console.log(`Starting background sync service (interval: ${intervalMinutes} minutes)`);
    
    this.isRunning = true;
    this.syncInterval = setInterval(async () => {
      await this.performBackgroundSync();
    }, intervalMinutes * 60 * 1000);

    // Perform initial sync
    this.performBackgroundSync();
  }

  // Stop background sync service
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('Background sync service stopped');
  }

  // Perform background sync for all users
  async performBackgroundSync() {
    try {
      console.log('Starting background sync for all users...');
      
      // Get all calendar connections
      const connections = await CalendarConnection.findAll();
      
      if (connections.length === 0) {
        console.log('No calendar connections found for background sync');
        return;
      }

      console.log(`Found ${connections.length} calendar connections to sync`);

      // Group connections by user
      const userConnections = {};
      connections.forEach(conn => {
        if (!userConnections[conn.user_id]) {
          userConnections[conn.user_id] = [];
        }
        userConnections[conn.user_id].push(conn);
      });

      // Sync each user's calendars
      for (const [userId, userConns] of Object.entries(userConnections)) {
        try {
          console.log(`Background syncing user ${userId} (${userConns.length} calendars)`);
          
          for (const connection of userConns) {
            try {
              await this.calendarSyncService.syncConnection(connection, false);
            } catch (error) {
              console.error(`Error background syncing connection ${connection.id}:`, error);
            }
          }
        } catch (error) {
          console.error(`Error background syncing user ${userId}:`, error);
        }
      }

      console.log('Background sync completed');
    } catch (error) {
      console.error('Error in background sync:', error);
    }
  }

  // Get sync status
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSyncTime,
      nextSync: this.nextSyncTime
    };
  }
}

module.exports = BackgroundSyncService; 