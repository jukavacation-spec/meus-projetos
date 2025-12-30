-- Tabela de notificacoes
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Tipo e conteudo
  type VARCHAR(50) NOT NULL, -- 'new_conversation', 'new_message', 'assigned', 'mention', 'resolved', 'team_invite'
  title VARCHAR(255) NOT NULL,
  body TEXT,

  -- Referencia opcional
  reference_type VARCHAR(50), -- 'conversation', 'contact', 'invite'
  reference_id UUID,

  -- Metadata adicional (JSON)
  metadata JSONB DEFAULT '{}',

  -- Status
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_company ON notifications(company_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Usuarios podem ver suas proprias notificacoes
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Sistema pode criar notificacoes para usuarios da empresa
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.company_id = notifications.company_id
    )
  );

-- Usuarios podem atualizar suas proprias notificacoes (marcar como lida)
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Usuarios podem deletar suas proprias notificacoes
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Tabela de preferencias de notificacao
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Preferencias
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,

  -- Tipos de notificacao habilitados
  notify_new_conversation BOOLEAN DEFAULT TRUE,
  notify_new_message BOOLEAN DEFAULT TRUE,
  notify_assigned BOOLEAN DEFAULT TRUE,
  notify_mention BOOLEAN DEFAULT TRUE,
  notify_resolved BOOLEAN DEFAULT TRUE,
  notify_team_invite BOOLEAN DEFAULT TRUE,

  -- Horario silencioso
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Indice
CREATE INDEX idx_notification_prefs_user ON notification_preferences(user_id);

-- RLS
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Usuarios podem ver suas preferencias
CREATE POLICY "Users can view own preferences"
  ON notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Usuarios podem criar suas preferencias
CREATE POLICY "Users can create own preferences"
  ON notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Usuarios podem atualizar suas preferencias
CREATE POLICY "Users can update own preferences"
  ON notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Funcao para criar notificacao
CREATE OR REPLACE FUNCTION create_notification(
  p_company_id UUID,
  p_user_id UUID,
  p_type VARCHAR(50),
  p_title VARCHAR(255),
  p_body TEXT DEFAULT NULL,
  p_reference_type VARCHAR(50) DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
  v_prefs notification_preferences;
  v_should_notify BOOLEAN := TRUE;
BEGIN
  -- Verificar preferencias do usuario
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = p_user_id;

  -- Se tem preferencias, verificar se este tipo esta habilitado
  IF v_prefs.id IS NOT NULL THEN
    CASE p_type
      WHEN 'new_conversation' THEN v_should_notify := v_prefs.notify_new_conversation;
      WHEN 'new_message' THEN v_should_notify := v_prefs.notify_new_message;
      WHEN 'assigned' THEN v_should_notify := v_prefs.notify_assigned;
      WHEN 'mention' THEN v_should_notify := v_prefs.notify_mention;
      WHEN 'resolved' THEN v_should_notify := v_prefs.notify_resolved;
      WHEN 'team_invite' THEN v_should_notify := v_prefs.notify_team_invite;
      ELSE v_should_notify := TRUE;
    END CASE;

    -- Verificar horario silencioso
    IF v_prefs.quiet_hours_enabled THEN
      IF v_prefs.quiet_hours_start < v_prefs.quiet_hours_end THEN
        -- Horario normal (ex: 22:00 a 08:00 do mesmo dia - nao faz sentido, mas handle)
        IF CURRENT_TIME >= v_prefs.quiet_hours_start AND CURRENT_TIME < v_prefs.quiet_hours_end THEN
          v_should_notify := FALSE;
        END IF;
      ELSE
        -- Horario que cruza meia-noite (ex: 22:00 a 08:00)
        IF CURRENT_TIME >= v_prefs.quiet_hours_start OR CURRENT_TIME < v_prefs.quiet_hours_end THEN
          v_should_notify := FALSE;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Criar notificacao se permitido
  IF v_should_notify THEN
    INSERT INTO notifications (company_id, user_id, type, title, body, reference_type, reference_id, metadata)
    VALUES (p_company_id, p_user_id, p_type, p_title, p_body, p_reference_type, p_reference_id, p_metadata)
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN v_notification_id;
END;
$$;

-- Trigger para notificar quando conversa e atribuida
CREATE OR REPLACE FUNCTION notify_on_conversation_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se assigned_to mudou e nao e null
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    PERFORM create_notification(
      NEW.company_id,
      NEW.assigned_to,
      'assigned',
      'Nova conversa atribuida',
      'Uma conversa foi atribuida a voce',
      'conversation',
      NEW.id,
      jsonb_build_object('contact_id', NEW.contact_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_conversation_assigned
  AFTER UPDATE ON conversations
  FOR EACH ROW
  WHEN (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)
  EXECUTE FUNCTION notify_on_conversation_assigned();

-- Trigger para notificar nova conversa (para todos os usuarios ativos da empresa)
CREATE OR REPLACE FUNCTION notify_on_new_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- Notificar todos os usuarios ativos da empresa
  FOR v_user IN
    SELECT id FROM users
    WHERE company_id = NEW.company_id
    AND is_active = TRUE
  LOOP
    PERFORM create_notification(
      NEW.company_id,
      v_user.id,
      'new_conversation',
      'Nova conversa',
      'Uma nova conversa foi iniciada',
      'conversation',
      NEW.id,
      jsonb_build_object('contact_id', NEW.contact_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_new_conversation
  AFTER INSERT ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_new_conversation();
