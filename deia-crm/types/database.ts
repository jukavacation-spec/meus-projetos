export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      agent_inbox_assignments: {
        Row: {
          id: string
          user_id: string
          chatwoot_inbox_id: number
          company_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          chatwoot_inbox_id: number
          company_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          chatwoot_inbox_id?: number
          company_id?: string
          created_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          company_id: string
          name: string
          key_hash: string
          key_prefix: string
          scopes: string[]
          is_active: boolean
          last_used_at: string | null
          expires_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          key_hash: string
          key_prefix: string
          scopes?: string[]
          is_active?: boolean
          last_used_at?: string | null
          expires_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          key_hash?: string
          key_prefix?: string
          scopes?: string[]
          is_active?: boolean
          last_used_at?: string | null
          expires_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      automation_logs: {
        Row: {
          id: string
          automation_id: string
          conversation_id: string | null
          contact_id: string | null
          status: string
          actions_executed: Json
          error_message: string | null
          executed_at: string
        }
        Insert: {
          id?: string
          automation_id: string
          conversation_id?: string | null
          contact_id?: string | null
          status: string
          actions_executed?: Json
          error_message?: string | null
          executed_at?: string
        }
        Update: {
          id?: string
          automation_id?: string
          conversation_id?: string | null
          contact_id?: string | null
          status?: string
          actions_executed?: Json
          error_message?: string | null
          executed_at?: string
        }
      }
      automations: {
        Row: {
          id: string
          company_id: string
          name: string
          description: string | null
          trigger_type: string
          trigger_config: Json
          conditions: Json
          actions: Json
          is_active: boolean
          priority: number
          execution_count: number
          last_executed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          description?: string | null
          trigger_type: string
          trigger_config?: Json
          conditions?: Json
          actions?: Json
          is_active?: boolean
          priority?: number
          execution_count?: number
          last_executed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          description?: string | null
          trigger_type?: string
          trigger_config?: Json
          conditions?: Json
          actions?: Json
          is_active?: boolean
          priority?: number
          execution_count?: number
          last_executed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          slug: string
          chatwoot_account_id: number | null
          chatwoot_api_key: string | null
          plan: string
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          chatwoot_account_id?: number | null
          chatwoot_api_key?: string | null
          plan?: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          chatwoot_account_id?: number | null
          chatwoot_api_key?: string | null
          plan?: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      company_inbox_settings: {
        Row: {
          id: string
          company_id: string
          chatwoot_inbox_id: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          chatwoot_inbox_id: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          chatwoot_inbox_id?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          company_id: string
          phone: string
          phone_normalized: string
          name: string | null
          email: string | null
          avatar_url: string | null
          chatwoot_contact_id: number | null
          stage_id: string | null
          labels: string[]
          custom_fields: Json
          metadata: Json
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          phone: string
          name?: string | null
          email?: string | null
          avatar_url?: string | null
          chatwoot_contact_id?: number | null
          stage_id?: string | null
          labels?: string[]
          custom_fields?: Json
          metadata?: Json
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          phone?: string
          name?: string | null
          email?: string | null
          avatar_url?: string | null
          chatwoot_contact_id?: number | null
          stage_id?: string | null
          labels?: string[]
          custom_fields?: Json
          metadata?: Json
          source?: string
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          company_id: string
          contact_id: string
          chatwoot_conversation_id: number | null
          chatwoot_inbox_id: number | null
          stage_id: string | null
          assigned_to: string | null
          priority: string
          status: string
          subject: string | null
          internal_notes: string | null
          custom_fields: Json
          first_response_at: string | null
          resolved_at: string | null
          last_activity_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          contact_id: string
          chatwoot_conversation_id?: number | null
          chatwoot_inbox_id?: number | null
          stage_id?: string | null
          assigned_to?: string | null
          priority?: string
          status?: string
          subject?: string | null
          internal_notes?: string | null
          custom_fields?: Json
          first_response_at?: string | null
          resolved_at?: string | null
          last_activity_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          contact_id?: string
          chatwoot_conversation_id?: number | null
          chatwoot_inbox_id?: number | null
          stage_id?: string | null
          assigned_to?: string | null
          priority?: string
          status?: string
          subject?: string | null
          internal_notes?: string | null
          custom_fields?: Json
          first_response_at?: string | null
          resolved_at?: string | null
          last_activity_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      daily_metrics: {
        Row: {
          id: string
          company_id: string
          date: string
          total_conversations: number
          new_conversations: number
          resolved_conversations: number
          total_messages: number
          incoming_messages: number
          outgoing_messages: number
          avg_first_response_time: number | null
          avg_resolution_time: number | null
          agent_metrics: Json
          channel_metrics: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          date: string
          total_conversations?: number
          new_conversations?: number
          resolved_conversations?: number
          total_messages?: number
          incoming_messages?: number
          outgoing_messages?: number
          avg_first_response_time?: number | null
          avg_resolution_time?: number | null
          agent_metrics?: Json
          channel_metrics?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          date?: string
          total_conversations?: number
          new_conversations?: number
          resolved_conversations?: number
          total_messages?: number
          incoming_messages?: number
          outgoing_messages?: number
          avg_first_response_time?: number | null
          avg_resolution_time?: number | null
          agent_metrics?: Json
          channel_metrics?: Json
          created_at?: string
          updated_at?: string
        }
      }
      instance_access: {
        Row: {
          id: string
          instance_id: string
          user_id: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          instance_id: string
          user_id: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          instance_id?: string
          user_id?: string
          created_at?: string
          created_by?: string | null
        }
      }
      instances: {
        Row: {
          id: string
          company_id: string
          name: string
          uazapi_instance_name: string
          uazapi_token: string | null
          uazapi_status: string
          whatsapp_number: string | null
          whatsapp_profile_name: string | null
          whatsapp_profile_pic_url: string | null
          whatsapp_is_business: boolean
          whatsapp_platform: string | null
          chatwoot_inbox_id: number | null
          chatwoot_inbox_name: string | null
          connected_at: string | null
          disconnected_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          uazapi_instance_name: string
          uazapi_token?: string | null
          uazapi_status?: string
          whatsapp_number?: string | null
          whatsapp_profile_name?: string | null
          whatsapp_profile_pic_url?: string | null
          whatsapp_is_business?: boolean
          whatsapp_platform?: string | null
          chatwoot_inbox_id?: number | null
          chatwoot_inbox_name?: string | null
          connected_at?: string | null
          disconnected_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          uazapi_instance_name?: string
          uazapi_token?: string | null
          uazapi_status?: string
          whatsapp_number?: string | null
          whatsapp_profile_name?: string | null
          whatsapp_profile_pic_url?: string | null
          whatsapp_is_business?: boolean
          whatsapp_platform?: string | null
          chatwoot_inbox_id?: number | null
          chatwoot_inbox_name?: string | null
          connected_at?: string | null
          disconnected_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      kanban_stages: {
        Row: {
          id: string
          company_id: string
          name: string
          slug: string
          description: string | null
          color: string
          position: number
          is_initial: boolean
          is_final: boolean
          auto_archive_days: number | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          slug: string
          description?: string | null
          color?: string
          position: number
          is_initial?: boolean
          is_final?: boolean
          auto_archive_days?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          slug?: string
          description?: string | null
          color?: string
          position?: number
          is_initial?: boolean
          is_final?: boolean
          auto_archive_days?: number | null
          created_at?: string
        }
      }
      kanban_view_config: {
        Row: {
          id: string
          user_id: string
          company_id: string
          stacked_by: string
          hidden_columns: string[]
          column_order: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id: string
          stacked_by?: string
          hidden_columns?: string[]
          column_order?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string
          stacked_by?: string
          hidden_columns?: string[]
          column_order?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          email_enabled: boolean
          push_enabled: boolean
          sound_enabled: boolean
          notify_new_conversation: boolean
          notify_new_message: boolean
          notify_assigned: boolean
          notify_mention: boolean
          notify_resolved: boolean
          notify_team_invite: boolean
          quiet_hours_enabled: boolean
          quiet_hours_start: string
          quiet_hours_end: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email_enabled?: boolean
          push_enabled?: boolean
          sound_enabled?: boolean
          notify_new_conversation?: boolean
          notify_new_message?: boolean
          notify_assigned?: boolean
          notify_mention?: boolean
          notify_resolved?: boolean
          notify_team_invite?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_start?: string
          quiet_hours_end?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email_enabled?: boolean
          push_enabled?: boolean
          sound_enabled?: boolean
          notify_new_conversation?: boolean
          notify_new_message?: boolean
          notify_assigned?: boolean
          notify_mention?: boolean
          notify_resolved?: boolean
          notify_team_invite?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_start?: string
          quiet_hours_end?: string
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          company_id: string
          user_id: string
          type: string
          title: string
          body: string | null
          reference_type: string | null
          reference_id: string | null
          metadata: Json
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          type: string
          title: string
          body?: string | null
          reference_type?: string | null
          reference_id?: string | null
          metadata?: Json
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string | null
          reference_type?: string | null
          reference_id?: string | null
          metadata?: Json
          read_at?: string | null
          created_at?: string
        }
      }
      quick_replies: {
        Row: {
          id: string
          company_id: string
          title: string
          shortcut: string | null
          content: string
          category: string | null
          is_active: boolean
          usage_count: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          title: string
          shortcut?: string | null
          content: string
          category?: string | null
          is_active?: boolean
          usage_count?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          title?: string
          shortcut?: string | null
          content?: string
          category?: string | null
          is_active?: boolean
          usage_count?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      roles: {
        Row: {
          id: string
          company_id: string
          name: string
          display_name: string
          permissions: Json
          is_system: boolean
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          display_name: string
          permissions?: Json
          is_system?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          display_name?: string
          permissions?: Json
          is_system?: boolean
          created_at?: string
        }
      }
      team_activities: {
        Row: {
          id: string
          company_id: string
          user_id: string
          activity_type: string
          data: Json
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          activity_type: string
          data?: Json
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          activity_type?: string
          data?: Json
          created_at?: string
        }
      }
      team_announcements: {
        Row: {
          id: string
          company_id: string
          author_id: string
          content: string
          category: string
          is_pinned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          author_id: string
          content: string
          category?: string
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          author_id?: string
          content?: string
          category?: string
          is_pinned?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      team_invites: {
        Row: {
          id: string
          company_id: string
          email: string
          role_id: string
          invited_by: string
          token: string
          status: string
          expires_at: string
          accepted_at: string | null
          inbox_ids: number[]
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          email: string
          role_id: string
          invited_by: string
          token?: string
          status?: string
          expires_at?: string
          accepted_at?: string | null
          inbox_ids?: number[]
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          email?: string
          role_id?: string
          invited_by?: string
          token?: string
          status?: string
          expires_at?: string
          accepted_at?: string | null
          inbox_ids?: number[]
          created_at?: string
        }
      }
      team_messages: {
        Row: {
          id: string
          company_id: string
          sender_id: string
          receiver_id: string
          content: string
          read_at: string | null
          deleted_by_sender: boolean
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          sender_id: string
          receiver_id: string
          content: string
          read_at?: string | null
          deleted_by_sender?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          sender_id?: string
          receiver_id?: string
          content?: string
          read_at?: string | null
          deleted_by_sender?: boolean
          created_at?: string
        }
      }
      timeline_events: {
        Row: {
          id: string
          company_id: string
          contact_id: string
          conversation_id: string | null
          event_type: string
          data: Json
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          contact_id: string
          conversation_id?: string | null
          event_type: string
          data?: Json
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          contact_id?: string
          conversation_id?: string | null
          event_type?: string
          data?: Json
          created_by?: string | null
          created_at?: string
        }
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          theme: string
          notification_sound: boolean
          notification_desktop: boolean
          notification_new_message: boolean
          notification_new_conversation: boolean
          keyboard_shortcuts_enabled: boolean
          preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          theme?: string
          notification_sound?: boolean
          notification_desktop?: boolean
          notification_new_message?: boolean
          notification_new_conversation?: boolean
          keyboard_shortcuts_enabled?: boolean
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          theme?: string
          notification_sound?: boolean
          notification_desktop?: boolean
          notification_new_message?: boolean
          notification_new_conversation?: boolean
          keyboard_shortcuts_enabled?: boolean
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      user_presence: {
        Row: {
          id: string
          user_id: string
          company_id: string
          status: string
          status_text: string | null
          last_seen_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id: string
          status?: string
          status_text?: string | null
          last_seen_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string
          status?: string
          status_text?: string | null
          last_seen_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          company_id: string | null
          role_id: string | null
          chatwoot_agent_id: number | null
          is_active: boolean
          last_seen_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar_url?: string | null
          company_id?: string | null
          role_id?: string | null
          chatwoot_agent_id?: number | null
          is_active?: boolean
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          company_id?: string | null
          role_id?: string | null
          chatwoot_agent_id?: number | null
          is_active?: boolean
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      get_user_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      accept_team_invite: {
        Args: { invite_token: string; user_id: string }
        Returns: Json
      }
      create_notification: {
        Args: {
          p_company_id: string
          p_user_id: string
          p_type: string
          p_title: string
          p_body?: string
          p_reference_type?: string
          p_reference_id?: string
          p_metadata?: Json
        }
        Returns: string
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
