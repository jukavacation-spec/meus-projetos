-- Tabela para armazenar eventos de webhook para retry e auditoria
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'chatwoot' | 'uazapi'
  event_type TEXT NOT NULL, -- 'message_created', 'conversation_updated', etc
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'completed' | 'failed'
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para busca eficiente
CREATE INDEX idx_webhook_events_status ON webhook_events(status) WHERE status IN ('pending', 'failed');
CREATE INDEX idx_webhook_events_company ON webhook_events(company_id);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at);
CREATE INDEX idx_webhook_events_source_type ON webhook_events(source, event_type);

-- RLS
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Política: service role pode tudo (webhooks usam service role)
CREATE POLICY "Service role full access on webhook_events"
  ON webhook_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_webhook_events_updated_at
  BEFORE UPDATE ON webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para limpar eventos antigos (manter últimos 7 dias)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS void AS $$
BEGIN
  DELETE FROM webhook_events
  WHERE created_at < now() - INTERVAL '7 days'
    AND status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE webhook_events IS 'Armazena eventos de webhook para retry e auditoria';
