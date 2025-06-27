const db = require('../config/database');

class Friend {
    static async sendRequest(userId, friendId) {
        // First check if both users have valid Google accounts
        const validateQuery = `
            SELECT COUNT(*) as valid_count
            FROM users
            WHERE id IN ($1, $2) AND google_id IS NOT NULL
        `;
        
        try {
            // Validate both users have Google accounts
            const validation = await db.query(validateQuery, [userId, friendId]);
            if (validation.rows[0].valid_count < 2) {
                throw new Error('Both users must have valid Google accounts to send friend requests');
            }

            const query = `
                INSERT INTO friends (user_id, friend_id)
                VALUES ($1, $2)
                RETURNING *
            `;
            
            const result = await db.query(query, [userId, friendId]);
            return result.rows[0];
        } catch (error) {
            if (error.code === '23505') { // Unique violation
                throw new Error('Friend request already exists');
            }
            console.error('Error sending friend request:', error);
            throw error;
        }
    }

    static async acceptRequest(userId, friendId) {
        const query = `
            UPDATE friends 
            SET status = 'accepted'
            WHERE friend_id = $1 AND user_id = $2 AND status = 'pending'
            RETURNING *
        `;
        
        try {
            const result = await db.query(query, [userId, friendId]);
            if (result.rows.length === 0) {
                throw new Error('Friend request not found or already processed');
            }
            return result.rows[0];
        } catch (error) {
            console.error('Error accepting friend request:', error);
            throw error;
        }
    }

    static async rejectRequest(userId, friendId) {
        const query = `
            UPDATE friends 
            SET status = 'rejected'
            WHERE friend_id = $1 AND user_id = $2 AND status = 'pending'
            RETURNING *
        `;
        
        try {
            const result = await db.query(query, [userId, friendId]);
            if (result.rows.length === 0) {
                throw new Error('Friend request not found or already processed');
            }
            return result.rows[0];
        } catch (error) {
            console.error('Error rejecting friend request:', error);
            throw error;
        }
    }

    static async getFriends(userId) {
        const query = `
            SELECT u.id, u.name, u.email, f.created_at as friends_since
            FROM friends f
            JOIN users u ON (
                CASE 
                    WHEN f.user_id = $1 THEN f.friend_id = u.id
                    WHEN f.friend_id = $1 THEN f.user_id = u.id
                END
            )
            WHERE (f.user_id = $1 OR f.friend_id = $1)
            AND f.status = 'accepted'
            ORDER BY f.created_at DESC
        `;
        
        try {
            const result = await db.query(query, [userId]);
            return result.rows;
        } catch (error) {
            console.error('Error getting friends:', error);
            throw new Error('Failed to get friends');
        }
    }

    static async getPendingRequests(userId) {
        const query = `
            SELECT u.id, u.name, u.email, f.created_at as requested_at
            FROM friends f
            JOIN users u ON f.user_id = u.id
            WHERE f.friend_id = $1 AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `;
        
        try {
            const result = await db.query(query, [userId]);
            return result.rows;
        } catch (error) {
            console.error('Error getting pending requests:', error);
            throw new Error('Failed to get pending requests');
        }
    }

    static async getSentRequests(userId) {
        const query = `
            SELECT u.id, u.name, u.email, f.created_at as sent_at
            FROM friends f
            JOIN users u ON f.friend_id = u.id
            WHERE f.user_id = $1 AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `;
        
        try {
            const result = await db.query(query, [userId]);
            return result.rows;
        } catch (error) {
            console.error('Error getting sent requests:', error);
            throw new Error('Failed to get sent requests');
        }
    }

    static async removeFriend(userId, friendId) {
        const query = `
            DELETE FROM friends
            WHERE (
                (user_id = $1 AND friend_id = $2) OR
                (user_id = $2 AND friend_id = $1)
            )
            AND status = 'accepted'
            RETURNING *
        `;
        
        try {
            const result = await db.query(query, [userId, friendId]);
            if (result.rows.length === 0) {
                throw new Error('Friend relationship not found');
            }
            return result.rows[0];
        } catch (error) {
            console.error('Error removing friend:', error);
            throw error;
        }
    }

    static async checkFriendship(userId, friendId) {
        const query = `
            SELECT status
            FROM friends
            WHERE (
                (user_id = $1 AND friend_id = $2) OR
                (user_id = $2 AND friend_id = $1)
            )
        `;
        
        try {
            const result = await db.query(query, [userId, friendId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error checking friendship:', error);
            throw new Error('Failed to check friendship status');
        }
    }
}

module.exports = Friend; 