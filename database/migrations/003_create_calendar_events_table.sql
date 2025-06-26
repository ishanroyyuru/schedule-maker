-- Create calendar_events table for hybrid storage approach
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calendar_connection_id INTEGER NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
    event_id VARCHAR(255) NOT NULL, -- External event ID from Google Calendar
    title VARCHAR(500) NOT NULL,
    description TEXT,
    location VARCHAR(500),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'confirmed', -- confirmed, tentative, cancelled
    attendees JSONB, -- Store attendees as JSON array
    recurrence JSONB, -- Store recurrence rules as JSON
    color_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, calendar_connection_id, event_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_connection_id ON calendar_events(calendar_connection_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_id ON calendar_events(event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_time ON calendar_events(end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_last_synced ON calendar_events(last_synced_at);

-- Create composite index for time range queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_time_range ON calendar_events(start_time, end_time);

-- Create trigger for calendar_events table (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_calendar_events_updated_at') THEN
        CREATE TRIGGER update_calendar_events_updated_at 
            BEFORE UPDATE ON calendar_events 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$; 