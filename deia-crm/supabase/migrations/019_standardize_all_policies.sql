-- =============================================
-- Migration: Standardize ALL policies to use subquery
-- Substitui get_user_company_id() por subquery direta
-- Isso evita problemas quando a função retorna NULL
-- =============================================

-- =============================================
-- AUTOMATION_LOGS
-- =============================================
DROP POLICY IF EXISTS "Users can view automation logs from their company" ON automation_logs;

CREATE POLICY "Users can view automation logs from their company"
  ON automation_logs FOR SELECT
  USING (automation_id IN (
    SELECT id FROM automations WHERE company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  ));

-- =============================================
-- AUTOMATIONS
-- =============================================
DROP POLICY IF EXISTS "Users can view automations from their company" ON automations;
DROP POLICY IF EXISTS "Users can insert automations for their company" ON automations;
DROP POLICY IF EXISTS "Users can update automations from their company" ON automations;
DROP POLICY IF EXISTS "Users can delete automations from their company" ON automations;

CREATE POLICY "Users can view automations from their company"
  ON automations FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert automations for their company"
  ON automations FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update automations from their company"
  ON automations FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete automations from their company"
  ON automations FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- COMPANIES
-- =============================================
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Owners can update their company" ON companies;

CREATE POLICY "Users can view their own company"
  ON companies FOR SELECT
  USING (id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Owners can update their company"
  ON companies FOR UPDATE
  USING (id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- CONTACTS
-- =============================================
DROP POLICY IF EXISTS "Users can view contacts from their company" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts in their company" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts from their company" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts from their company" ON contacts;

CREATE POLICY "Users can view contacts from their company"
  ON contacts FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert contacts in their company"
  ON contacts FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update contacts from their company"
  ON contacts FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete contacts from their company"
  ON contacts FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- CONVERSATIONS
-- =============================================
DROP POLICY IF EXISTS "Users can view conversations from their company" ON conversations;
DROP POLICY IF EXISTS "Users can insert conversations in their company" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations from their company" ON conversations;

CREATE POLICY "Users can view conversations from their company"
  ON conversations FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert conversations in their company"
  ON conversations FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update conversations from their company"
  ON conversations FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- DAILY_METRICS (fix duplicate + standardize)
-- =============================================
DROP POLICY IF EXISTS "Users can view metrics from their company" ON daily_metrics;
DROP POLICY IF EXISTS "Users can update metrics for their company" ON daily_metrics;

CREATE POLICY "Users can view metrics from their company"
  ON daily_metrics FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- INSTANCES
-- =============================================
DROP POLICY IF EXISTS "Users can view their company instances" ON instances;
DROP POLICY IF EXISTS "Users can insert instances for their company" ON instances;
DROP POLICY IF EXISTS "Users can update their company instances" ON instances;
DROP POLICY IF EXISTS "Users can delete their company instances" ON instances;

CREATE POLICY "Users can view their company instances"
  ON instances FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert instances for their company"
  ON instances FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update their company instances"
  ON instances FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete their company instances"
  ON instances FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- KANBAN_STAGES
-- =============================================
DROP POLICY IF EXISTS "Users can view kanban stages from their company" ON kanban_stages;
DROP POLICY IF EXISTS "Users can manage kanban stages from their company" ON kanban_stages;

CREATE POLICY "Users can view kanban stages from their company"
  ON kanban_stages FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage kanban stages from their company"
  ON kanban_stages FOR ALL
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- QUICK_REPLIES
-- =============================================
DROP POLICY IF EXISTS "Users can view quick replies from their company" ON quick_replies;
DROP POLICY IF EXISTS "Users can manage quick replies from their company" ON quick_replies;

CREATE POLICY "Users can view quick replies from their company"
  ON quick_replies FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage quick replies from their company"
  ON quick_replies FOR ALL
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- ROLES
-- =============================================
DROP POLICY IF EXISTS "Users can view roles from their company" ON roles;

CREATE POLICY "Users can view roles from their company"
  ON roles FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- TAGS
-- =============================================
DROP POLICY IF EXISTS "Users can view tags from their company" ON tags;
DROP POLICY IF EXISTS "Users can manage tags from their company" ON tags;

CREATE POLICY "Users can view tags from their company"
  ON tags FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can manage tags from their company"
  ON tags FOR ALL
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- TEAM_ACTIVITIES
-- =============================================
DROP POLICY IF EXISTS "Users can view company activities" ON team_activities;
DROP POLICY IF EXISTS "Allow insert activities" ON team_activities;

CREATE POLICY "Users can view company activities"
  ON team_activities FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Allow insert activities"
  ON team_activities FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- TEAM_ANNOUNCEMENTS
-- =============================================
DROP POLICY IF EXISTS "Users can view company announcements" ON team_announcements;
DROP POLICY IF EXISTS "Users can create announcements" ON team_announcements;
DROP POLICY IF EXISTS "Admins can update announcements" ON team_announcements;
DROP POLICY IF EXISTS "Admins can delete any announcements" ON team_announcements;

CREATE POLICY "Users can view company announcements"
  ON team_announcements FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create announcements"
  ON team_announcements FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    AND author_id = auth.uid()
  );

CREATE POLICY "Admins can update announcements"
  ON team_announcements FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = ANY(ARRAY['owner', 'admin'])
    )
  );

CREATE POLICY "Admins can delete any announcements"
  ON team_announcements FOR DELETE
  USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = auth.uid()
      AND r.name = ANY(ARRAY['owner', 'admin'])
    )
  );

-- =============================================
-- TEAM_INVITES
-- =============================================
DROP POLICY IF EXISTS "Users can view invites from their company" ON team_invites;
DROP POLICY IF EXISTS "Users can create invites in their company" ON team_invites;
DROP POLICY IF EXISTS "Users can update invites from their company" ON team_invites;
DROP POLICY IF EXISTS "Users can delete invites from their company" ON team_invites;

CREATE POLICY "Users can view invites from their company"
  ON team_invites FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can create invites in their company"
  ON team_invites FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update invites from their company"
  ON team_invites FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete invites from their company"
  ON team_invites FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- TEAM_MESSAGES
-- =============================================
DROP POLICY IF EXISTS "Users can view own messages" ON team_messages;
DROP POLICY IF EXISTS "Users can send messages" ON team_messages;

CREATE POLICY "Users can view own messages"
  ON team_messages FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    AND NOT (sender_id = auth.uid() AND deleted_by_sender = true)
  );

CREATE POLICY "Users can send messages"
  ON team_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = team_messages.receiver_id
      AND company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    )
  );

-- =============================================
-- TIMELINE_EVENTS
-- =============================================
DROP POLICY IF EXISTS "Users can view timeline from their company" ON timeline_events;
DROP POLICY IF EXISTS "Users can insert timeline events in their company" ON timeline_events;

CREATE POLICY "Users can view timeline from their company"
  ON timeline_events FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert timeline events in their company"
  ON timeline_events FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- USER_PRESENCE
-- =============================================
DROP POLICY IF EXISTS "Users can view company presence" ON user_presence;
DROP POLICY IF EXISTS "Users can insert own presence" ON user_presence;

CREATE POLICY "Users can view company presence"
  ON user_presence FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own presence"
  ON user_presence FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- =============================================
-- USERS
-- =============================================
DROP POLICY IF EXISTS "Users can view team members" ON users;

CREATE POLICY "Users can view team members"
  ON users FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));
