-- Add calendar_color column to calendar_connections table
ALTER TABLE calendar_connections 
ADD COLUMN IF NOT EXISTS calendar_color VARCHAR(50);

-- Set default colors for existing records
UPDATE calendar_connections 
SET calendar_color = '#4285f4' 
WHERE calendar_color IS NULL; 