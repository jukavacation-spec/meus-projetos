-- Migration: Kanban View Configuration
-- Armazena preferências de visualização do Kanban por usuário

-- Criar tabela de configuração
CREATE TABLE IF NOT EXISTS kanban_view_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Configurações de visualização
  stacked_by TEXT NOT NULL DEFAULT 'stage_id',  -- 'stage_id', 'priority', 'assigned_to'
  hidden_columns TEXT[] NOT NULL DEFAULT '{}',   -- IDs das colunas ocultas
  column_order TEXT[] NOT NULL DEFAULT '{}',     -- IDs na ordem customizada (vazio = ordem padrão)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Cada usuário tem apenas uma config por empresa
  CONSTRAINT kanban_view_config_user_company_unique UNIQUE(user_id, company_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_kanban_view_config_user ON kanban_view_config(user_id);
CREATE INDEX IF NOT EXISTS idx_kanban_view_config_company ON kanban_view_config(company_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_kanban_view_config_updated_at
  BEFORE UPDATE ON kanban_view_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE kanban_view_config ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver apenas suas próprias configs
CREATE POLICY "Users can view own kanban config"
  ON kanban_view_config
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Usuários podem inserir suas próprias configs
CREATE POLICY "Users can insert own kanban config"
  ON kanban_view_config
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Usuários podem atualizar suas próprias configs
CREATE POLICY "Users can update own kanban config"
  ON kanban_view_config
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Usuários podem deletar suas próprias configs
CREATE POLICY "Users can delete own kanban config"
  ON kanban_view_config
  FOR DELETE
  USING (user_id = auth.uid());

-- Comentários
COMMENT ON TABLE kanban_view_config IS 'Preferências de visualização do Kanban por usuário';
COMMENT ON COLUMN kanban_view_config.stacked_by IS 'Campo de agrupamento: stage_id, priority, assigned_to';
COMMENT ON COLUMN kanban_view_config.hidden_columns IS 'Array de IDs de colunas ocultas';
COMMENT ON COLUMN kanban_view_config.column_order IS 'Array de IDs na ordem customizada';
