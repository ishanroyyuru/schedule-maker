#!/usr/bin/env node

/**
 * Script to clear expired Google OAuth tokens
 * Run this when you get 'invalid_grant' errors
 */

const db = require('../src/config/database');

async function clearExpiredTokens() {
  try {
    console.log('🔍 Finding expired calendar connections...');
    
    // Find connections with expired tokens
    const expiredQuery = `
      SELECT id, user_id, calendar_id, expires_at, updated_at 
      FROM calendar_connections 
      WHERE expires_at < NOW() 
      OR updated_at < NOW() - INTERVAL '30 days'
      ORDER BY expires_at ASC
    `;
    
    const expiredResult = await db.query(expiredQuery);
    const expiredConnections = expiredResult.rows;
    
    if (expiredConnections.length === 0) {
      console.log('✅ No expired connections found');
      return;
    }
    
    console.log(`📅 Found ${expiredConnections.length} expired connections:`);
    expiredConnections.forEach(conn => {
      console.log(`  - ID: ${conn.id}, Calendar: ${conn.calendar_id}, Expired: ${conn.expires_at}`);
    });
    
    // Clear the expired tokens
    const clearQuery = `
      UPDATE calendar_connections 
      SET access_token = NULL, refresh_token = NULL, expires_at = NULL
      WHERE expires_at < NOW() 
      OR updated_at < NOW() - INTERVAL '30 days'
    `;
    
    const clearResult = await db.query(clearQuery);
    console.log(`🗑️  Cleared ${clearResult.rowCount} expired connections`);
    
    console.log('\n📋 Next steps:');
    console.log('1. Users with cleared tokens will need to re-authenticate with Google');
    console.log('2. They should go through the OAuth flow again');
    console.log('3. This will generate fresh, valid tokens');
    
  } catch (error) {
    console.error('❌ Error clearing expired tokens:', error);
  } finally {
    // Close the pool properly
    await db.pool.end();
  }
}

// Run the script
clearExpiredTokens().catch(console.error); 