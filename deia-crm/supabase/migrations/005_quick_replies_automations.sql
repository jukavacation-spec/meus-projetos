-- =============================================
-- RESPOSTAS RÁPIDAS (Quick Replies / Templates)
-- =============================================

CREATE TABLE IF NOT EXISTS quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  shortcut VARCHAR(20), -- ex: /saudacao, /preco
  content TEXT NOT NULL,
  category VARCHAR(50), -- ex: saudacao, vendas, suporte
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para quick_replies
CREATE INDEX idx_quick_replies_company ON quick_replies(company_id);
CREATE INDEX idx_quick_replies_shortcut ON quick_replies(company_id, shortcut);
CREATE INDEX idx_quick_replies_category ON quick_replies(company_id, category);

-- RLS para quick_replies
ALTER TABLE quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quick replies from their company"
  ON quick_replies FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert quick replies for their company"
  ON quick_replies FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update quick replies from their company"
  ON quick_replies FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete quick replies from their company"
  ON quick_replies FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- =============================================
-- AUTOMAÇÕES
-- =============================================

CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Trigger (quando executar)
  trigger_type VARCHAR(50) NOT NULL, -- 'new_conversation', 'keyword', 'no_response', 'schedule'
  trigger_config JSONB DEFAULT '{}', -- configurações específicas do trigger

  -- Condições (quando aplicar)
  conditions JSONB DEFAULT '[]', -- array de condições

  -- Ações (o que fazer)
  actions JSONB NOT NULL DEFAULT '[]', -- array de ações

  -- Status e controle
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- ordem de execução
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,

  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tipos de trigger:
-- 'new_conversation' - quando nova conversa é criada
-- 'keyword' - quando mensagem contém palavra-chave
-- 'no_response' - quando não há resposta após X tempo
-- 'schedule' - executa em horário específico
-- 'stage_change' - quando muda de estágio no kanban

-- Tipos de ação:
-- 'send_message' - enviar mensagem automática
-- 'assign_agent' - atribuir a agente
-- 'add_tag' - adicionar tag
-- 'change_stage' - mudar estágio
-- 'send_notification' - enviar notificação
-- 'webhook' - chamar webhook externo

-- Índices para automations
CREATE INDEX idx_automations_company ON automations(company_id);
CREATE INDEX idx_automations_trigger ON automations(company_id, trigger_type);
CREATE INDEX idx_automations_active ON automations(company_id, is_active);

-- RLS para automations
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automations from their company"
  ON automations FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert automations for their company"
  ON automations FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update automations from their company"
  ON automations FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete automations from their company"
  ON automations FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- Log de execução de automações
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'skipped'
  actions_executed JSONB DEFAULT '[]',
  error_message TEXT,

  executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_logs_automation ON automation_logs(automation_id);
CREATE INDEX idx_automation_logs_date ON automation_logs(executed_at);

-- RLS para automation_logs
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automation logs from their company"
  ON automation_logs FOR SELECT
  USING (automation_id IN (
    SELECT id FROM automations WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- =============================================
-- MÉTRICAS E ANALYTICS
-- =============================================

-- Tabela de métricas diárias (agregadas)
CREATE TABLE IF NOT EXISTS daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Conversas
  total_conversations INTEGER DEFAULT 0,
  new_conversations INTEGER DEFAULT 0,
  resolved_conversations INTEGER DEFAULT 0,

  -- Mensagens
  total_messages INTEGER DEFAULT 0,
  incoming_messages INTEGER DEFAULT 0,
  outgoing_messages INTEGER DEFAULT 0,

  -- Tempo de resposta (em segundos)
  avg_first_response_time INTEGER,
  avg_resolution_time INTEGER,

  -- Por agente (JSONB com dados por agente)
  agent_metrics JSONB DEFAULT '{}',

  -- Por canal
  channel_metrics JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(company_id, date)
);

CREATE INDEX idx_daily_metrics_company_date ON daily_metrics(company_id, date);

-- RLS para daily_metrics
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view metrics from their company"
  ON daily_metrics FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "System can insert metrics"
  ON daily_metrics FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "System can update metrics"
  ON daily_metrics FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- =============================================
-- CONFIGURAÇÕES DE USUÁRIO (para preferências como dark mode)
-- =============================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Aparência
  theme VARCHAR(20) DEFAULT 'system', -- 'light', 'dark', 'system'

  -- Notificações
  notification_sound BOOLEAN DEFAULT true,
  notification_desktop BOOLEAN DEFAULT true,
  notification_new_message BOOLEAN DEFAULT true,
  notification_new_conversation BOOLEAN DEFAULT true,

  -- Atalhos de teclado
  keyboard_shortcuts_enabled BOOLEAN DEFAULT true,

  -- Outras preferências
  preferences JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- RLS para user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
  ON user_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (user_id = auth.uid());

-- =============================================
-- FUNÇÃO PARA ATUALIZAR MÉTRICAS
-- =============================================

CREATE OR REPLACE FUNCTION update_daily_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Esta função seria chamada por triggers para atualizar métricas
  -- Por simplicidade, as métricas serão calculadas via API/cron
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- DADOS INICIAIS - Quick Replies de exemplo
-- =============================================

-- Os dados serão inseridos via aplicação quando o usuário criar
