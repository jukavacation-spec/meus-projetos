-- ===========================================
-- FIX: RLS Policy for roles table
-- ===========================================
-- O problema é que a função get_user_company_id() pode retornar NULL
-- em alguns contextos, bloqueando a leitura dos roles.
-- Esta migration substitui a policy por uma versão mais robusta.

-- Remover policy antiga
DROP POLICY IF EXISTS "Users can view roles from their company" ON roles;

-- Criar nova policy mais robusta
-- Usa subquery direta ao invés de função helper
CREATE POLICY "Users can view roles from their company"
ON roles FOR SELECT
USING (
  company_id IN (
    SELECT u.company_id FROM users u WHERE u.id = auth.uid()
  )
);

-- Também permitir que usuários autenticados vejam roles durante o signup/onboarding
-- quando ainda não têm company_id definido (edge case)
-- Isso é seguro porque roles são apenas metadados de configuração
