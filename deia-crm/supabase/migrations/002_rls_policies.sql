-- ===========================================
-- ROW LEVEL SECURITY (Multi-tenant)
-- ===========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- FUNCAO HELPER
-- ===========================================

-- Funcao para pegar company_id do usuario atual
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
    SELECT company_id FROM users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ===========================================
-- POLICIES - COMPANIES
-- ===========================================

-- Usuarios podem ver sua propria empresa
CREATE POLICY "Users can view their own company"
ON companies FOR SELECT
USING (id = get_user_company_id());

-- Owners podem atualizar sua empresa
CREATE POLICY "Owners can update their company"
ON companies FOR UPDATE
USING (id = get_user_company_id());

-- ===========================================
-- POLICIES - USERS
-- ===========================================

-- Usuarios podem ver membros da mesma empresa
CREATE POLICY "Users can view team members"
ON users FOR SELECT
USING (company_id = get_user_company_id());

-- Usuarios podem atualizar seu proprio perfil
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (id = auth.uid());

-- Permitir insert para novos usuarios (durante signup)
CREATE POLICY "Allow insert for new users"
ON users FOR INSERT
WITH CHECK (id = auth.uid());

-- ===========================================
-- POLICIES - ROLES
-- ===========================================

CREATE POLICY "Users can view roles from their company"
ON roles FOR SELECT
USING (company_id = get_user_company_id());

-- ===========================================
-- POLICIES - CONTACTS
-- ===========================================

CREATE POLICY "Users can view contacts from their company"
ON contacts FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert contacts in their company"
ON contacts FOR INSERT
WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update contacts from their company"
ON contacts FOR UPDATE
USING (company_id = get_user_company_id());

CREATE POLICY "Users can delete contacts from their company"
ON contacts FOR DELETE
USING (company_id = get_user_company_id());

-- ===========================================
-- POLICIES - CONVERSATIONS
-- ===========================================

CREATE POLICY "Users can view conversations from their company"
ON conversations FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert conversations in their company"
ON conversations FOR INSERT
WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update conversations from their company"
ON conversations FOR UPDATE
USING (company_id = get_user_company_id());

-- ===========================================
-- POLICIES - TIMELINE_EVENTS
-- ===========================================

CREATE POLICY "Users can view timeline from their company"
ON timeline_events FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert timeline events in their company"
ON timeline_events FOR INSERT
WITH CHECK (company_id = get_user_company_id());

-- ===========================================
-- POLICIES - KANBAN_STAGES
-- ===========================================

CREATE POLICY "Users can view kanban stages from their company"
ON kanban_stages FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can manage kanban stages from their company"
ON kanban_stages FOR ALL
USING (company_id = get_user_company_id());

-- ===========================================
-- POLICIES - QUICK_REPLIES
-- ===========================================

CREATE POLICY "Users can view quick replies from their company"
ON quick_replies FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can manage quick replies from their company"
ON quick_replies FOR ALL
USING (company_id = get_user_company_id());

-- ===========================================
-- POLICIES - TAGS
-- ===========================================

CREATE POLICY "Users can view tags from their company"
ON tags FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can manage tags from their company"
ON tags FOR ALL
USING (company_id = get_user_company_id());
