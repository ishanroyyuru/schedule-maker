const db = require('../config/database');

class CalendarEvent {
  static async upsert(eventData) {
    const {
      userId,
      calendarConnectionId,
      eventId,
      title,
      description,
      location,
      startTime,
      endTime,
      isAllDay,
      status,
      attendees,
      recurrence,
      colorId
    } = eventData;
    
    const query = `
      INSERT INTO calendar_events (
        user_id, calendar_connection_id, event_id, title, description, 
        location, start_time, end_time, is_all_day, status, 
        attendees, recurrence, color_id, last_synced_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (user_id, calendar_connection_id, event_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        location = EXCLUDED.location,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        is_all_day = EXCLUDED.is_all_day,
        status = EXCLUDED.status,
        attendees = EXCLUDED.attendees,
        recurrence = EXCLUDED.recurrence,
        color_id = EXCLUDED.color_id,
        last_synced_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `;
    
    const values = [
      userId, calendarConnectionId, eventId, title, description,
      location, startTime, endTime, isAllDay, status,
      attendees, recurrence, colorId
    ];
    
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error upserting calendar event:', error);
      throw new Error('Failed to save calendar event');
    }
  }

  static async findByUserId(userId, options = {}) {
    const { startDate, endDate, limit = 100, offset = 0 } = options;
    
    let query = `
      SELECT ce.*, cc.provider, cc.calendar_id, cc.calendar_summary, cc.calendar_color
      FROM calendar_events ce
      JOIN calendar_connections cc ON ce.calendar_connection_id = cc.id
      WHERE ce.user_id = $1 AND cc.calendar_id <> 'primary'
    `;
    
    const values = [userId];
    let paramIndex = 2;
    
    if (startDate) {
      query += ` AND ce.end_time >= $${paramIndex}`;
      values.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      query += ` AND ce.start_time <= $${paramIndex}`;
      values.push(endDate);
      paramIndex++;
    }
    
    query += ` ORDER BY ce.start_time ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);
    
    try {
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error finding calendar events by user ID:', error);
      throw new Error('Failed to find calendar events');
    }
  }

  static async findByConnectionId(connectionId, options = {}) {
    const { startDate, endDate, limit = 100, offset = 0 } = options;
    
    let query = `
      SELECT * FROM calendar_events 
      WHERE calendar_connection_id = $1
    `;
    
    const values = [connectionId];
    let paramIndex = 2;
    
    if (startDate) {
      query += ` AND end_time >= $${paramIndex}`;
      values.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      query += ` AND start_time <= $${paramIndex}`;
      values.push(endDate);
      paramIndex++;
    }
    
    query += ` ORDER BY start_time ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);
    
    try {
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error finding calendar events by connection ID:', error);
      throw new Error('Failed to find calendar events');
    }
  }

  static async findByEventId(userId, calendarConnectionId, eventId) {
    const query = `
      SELECT * FROM calendar_events 
      WHERE user_id = $1 AND calendar_connection_id = $2 AND event_id = $3
    `;
    
    try {
      const result = await db.query(query, [userId, calendarConnectionId, eventId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding calendar event by event ID:', error);
      throw new Error('Failed to find calendar event');
    }
  }

  static async findStaleEvents(syncThreshold = '1 hour') {
    const query = `
      SELECT ce.*, cc.provider, cc.calendar_id
      FROM calendar_events ce
      JOIN calendar_connections cc ON ce.calendar_connection_id = cc.id
      WHERE ce.last_synced_at < NOW() - INTERVAL '${syncThreshold}'
      ORDER BY ce.last_synced_at ASC
    `;
    
    try {
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error finding stale calendar events:', error);
      throw new Error('Failed to find stale calendar events');
    }
  }

  static async deleteByEventId(userId, calendarConnectionId, eventId) {
    const query = `
      DELETE FROM calendar_events 
      WHERE user_id = $1 AND calendar_connection_id = $2 AND event_id = $3
      RETURNING *
    `;
    
    try {
      const result = await db.query(query, [userId, calendarConnectionId, eventId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  static async deleteByConnectionId(connectionId) {
    const query = 'DELETE FROM calendar_events WHERE calendar_connection_id = $1 RETURNING *';
    
    try {
      const result = await db.query(query, [connectionId]);
      return result.rows;
    } catch (error) {
      console.error('Error deleting calendar events by connection ID:', error);
      throw new Error('Failed to delete calendar events');
    }
  }

  static async updateLastSynced(id) {
    const query = `
      UPDATE calendar_events 
      SET last_synced_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    try {
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating last synced timestamp:', error);
      throw new Error('Failed to update last synced timestamp');
    }
  }

  static async findConflicts(userId, startTime, endTime, excludeEventId = null) {
    let query = `
      SELECT * FROM calendar_events 
      WHERE user_id = $1 
      AND status != 'cancelled'
      AND (
        (start_time < $3 AND end_time > $2) OR
        (start_time >= $2 AND start_time < $3) OR
        (end_time > $2 AND end_time <= $3)
      )
    `;
    
    const values = [userId, startTime, endTime];
    
    if (excludeEventId) {
      query += ` AND event_id != $4`;
      values.push(excludeEventId);
    }
    
    query += ` ORDER BY start_time ASC`;
    
    try {
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error finding calendar conflicts:', error);
      throw new Error('Failed to find calendar conflicts');
    }
  }

  static async getAvailability(userId, startDate, endDate) {
    const query = `
      SELECT 
        date_series.date,
        COALESCE(
          json_agg(
            json_build_object(
              'start_time', ce.start_time,
              'end_time', ce.end_time,
              'title', ce.title
            ) ORDER BY ce.start_time
          ) FILTER (WHERE ce.id IS NOT NULL),
          '[]'::json
        ) as events
      FROM generate_series($2::date, $3::date, '1 day'::interval) as date_series(date)
      LEFT JOIN calendar_events ce ON 
        ce.user_id = $1 
        AND ce.status != 'cancelled'
        AND DATE(ce.start_time) = date_series.date
      GROUP BY date_series.date
      ORDER BY date_series.date
    `;
    
    try {
      const result = await db.query(query, [userId, startDate, endDate]);
      return result.rows;
    } catch (error) {
      console.error('Error getting availability:', error);
      throw new Error('Failed to get availability');
    }
  }
}

module.exports = CalendarEvent; 