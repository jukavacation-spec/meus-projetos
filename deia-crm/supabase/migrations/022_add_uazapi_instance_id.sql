-- ===========================================
-- Adiciona coluna uazapi_instance_id na tabela instances
-- O ID da instância no UAZAPI é necessário para construir
-- a URL do webhook do Chatwoot corretamente
-- ===========================================

ALTER TABLE instances
ADD COLUMN IF NOT EXISTS uazapi_instance_id TEXT;

-- Comentário para documentação
COMMENT ON COLUMN instances.uazapi_instance_id IS 'ID único da instância retornado pelo UAZAPI, usado para construir URL do webhook';
