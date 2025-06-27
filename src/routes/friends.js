const express = require('express');
const Friend = require('../models/Friend');
const User = require('../models/User');
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

module.exports = router; 