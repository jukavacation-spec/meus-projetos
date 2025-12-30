-- Migration: 011_api_keys
-- Descricao: Tabela de API Keys para integracao com sistemas externos (n8n, Zapier, etc)

-- Tabela de API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    key_prefix VARCHAR(8) NOT NULL,
    scopes TEXT[] DEFAULT ARRAY['leads:read', 'leads:write', 'messages:send'],
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_api_keys_company ON api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- Habilitar RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Admins podem ver API keys da empresa
CREATE POLICY "Admins can view company api keys" ON api_keys
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
            AND u.company_id = api_keys.company_id
            AND r.name IN ('owner', 'admin')
        )
    );

-- Policy: Admins podem criar API keys
CREATE POLICY "Admins can create api keys" ON api_keys
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
            AND u.company_id = api_keys.company_id
            AND r.name IN ('owner', 'admin')
        )
    );

-- Policy: Admins podem atualizar API keys
CREATE POLICY "Admins can update api keys" ON api_keys
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
            AND u.company_id = api_keys.company_id
            AND r.name IN ('owner', 'admin')
        )
    );

-- Policy: Admins podem deletar API keys
CREATE POLICY "Admins can delete api keys" ON api_keys
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
            AND u.company_id = api_keys.company_id
            AND r.name IN ('owner', 'admin')
        )
    );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_api_keys_updated_at();

-- Comentarios
COMMENT ON TABLE api_keys IS 'API Keys para integracao com sistemas externos como n8n, Zapier, Make, etc';
COMMENT ON COLUMN api_keys.key_hash IS 'Hash SHA-256 da chave (a chave real so e mostrada uma vez)';
COMMENT ON COLUMN api_keys.key_prefix IS 'Primeiros 8 caracteres da chave para identificacao';
COMMENT ON COLUMN api_keys.scopes IS 'Permissoes da chave: leads:read, leads:write, messages:send, etc';
