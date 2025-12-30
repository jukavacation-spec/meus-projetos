-- Migration: Funcionalidades da Aba Equipe
-- Descricao: Adiciona presenca em tempo real, avisos, mensagens privadas e atividades

-- ===========================================
-- TABELA: user_presence
-- Armazena status de presenca em tempo real
-- ===========================================

CREATE TABLE IF NOT EXISTS user_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
    status_text TEXT, -- Ex: "Em reuniao ate 14h"
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_user_presence_company ON user_presence(company_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(company_id, status);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen_at);

-- RLS
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Usuarios podem ver presenca de membros da mesma empresa
CREATE POLICY "Users can view company presence"
    ON user_presence FOR SELECT
    USING (company_id = get_user_company_id());

-- Usuarios podem atualizar sua propria presenca
CREATE POLICY "Users can update own presence"
    ON user_presence FOR UPDATE
    USING (user_id = auth.uid());

-- Usuarios podem inserir sua propria presenca
CREATE POLICY "Users can insert own presence"
    ON user_presence FOR INSERT
    WITH CHECK (user_id = auth.uid() AND company_id = get_user_company_id());

-- ===========================================
-- TABELA: team_announcements
-- Avisos/Post-its da equipe
-- ===========================================

CREATE TABLE IF NOT EXISTS team_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'informativo' CHECK (category IN ('urgente', 'informativo', 'lembrete')),
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_announcements_company ON team_announcements(company_id);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON team_announcements(company_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_author ON team_announcements(author_id);

-- RLS
ALTER TABLE team_announcements ENABLE ROW LEVEL SECURITY;

-- Usuarios podem ver avisos da mesma empresa
CREATE POLICY "Users can view company announcements"
    ON team_announcements FOR SELECT
    USING (company_id = get_user_company_id());

-- Usuarios podem criar avisos na sua empresa
CREATE POLICY "Users can create announcements"
    ON team_announcements FOR INSERT
    WITH CHECK (company_id = get_user_company_id() AND author_id = auth.uid());

-- Usuarios podem deletar seus proprios avisos
CREATE POLICY "Users can delete own announcements"
    ON team_announcements FOR DELETE
    USING (author_id = auth.uid());

-- Admins podem deletar qualquer aviso da empresa
CREATE POLICY "Admins can delete any announcements"
    ON team_announcements FOR DELETE
    USING (
        company_id = get_user_company_id() AND
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
            AND r.name IN ('owner', 'admin')
        )
    );

-- Admins podem atualizar avisos (para fixar/desfixar)
CREATE POLICY "Admins can update announcements"
    ON team_announcements FOR UPDATE
    USING (
        company_id = get_user_company_id() AND
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
            AND r.name IN ('owner', 'admin')
        )
    );

-- ===========================================
-- TABELA: team_messages
-- Mensagens privadas entre membros
-- ===========================================

CREATE TABLE IF NOT EXISTS team_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    deleted_by_sender BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT different_users CHECK (sender_id != receiver_id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_team_messages_conversation ON team_messages(
    company_id,
    LEAST(sender_id, receiver_id),
    GREATEST(sender_id, receiver_id),
    created_at DESC
);
CREATE INDEX IF NOT EXISTS idx_team_messages_receiver_unread ON team_messages(receiver_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_team_messages_sender ON team_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_receiver ON team_messages(receiver_id);

-- RLS
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

-- Usuarios podem ver mensagens que enviaram ou receberam (exceto deletadas pelo sender)
CREATE POLICY "Users can view own messages"
    ON team_messages FOR SELECT
    USING (
        company_id = get_user_company_id() AND
        (sender_id = auth.uid() OR receiver_id = auth.uid()) AND
        NOT (sender_id = auth.uid() AND deleted_by_sender = TRUE)
    );

-- Usuarios podem enviar mensagens para membros da mesma empresa
CREATE POLICY "Users can send messages"
    ON team_messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid() AND
        company_id = get_user_company_id() AND
        EXISTS (
            SELECT 1 FROM users WHERE id = receiver_id AND company_id = get_user_company_id()
        )
    );

-- Usuarios podem atualizar mensagens (marcar como lida ou deletar)
CREATE POLICY "Users can update own messages"
    ON team_messages FOR UPDATE
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- ===========================================
-- TABELA: team_activities
-- Feed de atividades da equipe
-- ===========================================

CREATE TABLE IF NOT EXISTS team_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'came_online', 'went_offline', 'resolved_conversations',
        'status_changed', 'created_announcement', 'sent_message'
    )),
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_activities_company ON team_activities(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user ON team_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON team_activities(activity_type);

-- RLS
ALTER TABLE team_activities ENABLE ROW LEVEL SECURITY;

-- Usuarios podem ver atividades da mesma empresa
CREATE POLICY "Users can view company activities"
    ON team_activities FOR SELECT
    USING (company_id = get_user_company_id());

-- Sistema pode inserir atividades (via triggers)
CREATE POLICY "Allow insert activities"
    ON team_activities FOR INSERT
    WITH CHECK (company_id = get_user_company_id());

-- ===========================================
-- TRIGGERS PARA ATIVIDADES
-- ===========================================

-- Trigger: Log quando presenca muda
CREATE OR REPLACE FUNCTION log_presence_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Apenas loga mudancas de status significativas
    IF OLD IS NULL OR OLD.status != NEW.status THEN
        IF NEW.status = 'online' AND (OLD IS NULL OR OLD.status = 'offline') THEN
            INSERT INTO team_activities (company_id, user_id, activity_type, data)
            VALUES (NEW.company_id, NEW.user_id, 'came_online', '{}');
        ELSIF NEW.status = 'offline' AND OLD IS NOT NULL AND OLD.status != 'offline' THEN
            INSERT INTO team_activities (company_id, user_id, activity_type, data)
            VALUES (NEW.company_id, NEW.user_id, 'went_offline', '{}');
        ELSIF OLD IS NOT NULL AND OLD.status != NEW.status THEN
            INSERT INTO team_activities (company_id, user_id, activity_type, data)
            VALUES (NEW.company_id, NEW.user_id, 'status_changed',
                    jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'status_text', NEW.status_text));
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_presence_activity
    AFTER INSERT OR UPDATE ON user_presence
    FOR EACH ROW
    EXECUTE FUNCTION log_presence_activity();

-- Trigger: Log quando aviso e criado
CREATE OR REPLACE FUNCTION log_announcement_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO team_activities (company_id, user_id, activity_type, data)
    VALUES (NEW.company_id, NEW.author_id, 'created_announcement',
            jsonb_build_object('announcement_id', NEW.id, 'category', NEW.category));
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_announcement_activity
    AFTER INSERT ON team_announcements
    FOR EACH ROW
    EXECUTE FUNCTION log_announcement_activity();

-- ===========================================
-- FUNCAO AUXILIAR: Atualizar updated_at
-- ===========================================

CREATE OR REPLACE FUNCTION update_presence_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_presence_updated_at
    BEFORE UPDATE ON user_presence
    FOR EACH ROW
    EXECUTE FUNCTION update_presence_updated_at();

CREATE TRIGGER trigger_announcement_updated_at
    BEFORE UPDATE ON team_announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_presence_updated_at();

-- ===========================================
-- HABILITAR REALTIME
-- ===========================================

ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE team_announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE team_activities;

-- ===========================================
-- FUNCAO: Limpar atividades antigas (rodar via cron)
-- ===========================================

CREATE OR REPLACE FUNCTION cleanup_old_activities()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM team_activities WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;

-- ===========================================
-- FUNCAO: Marcar usuarios offline por inatividade
-- ===========================================

CREATE OR REPLACE FUNCTION mark_inactive_users_offline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE user_presence
    SET status = 'offline', updated_at = NOW()
    WHERE status != 'offline'
    AND last_seen_at < NOW() - INTERVAL '3 minutes';
END;
$$;
