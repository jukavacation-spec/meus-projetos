-- Migration: Add chatwoot_agent_id to team_invites
-- Purpose: Store the Chatwoot agent ID when invite is created (not when accepted)

ALTER TABLE team_invites
ADD COLUMN IF NOT EXISTS chatwoot_agent_id INTEGER;

COMMENT ON COLUMN team_invites.chatwoot_agent_id IS 'Chatwoot agent ID created when invite is sent';
