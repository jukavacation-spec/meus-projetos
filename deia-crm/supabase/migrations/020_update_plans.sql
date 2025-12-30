-- Migration: Atualizar sistema de planos
-- Básico: R$ 250 (1 inclusa + até 2 adicionais R$100 cada)
-- Pro: R$ 500 (10 inclusas)
-- Remove plano FREE

-- 1. Adicionar coluna para integrações adicionais compradas
ALTER TABLE companies ADD COLUMN IF NOT EXISTS additional_instances INTEGER DEFAULT 0;

-- 2. Atualizar empresas que estão com plano 'free' para 'basico'
-- (Em produção, isso deveria ser feito manualmente ou com processo de upgrade)
UPDATE companies SET plan = 'basico' WHERE plan = 'free';

-- 3. Garantir que plan só aceita valores válidos
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_plan_check;
ALTER TABLE companies ADD CONSTRAINT companies_plan_check
  CHECK (plan IN ('basico', 'pro'));
