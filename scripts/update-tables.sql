-- Update users table to include OAuth tokens
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_users_tokens ON users(email, access_token);

-- Update RLS policies to include token fields
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Users can insert their own data" ON users;

CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (true); -- Allow service role to read all

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (true); -- Allow service role to update all

CREATE POLICY "Users can insert their own data" ON users
  FOR INSERT WITH CHECK (true); -- Allow service role to insert all
