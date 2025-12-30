-- Migration: Company Inbox Settings
-- Armazena quais inboxes do Chatwoot estão ativas para cada empresa

CREATE TABLE IF NOT EXISTS company_inbox_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    chatwoot_inbox_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Cada empresa só pode ter uma configuração por inbox
    UNIQUE(company_id, chatwoot_inbox_id)
);

-- Índices
CREATE INDEX idx_inbox_settings_company ON company_inbox_settings(company_id);
CREATE INDEX idx_inbox_settings_active ON company_inbox_settings(company_id, is_active);

-- RLS
ALTER TABLE company_inbox_settings ENABLE ROW LEVEL SECURITY;

-- Policy: usuários podem ver/editar settings da própria empresa
CREATE POLICY "Users can view own company inbox settings"
    ON company_inbox_settings FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own company inbox settings"
    ON company_inbox_settings FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update own company inbox settings"
    ON company_inbox_settings FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own company inbox settings"
    ON company_inbox_settings FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- Trigger para updated_at
CREATE TRIGGER update_inbox_settings_updated_at
    BEFORE UPDATE ON company_inbox_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
