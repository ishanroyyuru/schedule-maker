-- Add calendar_summary column to calendar_connections table
ALTER TABLE calendar_connections 
ADD COLUMN IF NOT EXISTS calendar_summary VARCHAR(255);

-- Update existing records to use calendar_id as summary if summary is null
UPDATE calendar_connections 
SET calendar_summary = calendar_id 
WHERE calendar_summary IS NULL; 