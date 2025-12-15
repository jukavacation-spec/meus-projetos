-- ===========================================
-- FUNCOES E TRIGGERS
-- ===========================================

-- Funcao para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- FUNCAO PARA CRIAR USUARIO APOS SIGNUP
-- ===========================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar usuario na tabela public.users
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===========================================
-- FUNCAO PARA CRIAR ROLES E KANBAN STAGES PADRAO
-- ===========================================

CREATE OR REPLACE FUNCTION create_default_company_data()
RETURNS TRIGGER AS $$
DECLARE
    owner_role_id UUID;
BEGIN
    -- Criar roles padrao
    INSERT INTO roles (company_id, name, display_name, is_system, permissions) VALUES
    (NEW.id, 'owner', 'Proprietario', TRUE, '{
        "contacts": {"read": true, "write": true, "delete": true},
        "kanban": {"read": true, "move": true, "configure": true},
        "team": {"read": true, "manage": true},
        "settings": {"read": true, "write": true},
        "reports": {"read": true},
        "billing": {"read": true, "write": true}
    }'::jsonb)
    RETURNING id INTO owner_role_id;

    INSERT INTO roles (company_id, name, display_name, is_system, permissions) VALUES
    (NEW.id, 'admin', 'Administrador', TRUE, '{
        "contacts": {"read": true, "write": true, "delete": true},
        "kanban": {"read": true, "move": true, "configure": true},
        "team": {"read": true, "manage": true},
        "settings": {"read": true, "write": true},
        "reports": {"read": true},
        "billing": {"read": false, "write": false}
    }'::jsonb),
    (NEW.id, 'supervisor', 'Supervisor', TRUE, '{
        "contacts": {"read": true, "write": true, "delete": false},
        "kanban": {"read": true, "move": true, "configure": false},
        "team": {"read": true, "manage": false},
        "settings": {"read": true, "write": false},
        "reports": {"read": true},
        "billing": {"read": false, "write": false}
    }'::jsonb),
    (NEW.id, 'agent', 'Agente', TRUE, '{
        "contacts": {"read": true, "write": true, "delete": false},
        "kanban": {"read": true, "move": true, "configure": false},
        "team": {"read": true, "manage": false},
        "settings": {"read": false, "write": false},
        "reports": {"read": false},
        "billing": {"read": false, "write": false}
    }'::jsonb),
    (NEW.id, 'viewer', 'Visualizador', TRUE, '{
        "contacts": {"read": true, "write": false, "delete": false},
        "kanban": {"read": true, "move": false, "configure": false},
        "team": {"read": true, "manage": false},
        "settings": {"read": false, "write": false},
        "reports": {"read": true},
        "billing": {"read": false, "write": false}
    }'::jsonb);

    -- Criar estagios padrao do Kanban
    INSERT INTO kanban_stages (company_id, name, slug, description, color, position, is_initial, is_final) VALUES
    (NEW.id, 'Novo', 'novo', 'Leads que acabaram de chegar', '#6366f1', 0, TRUE, FALSE),
    (NEW.id, 'Triagem', 'triagem', 'Em processo de qualificacao', '#f59e0b', 1, FALSE, FALSE),
    (NEW.id, 'Em Atendimento', 'em-atendimento', 'Atendimento em andamento', '#3b82f6', 2, FALSE, FALSE),
    (NEW.id, 'Aguardando Cliente', 'aguardando-cliente', 'Esperando retorno do cliente', '#8b5cf6', 3, FALSE, FALSE),
    (NEW.id, 'Proposta Enviada', 'proposta-enviada', 'Proposta/orcamento enviado', '#ec4899', 4, FALSE, FALSE),
    (NEW.id, 'Fechado - Ganho', 'fechado-ganho', 'Negocio fechado com sucesso', '#22c55e', 5, FALSE, TRUE),
    (NEW.id, 'Fechado - Perdido', 'fechado-perdido', 'Negocio perdido', '#ef4444', 6, FALSE, TRUE);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar dados padrao quando empresa e criada
CREATE TRIGGER on_company_created
    AFTER INSERT ON companies
    FOR EACH ROW EXECUTE FUNCTION create_default_company_data();

-- ===========================================
-- FUNCAO PARA REGISTRAR MUDANCA DE STAGE NA TIMELINE
-- ===========================================

CREATE OR REPLACE FUNCTION log_stage_change()
RETURNS TRIGGER AS $$
DECLARE
    old_stage_name TEXT;
    new_stage_name TEXT;
BEGIN
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        -- Buscar nomes dos estagios
        SELECT name INTO old_stage_name FROM kanban_stages WHERE id = OLD.stage_id;
        SELECT name INTO new_stage_name FROM kanban_stages WHERE id = NEW.stage_id;

        INSERT INTO timeline_events (
            company_id,
            contact_id,
            conversation_id,
            event_type,
            data
        ) VALUES (
            NEW.company_id,
            NEW.contact_id,
            NEW.id,
            'stage_changed',
            jsonb_build_object(
                'from', COALESCE(old_stage_name, 'Sem estagio'),
                'to', COALESCE(new_stage_name, 'Sem estagio'),
                'from_id', OLD.stage_id,
                'to_id', NEW.stage_id
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_conversation_stage_changed
    AFTER UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION log_stage_change();
