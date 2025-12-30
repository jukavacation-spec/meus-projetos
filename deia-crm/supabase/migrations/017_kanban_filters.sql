-- Migration: Adiciona coluna de filtros ao Kanban View Config
-- Permite salvar filtros persistentes por usuário

-- Adicionar coluna de filtros (JSONB para flexibilidade)
ALTER TABLE kanban_view_config
ADD COLUMN IF NOT EXISTS filters JSONB NOT NULL DEFAULT '{}';

-- Comentário
COMMENT ON COLUMN kanban_view_config.filters IS 'Filtros salvos: { inboxIds: number[], statuses: string[], assignedTo: string[] }';
