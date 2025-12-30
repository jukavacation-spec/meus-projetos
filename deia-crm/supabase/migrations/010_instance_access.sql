-- Migration: 010_instance_access
-- Descricao: Tabela de controle de acesso por instancia/inbox
-- Permite definir quais membros da equipe podem acessar cada conexao WhatsApp

-- Tabela de acesso: quais membros podem acessar quais instancias
CREATE TABLE IF NOT EXISTS instance_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(instance_id, user_id)
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_instance_access_instance ON instance_access(instance_id);
CREATE INDEX IF NOT EXISTS idx_instance_access_user ON instance_access(user_id);

-- Habilitar RLS
ALTER TABLE instance_access ENABLE ROW LEVEL SECURITY;

-- Policy: Usuarios podem ver seus proprios acessos
CREATE POLICY "Users can view their own access" ON instance_access
    FOR SELECT USING (user_id = auth.uid());

-- Policy: Admins podem ver todos os acessos da empresa
CREATE POLICY "Admins can view all company access" ON instance_access
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
            AND u.company_id = (SELECT company_id FROM instances WHERE id = instance_access.instance_id)
            AND r.name IN ('owner', 'admin')
        )
    );

-- Policy: Admins podem inserir acessos
CREATE POLICY "Admins can insert access" ON instance_access
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
            AND u.company_id = (SELECT company_id FROM instances WHERE id = instance_access.instance_id)
            AND r.name IN ('owner', 'admin')
        )
    );

-- Policy: Admins podem deletar acessos
CREATE POLICY "Admins can delete access" ON instance_access
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = auth.uid()
            AND u.company_id = (SELECT company_id FROM instances WHERE id = instance_access.instance_id)
            AND r.name IN ('owner', 'admin')
        )
    );

-- Comentarios
COMMENT ON TABLE instance_access IS 'Controle de acesso por instancia WhatsApp - define quais membros podem acessar cada conexao';
COMMENT ON COLUMN instance_access.instance_id IS 'ID da instancia WhatsApp';
COMMENT ON COLUMN instance_access.user_id IS 'ID do usuario que tem acesso';
COMMENT ON COLUMN instance_access.created_by IS 'ID do usuario que concedeu o acesso';
