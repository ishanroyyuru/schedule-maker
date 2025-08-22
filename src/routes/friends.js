const express = require('express');
const Friend = require('../models/Friend');
const User = require('../models/User');
const CalendarEvent = require('../models/CalendarEvent');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Send friend request
router.post('/request/:friendId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendId } = req.params;

        // Check if friend exists
        const friend = await User.findById(friendId);
        if (!friend) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if there's an existing friendship
        const existingFriendship = await Friend.checkFriendship(userId, friendId);
        if (existingFriendship) {
            return res.status(400).json({ 
                error: 'Friend request already exists',
                status: existingFriendship.status
            });
        }

        const request = await Friend.sendRequest(userId, friendId);
        res.status(201).json({ message: 'Friend request sent', request });

    } catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Accept friend request
router.put('/accept/:friendId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendId } = req.params;

        const request = await Friend.acceptRequest(userId, friendId);
        res.json({ message: 'Friend request accepted', request });

    } catch (error) {
        console.error('Accept friend request error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Reject friend request
router.put('/reject/:friendId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendId } = req.params;

        const request = await Friend.rejectRequest(userId, friendId);
        res.json({ message: 'Friend request rejected', request });

    } catch (error) {
        console.error('Reject friend request error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all friends
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const friends = await Friend.getFriends(userId);
        res.json({ friends });

    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get pending friend requests
router.get('/pending', async (req, res) => {
    try {
        const userId = req.user.id;
        const requests = await Friend.getPendingRequests(userId);
        res.json({ requests });

    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get sent friend requests
router.get('/sent', async (req, res) => {
    try {
        const userId = req.user.id;
        const requests = await Friend.getSentRequests(userId);
        res.json({ requests });

    } catch (error) {
        console.error('Get sent requests error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remove friend
router.delete('/:friendId', async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendId } = req.params;

        await Friend.removeFriend(userId, friendId);
        res.json({ message: 'Friend removed successfully' });

    } catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Search users for adding friends
router.get('/search', async (req, res) => {
    try {
        const userId = req.user.id;
        const { query } = req.query;

        if (!query || query.length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }

        // Get current friends to exclude them from search
        const friends = await Friend.getFriends(userId);
        const friendIds = friends.map(f => f.id);
        friendIds.push(userId); // Exclude self from results

        const users = await User.search(query, friendIds);
        res.json({ users });

    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Force sync friend's calendars
router.post('/:friendId/sync', async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendId } = req.params;

        // Verify friendship exists
        const friendship = await Friend.checkFriendship(userId, friendId);
        if (!friendship || friendship.status !== 'accepted') {
            return res.status(403).json({ error: 'Not authorized to sync this friend\'s calendar' });
        }

        // Get friend's calendar connections
        const CalendarConnection = require('../models/CalendarConnection');
        const connections = await CalendarConnection.findByUserId(friendId);
        
        console.log(`Found ${connections.length} calendar connections for friend ${friendId}:`, connections);
        
        if (!connections || connections.length === 0) {
            return res.json({ 
                success: true, 
                message: 'No calendar connections found for friend',
                results: []
            });
        }

        // Force sync each connection
        const CalendarSyncService = require('../services/CalendarSyncService');
        const syncService = new CalendarSyncService();
        
        const results = [];
        for (const connection of connections) {
            console.log(`Processing connection:`, connection);
            try {
                const result = await syncService.syncConnection(connection, true); // forceSync = true
                results.push({
                    connectionId: connection.id,
                    calendarId: connection.calendar_id,
                    success: result.success,
                    message: result.message,
                    eventsCount: result.eventsCount || 0,
                    syncedCount: result.syncedCount || 0,
                    updatedCount: result.updatedCount || 0,
                    deletedCount: result.deletedCount || 0
                });
            } catch (error) {
                console.error(`Error syncing connection ${connection.id}:`, error);
                
                let errorMessage = error.message;
                let needsReauth = false;
                
                // Check if this is a token re-authentication error
                if (error.message === 'TOKEN_INVALID_NEEDS_REAUTH') {
                    errorMessage = 'Calendar access expired - friend needs to re-authenticate';
                    needsReauth = true;
                }
                
                results.push({
                    connectionId: connection.id,
                    calendarId: connection.calendar_id,
                    success: false,
                    message: errorMessage,
                    needsReauth: needsReauth,
                    eventsCount: 0,
                    syncedCount: 0,
                    updatedCount: 0,
                    deletedCount: 0
                });
            }
        }

        res.json({ 
            success: true, 
            message: 'Friend calendar sync completed',
            results
        });

    } catch (error) {
        console.error('Force sync friend calendar error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get friend's calendar events
router.get('/:friendId/calendar', async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendId } = req.params;
        const { start, end, period = 'today' } = req.query;

        // Verify friendship exists
        const friendship = await Friend.checkFriendship(userId, friendId);
        if (!friendship || friendship.status !== 'accepted') {
            return res.status(403).json({ error: 'Not authorized to view this friend\'s calendar' });
        }

        // Get friend's user information
        const friend = await User.findById(friendId);
        if (!friend) {
            return res.status(404).json({ error: 'Friend not found' });
        }

        // Get friend's events
        let startDate, endDate;
        
        if (start && end) {
            startDate = new Date(start);
            endDate = new Date(end);
        } else {
            // Use period-based date range
            const now = new Date();
            switch (period) {
                case 'today':
                    startDate = new Date(now);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(now);
                    endDate.setHours(23, 59, 59, 999);
                    break;
                case 'week':
                    const dayOfWeek = now.getDay();
                    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - daysToMonday);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 6);
                    endDate.setHours(23, 59, 59, 999);
                    break;
                default:
                    startDate = new Date(now);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(now);
                    endDate.setHours(23, 59, 59, 999);
            }
        }

        const events = await CalendarEvent.findByUserId(friendId, {
            startDate: startDate,
            endDate: endDate
        });
        
        // Transform events to match frontend expectations
        const transformedEvents = events.map(event => ({
            id: event.id,
            title: event.title,
            description: event.description,
            location: event.location,
            startTime: event.start_time,
            endTime: event.end_time,
            isAllDay: event.is_all_day,
            status: event.status,
            attendees: event.attendees ? JSON.parse(event.attendees) : [],
            recurrence: event.recurrence,
            calendarId: event.calendar_id,
            calendarName: event.calendar_summary || event.calendar_id || 'Unknown Calendar',
            calendarColor: event.calendar_color || '#4285f4'
        }));
        
        res.json({ 
            success: true, 
            events: transformedEvents,
            friend: {
                id: friend.id,
                name: friend.name,
                email: friend.email
            }
        });

    } catch (error) {
        console.error('Get friend calendar error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router; 