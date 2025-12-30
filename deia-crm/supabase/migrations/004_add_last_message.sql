-- Add last_message and unread_count columns to conversations table
-- for displaying message preview in conversation list

ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS last_message TEXT,
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Index for sorting by unread messages
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations(unread_count) WHERE unread_count > 0;
