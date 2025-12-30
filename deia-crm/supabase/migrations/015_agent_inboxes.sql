-- Migration: Adicionar suporte a inboxes por agente
-- Descrição: Permite selecionar inboxes no convite e atribuir ao agente

-- Adicionar coluna inbox_ids na tabela de convites
ALTER TABLE team_invites ADD COLUMN IF NOT EXISTS inbox_ids INTEGER[] DEFAULT '{}';

-- Tabela de atribuição de inboxes aos agentes
CREATE TABLE IF NOT EXISTS agent_inbox_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chatwoot_inbox_id INTEGER NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, chatwoot_inbox_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_agent_inbox_user ON agent_inbox_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_inbox_company ON agent_inbox_assignments(company_id);

-- Habilitar RLS
ALTER TABLE agent_inbox_assignments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
-- Usuários podem ver atribuições da sua empresa
CREATE POLICY "Users can view company inbox assignments"
    ON agent_inbox_assignments FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- Admins podem criar atribuições na sua empresa
CREATE POLICY "Admins can insert inbox assignments"
    ON agent_inbox_assignments FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- Admins podem atualizar atribuições na sua empresa
CREATE POLICY "Admins can update inbox assignments"
    ON agent_inbox_assignments FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- Admins podem deletar atribuições na sua empresa
CREATE POLICY "Admins can delete inbox assignments"
    ON agent_inbox_assignments FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );
