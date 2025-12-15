-- ===========================================
-- EMPRESAS (Multi-tenant)
-- ===========================================
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    chatwoot_account_id INTEGER UNIQUE,
    chatwoot_api_key TEXT,
    plan TEXT DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- CARGOS/ROLES (Flexivel por empresa)
-- ===========================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, name)
);

-- ===========================================
-- USUARIOS
-- ===========================================
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id),
    chatwoot_agent_id INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- CONTATOS (People API - Core)
-- ===========================================
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    phone_normalized TEXT GENERATED ALWAYS AS (
        regexp_replace(phone, '[^0-9]', '', 'g')
    ) STORED,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    chatwoot_contact_id INTEGER,
    tags TEXT[] DEFAULT '{}',
    labels TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    source TEXT DEFAULT 'whatsapp',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, phone_normalized)
);

-- Indices para busca
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_phone ON contacts(phone_normalized);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);

-- ===========================================
-- ESTAGIOS DO KANBAN (Configuravel por empresa)
-- ===========================================
CREATE TABLE kanban_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    position INTEGER NOT NULL,
    is_initial BOOLEAN DEFAULT FALSE,
    is_final BOOLEAN DEFAULT FALSE,
    auto_archive_days INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, slug)
);

-- ===========================================
-- CONVERSAS (Contexto CRM)
-- ===========================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    chatwoot_conversation_id INTEGER,
    chatwoot_inbox_id INTEGER,
    stage_id UUID REFERENCES kanban_stages(id),
    assigned_to UUID REFERENCES users(id),
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'open',
    subject TEXT,
    internal_notes TEXT,
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    first_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_company ON conversations(company_id);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_conversations_stage ON conversations(stage_id);
CREATE INDEX idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX idx_conversations_chatwoot ON conversations(chatwoot_conversation_id);

-- ===========================================
-- TIMELINE (Historico unificado)
-- ===========================================
CREATE TABLE timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_timeline_contact ON timeline_events(contact_id);
CREATE INDEX idx_timeline_type ON timeline_events(event_type);
CREATE INDEX idx_timeline_conversation ON timeline_events(conversation_id);

-- ===========================================
-- RESPOSTAS RAPIDAS
-- ===========================================
CREATE TABLE quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    shortcut TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, shortcut)
);

-- ===========================================
-- TAGS (Centralizadas)
-- ===========================================
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, name)
);
