-- Create friend request status enum type
CREATE TYPE friend_status AS ENUM ('pending', 'accepted', 'rejected');

-- Create friends table
CREATE TABLE IF NOT EXISTS friends (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status friend_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure a user can't send multiple requests to the same friend
    UNIQUE(user_id, friend_id),
    -- Prevent self-friending
    CONSTRAINT no_self_friend CHECK (user_id != friend_id)
);

-- Create indexes for faster lookups
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_friends_friend_id ON friends(friend_id);
CREATE INDEX idx_friends_status ON friends(status);

-- Create composite index for common queries
CREATE INDEX idx_friends_user_status ON friends(user_id, status);
CREATE INDEX idx_friends_friend_status ON friends(friend_id, status);

-- Create updated_at trigger
CREATE TRIGGER update_friends_updated_at 
    BEFORE UPDATE ON friends 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 