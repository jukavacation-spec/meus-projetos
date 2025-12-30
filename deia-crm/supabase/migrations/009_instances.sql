-- ===========================================
-- INSTANCES (WhatsApp via UAZAPI + Chatwoot)
-- ===========================================

CREATE TABLE instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Identificacao
    name TEXT NOT NULL,

    -- UAZAPI
    uazapi_instance_name TEXT NOT NULL,
    uazapi_token TEXT,
    uazapi_status TEXT DEFAULT 'pending' CHECK (uazapi_status IN ('pending', 'qr_ready', 'connecting', 'connected', 'disconnected', 'error')),

    -- WhatsApp (preenchido apos conexao)
    whatsapp_number TEXT,
    whatsapp_profile_name TEXT,
    whatsapp_profile_pic_url TEXT,
    whatsapp_is_business BOOLEAN DEFAULT FALSE,
    whatsapp_platform TEXT,

    -- Chatwoot
    chatwoot_inbox_id INTEGER,
    chatwoot_inbox_name TEXT,

    -- Timestamps
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(company_id, uazapi_instance_name)
);

-- Indexes
CREATE INDEX idx_instances_company ON instances(company_id);
CREATE INDEX idx_instances_status ON instances(uazapi_status);

-- RLS
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company instances" ON instances
    FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert instances for their company" ON instances
    FOR INSERT WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can update their company instances" ON instances
    FOR UPDATE USING (company_id = get_user_company_id());

CREATE POLICY "Users can delete their company instances" ON instances
    FOR DELETE USING (company_id = get_user_company_id());

-- Trigger para updated_at
CREATE TRIGGER update_instances_updated_at
    BEFORE UPDATE ON instances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
