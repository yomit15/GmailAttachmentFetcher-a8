-- Add new columns to users table for enhanced filtering
ALTER TABLE users ADD COLUMN IF NOT EXISTS file_name_filter TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_from DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_folder TEXT;

-- Add new column to logs table for search query tracking
ALTER TABLE logs ADD COLUMN IF NOT EXISTS search_query TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_file_name_filter ON users(file_name_filter);
CREATE INDEX IF NOT EXISTS idx_users_date_from ON users(date_from);
CREATE INDEX IF NOT EXISTS idx_logs_search_query ON logs(search_query);

-- Update existing users with default date (30 days ago) if not set
UPDATE users 
SET date_from = CURRENT_DATE - INTERVAL '30 days'
WHERE date_from IS NULL;
