-- Add Gmail folder column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS gmail_folder TEXT;

-- Add Gmail folder tracking to logs table
ALTER TABLE logs ADD COLUMN IF NOT EXISTS gmail_folder TEXT;
ALTER TABLE logs ADD COLUMN IF NOT EXISTS gmail_folder_name TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_gmail_folder ON users(gmail_folder);
CREATE INDEX IF NOT EXISTS idx_logs_gmail_folder ON logs(gmail_folder);

-- Set default Gmail folder to INBOX for existing users
UPDATE users 
SET gmail_folder = 'INBOX'
WHERE gmail_folder IS NULL;
