const db = require('../config/database');

class CalendarConnection {
  // Insert or update a connection. Crucially, we DO NOT clobber an existing
  // refresh_token with NULL when Google doesn't return a new one.
  static async upsert(connectionData) {
    const {
      userId,
      provider,
      accessToken,
      refreshToken,
      expiresAt,
      calendarId,
      calendarName,
      calendarColor
    } = connectionData;

    const query = `
      INSERT INTO calendar_connections (
        user_id, provider, access_token, refresh_token, expires_at,
        calendar_id, calendar_summary, calendar_color, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (user_id, provider, calendar_id)
      DO UPDATE SET
        access_token     = EXCLUDED.access_token,
        refresh_token    = COALESCE(EXCLUDED.refresh_token, calendar_connections.refresh_token),
        expires_at       = EXCLUDED.expires_at,
        calendar_summary = COALESCE(EXCLUDED.calendar_summary, calendar_connections.calendar_summary),
        calendar_color   = COALESCE(EXCLUDED.calendar_color,   calendar_connections.calendar_color),
        updated_at       = NOW()
      RETURNING *;
    `;

    const values = [
      userId,
      provider,
      accessToken,
      refreshToken || null,
      expiresAt,
      calendarId,
      calendarName || calendarId,
      calendarColor || '#4285f4'
    ];

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
      RETURNING *;
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

  static async updateRefreshToken(oldRefreshToken, newRefreshToken) {
    const query = `
      UPDATE calendar_connections 
      SET refresh_token = $2, updated_at = NOW()
      WHERE refresh_token = $1
      RETURNING *;
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

  // Mark a connection as needing user re-auth (used on invalid_grant).
  // If your table doesn't have these columns yet, we just warn and continue.
  static async markReauthRequired(id, reason = 'invalid_grant') {
    const query = `
      UPDATE calendar_connections
      SET status = 'REAUTH_REQUIRED',
          last_error = $2,
          last_error_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    try {
      const result = await db.query(query, [id, String(reason).slice(0, 512)]);
      return result.rows[0] || null;
    } catch (err) {
      if (err.code === '42703') { // undefined_column
        console.warn('[CalendarConnection] markReauthRequired skipped; status/last_error columns not present.');
        return null;
      }
      console.error('Error marking connection reauth-required:', err);
      return null; // don't explode background sync
    }
  }

  // Clear error/status when things are good again
  static async markActive(id) {
    const query = `
      UPDATE calendar_connections
      SET status = 'ACTIVE',
          last_error = NULL,
          last_error_at = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    try {
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    } catch (err) {
      if (err.code === '42703') {
        console.warn('[CalendarConnection] markActive skipped; status/last_error columns not present.');
        return null;
      }
      console.error('Error marking connection active:', err);
      return null;
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
      ORDER BY expires_at ASC;
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

  // Optional helper if you want to fetch only active connections.
  static async findAllActive() {
    const q = `
      SELECT * FROM calendar_connections
      WHERE status IS DISTINCT FROM 'REAUTH_REQUIRED'
      ORDER BY created_at DESC;
    `;
    try {
      const result = await db.query(q);
      return result.rows;
    } catch (err) {
      if (err.code === '42703') {
        // No status column -> fall back to all
        const fallback = await db.query('SELECT * FROM calendar_connections ORDER BY created_at DESC;');
        return fallback.rows;
      }
      console.error('Error finding active calendar connections:', err);
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
