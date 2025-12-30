-- Adicionar campo display_name na tabela users
-- Este campo sincroniza com o display_name do Chatwoot
-- Se vazio, nenhum nome eh exibido nas mensagens ao cliente

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN users.display_name IS 'Nome para exibicao nas mensagens (sincronizado com Chatwoot display_name)';
