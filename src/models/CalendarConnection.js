const db = require('../config/database');

class CalendarConnection {
  static async upsert(connectionData) {
    const { userId, provider, accessToken, refreshToken, expiresAt, calendarId, calendarName, calendarColor } = connectionData;
    
    const query = `
      INSERT INTO calendar_connections (user_id, provider, access_token, refresh_token, expires_at, calendar_id, calendar_summary, calendar_color, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (user_id, provider, calendar_id)
      DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        calendar_summary = EXCLUDED.calendar_summary,
        calendar_color = EXCLUDED.calendar_color,
        updated_at = NOW()
      RETURNING *
    `;
    
    const values = [userId, provider, accessToken, refreshToken, expiresAt, calendarId, calendarName || calendarId, calendarColor || '#4285f4'];
    
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error upserting calendar connection:', error);
      throw new Error('Failed to save calendar connection');
    }
  }

  static async findByUserId(userId) {
    const query = 'SELECT * FROM calendar_connections WHERE user_id = $1 ORDER BY created_at DESC';
    
    try {
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error finding calendar connections by user ID:', error);
      throw new Error('Failed to find calendar connections');
    }
  }

  static async findById(id) {
    const query = 'SELECT * FROM calendar_connections WHERE id = $1';
    
    try {
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding calendar connection by ID:', error);
      throw new Error('Failed to find calendar connection');
    }
  }

  static async findByUserAndProvider(userId, provider) {
    const query = 'SELECT * FROM calendar_connections WHERE user_id = $1 AND provider = $2';
    
    try {
      const result = await db.query(query, [userId, provider]);
      return result.rows;
    } catch (error) {
      console.error('Error finding calendar connections by user and provider:', error);
      throw new Error('Failed to find calendar connections');
    }
  }

  static async updateAccessToken(id, accessToken, expiresAt) {
    const query = `
      UPDATE calendar_connections 
      SET access_token = $2, expires_at = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [id, accessToken, expiresAt];
    
    try {
      const result = await db.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating access token:', error);
      throw new Error('Failed to update access token');
    }
  }

  static async updateLastSync(id) {
    const query = `
      UPDATE calendar_connections 
      SET updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    try {
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating last sync:', error);
      throw new Error('Failed to update last sync');
    }
  }

  static async updateRefreshToken(oldRefreshToken, newRefreshToken) {
    const query = `
      UPDATE calendar_connections 
      SET refresh_token = $2, updated_at = NOW()
      WHERE refresh_token = $1
      RETURNING *
    `;
    
    const values = [oldRefreshToken, newRefreshToken];
    
    try {
      const result = await db.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating refresh token:', error);
      throw new Error('Failed to update refresh token');
    }
  }

  static async delete(id) {
    const query = 'DELETE FROM calendar_connections WHERE id = $1 RETURNING *';
    
    try {
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error deleting calendar connection:', error);
      throw new Error('Failed to delete calendar connection');
    }
  }

  static async deleteByUserAndProvider(userId, provider) {
    const query = 'DELETE FROM calendar_connections WHERE user_id = $1 AND provider = $2 RETURNING *';
    
    try {
      const result = await db.query(query, [userId, provider]);
      return result.rows;
    } catch (error) {
      console.error('Error deleting calendar connections by user and provider:', error);
      throw new Error('Failed to delete calendar connections');
    }
  }

  static async findExpiredTokens() {
    const query = `
      SELECT * FROM calendar_connections 
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
      ORDER BY expires_at ASC
    `;
    
    try {
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error finding expired tokens:', error);
      throw new Error('Failed to find expired tokens');
    }
  }

  static async findByCalendarId(calendarId) {
    const query = 'SELECT * FROM calendar_connections WHERE calendar_id = $1';
    
    try {
      const result = await db.query(query, [calendarId]);
      return result.rows;
    } catch (error) {
      console.error('Error finding calendar connections by calendar ID:', error);
      throw new Error('Failed to find calendar connections');
    }
  }

  static async findAll() {
    const query = 'SELECT * FROM calendar_connections ORDER BY created_at DESC';
    
    try {
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error finding all calendar connections:', error);
      throw new Error('Failed to find calendar connections');
    }
  }
}

module.exports = CalendarConnection; 