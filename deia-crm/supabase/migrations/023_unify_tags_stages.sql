-- =============================================
-- MIGRATION 023: Unificar Tags e Estágios → Status
-- =============================================
-- Objetivo:
--   1. Adicionar stage_id em contacts (contatos terão status)
--   2. Remover campo tags de contacts e conversations
--   3. Remover tabela tags (não mais necessária)
-- =============================================

BEGIN;

-- 1. Adicionar coluna stage_id em contacts
-- Permite que contatos tenham um status/estágio do pipeline
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES kanban_stages(id) ON DELETE SET NULL;

-- 2. Criar índice para consultas por stage
CREATE INDEX IF NOT EXISTS idx_contacts_stage ON contacts(stage_id);

-- 3. Remover coluna tags de contacts
-- ATENÇÃO: Isso remove dados! Tags existentes serão perdidas
ALTER TABLE contacts DROP COLUMN IF EXISTS tags;

-- 4. Remover coluna tags de conversations
-- ATENÇÃO: Isso remove dados! Tags existentes serão perdidas
ALTER TABLE conversations DROP COLUMN IF EXISTS tags;

-- 5. Remover índice antigo de tags (se existir)
DROP INDEX IF EXISTS idx_contacts_tags;

-- 6. Remover tabela tags
-- CASCADE para remover dependências (policies, etc)
DROP TABLE IF EXISTS tags CASCADE;

COMMIT;
