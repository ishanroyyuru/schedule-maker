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
        const { period = 'week', date } = req.query;
        
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

        // Get date range based on period and optional specific date
        let startDate, endDate;
        
        if (date) {
            // Use the specific date provided (for viewing specific weeks)
            const targetDate = new Date(date);
            const dayOfWeek = targetDate.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate = new Date(targetDate);
            startDate.setDate(targetDate.getDate() - daysToMonday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
        } else {
            // Default to current week if no specific date provided
            const now = new Date();
            switch (period) {
                case 'day':
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

        const CalendarEvent = require('../models/CalendarEvent');
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

// Find common availability times
router.post('/find-times', async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendIds, startDate, endDate, duration, startTime, endTime } = req.body;

        if (!friendIds || !Array.isArray(friendIds) || friendIds.length === 0) {
            return res.status(400).json({ error: 'Friend IDs are required' });
        }

        if (!startDate || !endDate || !duration || !startTime || !endTime) {
            return res.status(400).json({ error: 'All parameters are required' });
        }

        // Validate friend IDs - ensure they are actual friends
        const userFriends = await Friend.getFriends(userId);
        
        // Convert friendIds to integers for comparison
        const friendIdsInt = friendIds.map(id => parseInt(id));
        
        const validFriendIds = userFriends
            .filter(friend => friendIdsInt.includes(friend.id))
            .map(friend => friend.id);

        if (validFriendIds.length !== friendIdsInt.length) {
            console.log('Friend validation failed:', {
                requested: friendIdsInt,
                available: userFriends.map(f => f.id),
                valid: validFriendIds
            });
            return res.status(400).json({ 
                error: 'Some friend IDs are invalid',
                requested: friendIdsInt,
                available: userFriends.map(f => ({ id: f.id, name: f.name }))
            });
        }

        // Parse dates in local time to avoid timezone issues
        const parseLocalDate = (dateStr) => {
            const [year, month, day] = dateStr.split('-').map(Number);
            return new Date(year, month - 1, day); // month is 0-indexed
        };

        const localStartDate = parseLocalDate(startDate);
        const localEndDate = parseLocalDate(endDate);

        // Get busy times for current user
        const userBusyTimes = await CalendarEvent.findByUserId(userId, {
            startDate: localStartDate,
            endDate: localEndDate
        });

        // Get busy times for all friends
        const allFriendBusyTimes = [];
        for (const friendId of validFriendIds) {
            const friendBusyTimes = await CalendarEvent.findByUserId(friendId, {
                startDate: localStartDate,
                endDate: localEndDate
            });
            allFriendBusyTimes.push(...friendBusyTimes);
        }

        // Combine all busy times
        const allBusyTimes = [...userBusyTimes, ...allFriendBusyTimes];

        // Parse time window
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);

        // Find common free times
        const commonFreeTimes = findCommonFreeTimes(
            allBusyTimes,
            localStartDate,
            localEndDate,
            duration,
            startHour * 60 + startMinute,
            endHour * 60 + endMinute
        );

        res.json({ 
            success: true,
            freeTimes: commonFreeTimes,
            totalSlots: commonFreeTimes.length
        });

    } catch (error) {
        console.error('Find times error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function to find common free times
function findCommonFreeTimes(busyTimes, startDate, endDate, durationMinutes, startTimeMinutes, endTimeMinutes) {
    const freeTimes = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dayStart = new Date(currentDate);
        dayStart.setHours(Math.floor(startTimeMinutes / 60), startTimeMinutes % 60, 0, 0);
        
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(Math.floor(endTimeMinutes / 60), endTimeMinutes % 60, 0, 0);
        
        // Get busy times for this day
        const dayBusyTimes = busyTimes.filter(event => {
            const eventStart = new Date(event.start_time);
            const eventEnd = new Date(event.end_time);
            return eventStart.toDateString() === currentDate.toDateString();
        });
        
        // Find free slots for this day
        const dayFreeSlots = findFreeSlotsForDay(dayStart, dayEnd, dayBusyTimes, durationMinutes);
        freeTimes.push(...dayFreeSlots);
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Limit results to reasonable number
    return freeTimes.slice(0, 50);
}

function findFreeSlotsForDay(dayStart, dayEnd, busyTimes, durationMinutes) {
    const freeSlots = [];
    let currentTime = new Date(dayStart);
    
    while (currentTime < dayEnd) {
        const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60000);
        
        if (slotEnd > dayEnd) break;
        
        // Check if this slot conflicts with any busy time
        const hasConflict = busyTimes.some(busy => {
            const busyStart = new Date(busy.start_time);
            const busyEnd = new Date(busy.end_time);
            
            // Check for overlap
            return (currentTime < busyEnd && slotEnd > busyStart);
        });
        
        if (!hasConflict) {
            freeSlots.push({
                start: new Date(currentTime),
                end: new Date(slotEnd),
                duration: durationMinutes
            });
        }
        
        // Move to next potential slot (30-minute increments)
        currentTime.setMinutes(currentTime.getMinutes() + 30);
    }
    
    return freeSlots;
}

module.exports = router; 