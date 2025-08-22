require('dotenv').config();
const db = require('../src/config/database');

async function clearExpiredTokens() {
    try {
        console.log('Connecting to database...');
        
        // Find connections with expired tokens
        const expiredQuery = `
            SELECT id, user_id, calendar_id, expires_at 
            FROM calendar_connections 
            WHERE expires_at < NOW() 
            OR refresh_token IS NULL 
            OR refresh_token = ''
        `;
        
        const expiredResult = await db.query(expiredQuery);
        console.log(`Found ${expiredResult.rows.length} expired/revoked connections`);
        
        if (expiredResult.rows.length === 0) {
            console.log('No expired tokens found');
            return;
        }
        
        // Clear the expired tokens
        const clearQuery = `
            UPDATE calendar_connections 
            SET access_token = '', 
                refresh_token = '', 
                expires_at = NULL,
                updated_at = NOW()
            WHERE expires_at < NOW() 
            OR refresh_token IS NULL 
            OR refresh_token = ''
        `;
        
        const clearResult = await db.query(clearQuery);
        console.log(`Cleared ${clearResult.rowCount} expired connections`);
        
        // Show what was cleared
        expiredResult.rows.forEach(row => {
            console.log(`- Connection ${row.id} (User ${row.user_id}, Calendar: ${row.calendar_id})`);
        });
        
        console.log('✅ Expired tokens cleared successfully');
        
    } catch (error) {
        console.error('❌ Error clearing expired tokens:', error);
    } finally {
        await db.pool.end();
        console.log('Database connection closed');
    }
}

clearExpiredTokens(); 