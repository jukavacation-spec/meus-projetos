-- Migration: Fix profiles references to users
-- As policies em 005_quick_replies_automations.sql referenciam "profiles" que não existe
-- Deveria ser "users"

-- =============================================
-- FIX QUICK_REPLIES POLICIES
-- =============================================

DROP POLICY IF EXISTS "Users can view quick replies from their company" ON quick_replies;
DROP POLICY IF EXISTS "Users can insert quick replies for their company" ON quick_replies;
DROP POLICY IF EXISTS "Users can update quick replies from their company" ON quick_replies;
DROP POLICY IF EXISTS "Users can delete quick replies from their company" ON quick_replies;

CREATE POLICY "Users can view quick replies from their company"
  ON quick_replies FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert quick replies for their company"
  ON quick_replies FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update quick replies from their company"
  ON quick_replies FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete quick replies from their company"
  ON quick_replies FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- =============================================
-- FIX AUTOMATIONS POLICIES
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
-- FIX AUTOMATION_LOGS POLICIES
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
-- FIX DAILY_METRICS POLICIES
-- =============================================

DROP POLICY IF EXISTS "Users can view metrics from their company" ON daily_metrics;
DROP POLICY IF EXISTS "System can insert metrics" ON daily_metrics;
DROP POLICY IF EXISTS "System can update metrics" ON daily_metrics;

CREATE POLICY "Users can view metrics from their company"
  ON daily_metrics FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert metrics for their company"
  ON daily_metrics FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update metrics from their company"
  ON daily_metrics FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));
