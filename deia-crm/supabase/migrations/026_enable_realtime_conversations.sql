-- Habilitar Realtime para conversas e contatos
-- Isso permite que o frontend receba atualizações em tempo real

-- Adicionar tabela conversations ao Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;

-- Adicionar tabela contacts ao Realtime (para atualização de nomes/avatares)
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;

-- Comentário: Após aplicar esta migração, o frontend receberá
-- eventos INSERT/UPDATE/DELETE em tempo real para estas tabelas
