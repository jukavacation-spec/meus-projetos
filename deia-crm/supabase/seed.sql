-- ===========================================
-- SEED DATA - Dados iniciais para teste
-- ===========================================

-- NOTA: Este arquivo e apenas para desenvolvimento/teste
-- Em producao, empresas e usuarios sao criados via signup

-- Exemplo de como criar uma empresa de teste manualmente:
-- (Descomente para usar)

/*
-- 1. Criar empresa
INSERT INTO companies (name, slug, plan) VALUES
('Empresa Demo', 'empresa-demo', 'free');

-- 2. Os roles e kanban_stages serao criados automaticamente pelo trigger

-- 3. Para associar um usuario a empresa, atualize apos o signup:
-- UPDATE users SET
--   company_id = (SELECT id FROM companies WHERE slug = 'empresa-demo'),
--   role_id = (SELECT id FROM roles WHERE company_id = (SELECT id FROM companies WHERE slug = 'empresa-demo') AND name = 'owner')
-- WHERE email = 'seu@email.com';
*/

-- Tags de exemplo (serao criadas quando empresa existir)
/*
INSERT INTO tags (company_id, name, color, description)
SELECT
    c.id,
    t.name,
    t.color,
    t.description
FROM companies c
CROSS JOIN (VALUES
    ('VIP', '#f59e0b', 'Cliente VIP'),
    ('Novo', '#22c55e', 'Cliente novo'),
    ('Recorrente', '#3b82f6', 'Cliente recorrente'),
    ('Inadimplente', '#ef4444', 'Cliente com pendencias')
) AS t(name, color, description)
WHERE c.slug = 'empresa-demo';
*/
