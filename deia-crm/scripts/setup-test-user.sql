-- Script para configurar usuário de teste com empresa
-- Execute no SQL Editor do Supabase

-- 1. Criar empresa de teste
INSERT INTO companies (id, name, slug, plan)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Empresa Teste',
  'empresa-teste',
  'professional'
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Criar roles padrão para a empresa
INSERT INTO roles (company_id, name, display_name, permissions, is_system)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin', 'Administrador',
   '{"contacts": {"read": true, "write": true, "delete": true}, "kanban": {"read": true, "write": true, "move": true, "configure": true}, "team": {"read": true, "write": true, "delete": true, "manage": true}, "settings": {"read": true, "write": true, "configure": true}, "reports": {"read": true}, "billing": {"read": true, "write": true}}',
   true),
  ('a0000000-0000-0000-0000-000000000001', 'agent', 'Agente',
   '{"contacts": {"read": true, "write": true}, "kanban": {"read": true, "write": true, "move": true}, "team": {"read": true}, "settings": {"read": true}, "reports": {"read": true}}',
   true)
ON CONFLICT (company_id, name) DO NOTHING;

-- 3. Buscar o ID do role admin
-- 4. Vincular usuário à empresa com role admin
UPDATE users
SET
  company_id = 'a0000000-0000-0000-0000-000000000001',
  role_id = (SELECT id FROM roles WHERE company_id = 'a0000000-0000-0000-0000-000000000001' AND name = 'admin' LIMIT 1),
  name = 'Admin Teste'
WHERE email = 'jukavacation@gmail.com';

-- 5. Criar estágios padrão do Kanban
INSERT INTO kanban_stages (company_id, name, slug, color, position, is_initial)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Novo', 'novo', '#3b82f6', 0, true),
  ('a0000000-0000-0000-0000-000000000001', 'Em Atendimento', 'em-atendimento', '#eab308', 1, false),
  ('a0000000-0000-0000-0000-000000000001', 'Aguardando', 'aguardando', '#f97316', 2, false),
  ('a0000000-0000-0000-0000-000000000001', 'Finalizado', 'finalizado', '#22c55e', 3, false)
ON CONFLICT (company_id, slug) DO NOTHING;

-- Verificar resultado
SELECT u.email, u.name, c.name as company, r.display_name as role
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.email = 'jukavacation@gmail.com';
