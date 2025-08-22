const CalendarSyncService = require('./CalendarSyncService');
const CalendarConnection = require('../models/CalendarConnection');

class BackgroundSyncService {
  constructor() {
    this.calendarSyncService = new CalendarSyncService();
    this.syncInterval = null;
    this.isRunning = false;
    this.lastSyncTime = null;
    this.nextSyncTime = null;
  }

  // Start background sync service
  start(intervalMinutes = 30) {
    if (this.isRunning) {
      console.log('Background sync service is already running');
      return;
    }

    console.log(`Starting background sync service (interval: ${intervalMinutes} minutes)`);

    this.isRunning = true;

    const run = async () => {
      this.lastSyncTime = new Date();
      this.nextSyncTime = new Date(Date.now() + intervalMinutes * 60 * 1000);
      await this.performBackgroundSync();
    };

    this.syncInterval = setInterval(run, intervalMinutes * 60 * 1000);

    // Perform initial sync
    run();
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
              // Skip known-dead connections early
              if (connection.status === 'REAUTH_REQUIRED') {
                console.log(`Skipping connection ${connection.id} (needs reauth)`);
                continue;
              }

              const res = await this.calendarSyncService.syncConnection(connection, false);

              if (res?.status === 'REAUTH_REQUIRED') {
                console.log(`Connection ${connection.id} marked as REAUTH_REQUIRED; skipping further work`);
                continue;
              }
            } catch (error) {
              // Quietly ignore the typed reauth error to avoid log spam
              if (error && (error.code === 'REAUTH_REQUIRED' || /invalid[_-\s]?grant/i.test(error.message))) {
                console.log(`Connection ${connection.id} requires reauth; skipping`);
                continue;
              }
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
