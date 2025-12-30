-- Migration: Remove duplicate UPDATE policy on daily_metrics
-- Problema: Existem duas policies UPDATE para a mesma tabela
--   1. "Users can update metrics for their company" - usa get_user_company_id()
--   2. "Users can update metrics from their company" - usa subquery
-- Solução: Remover a que usa get_user_company_id() e manter a subquery

-- Remover policy duplicada que usa função helper
DROP POLICY IF EXISTS "Users can update metrics for their company" ON daily_metrics;

-- Também corrigir a policy de SELECT que ainda usa get_user_company_id()
DROP POLICY IF EXISTS "Users can view metrics from their company" ON daily_metrics;

CREATE POLICY "Users can view metrics from their company"
  ON daily_metrics FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));
