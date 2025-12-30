-- ===========================================
-- CONVITES DE EQUIPE
-- ===========================================

CREATE TABLE team_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, email, status)
);

CREATE INDEX idx_team_invites_company ON team_invites(company_id);
CREATE INDEX idx_team_invites_email ON team_invites(email);
CREATE INDEX idx_team_invites_token ON team_invites(token);

-- RLS
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- Usuarios podem ver convites da sua empresa
CREATE POLICY "Users can view invites from their company"
ON team_invites FOR SELECT
USING (company_id = get_user_company_id());

-- Usuarios com permissao de team.manage podem criar convites
CREATE POLICY "Users can create invites in their company"
ON team_invites FOR INSERT
WITH CHECK (company_id = get_user_company_id());

-- Usuarios podem atualizar convites da sua empresa
CREATE POLICY "Users can update invites from their company"
ON team_invites FOR UPDATE
USING (company_id = get_user_company_id());

-- Usuarios podem deletar convites da sua empresa
CREATE POLICY "Users can delete invites from their company"
ON team_invites FOR DELETE
USING (company_id = get_user_company_id());

-- ===========================================
-- FUNCAO PARA ACEITAR CONVITE
-- ===========================================

CREATE OR REPLACE FUNCTION accept_team_invite(invite_token TEXT, user_id UUID)
RETURNS JSONB AS $$
DECLARE
    invite_record RECORD;
    result JSONB;
BEGIN
    -- Buscar convite valido
    SELECT * INTO invite_record
    FROM team_invites
    WHERE token = invite_token
      AND status = 'pending'
      AND expires_at > NOW();

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Convite invalido ou expirado'
        );
    END IF;

    -- Atualizar usuario com company e role
    UPDATE users
    SET company_id = invite_record.company_id,
        role_id = invite_record.role_id,
        updated_at = NOW()
    WHERE id = user_id;

    -- Marcar convite como aceito
    UPDATE team_invites
    SET status = 'accepted',
        accepted_at = NOW()
    WHERE id = invite_record.id;

    RETURN jsonb_build_object(
        'success', true,
        'company_id', invite_record.company_id,
        'role_id', invite_record.role_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
