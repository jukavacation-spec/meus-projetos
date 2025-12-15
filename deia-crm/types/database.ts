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
          tags: string[]
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
          tags?: string[]
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
          tags?: string[]
          labels?: string[]
          custom_fields?: Json
          metadata?: Json
          source?: string
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
          tags: string[]
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
          tags?: string[]
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
          tags?: string[]
          custom_fields?: Json
          first_response_at?: string | null
          resolved_at?: string | null
          last_activity_at?: string
          created_at?: string
          updated_at?: string
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
      quick_replies: {
        Row: {
          id: string
          company_id: string
          shortcut: string
          title: string
          content: string
          category: string | null
          is_active: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          shortcut: string
          title: string
          content: string
          category?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          shortcut?: string
          title?: string
          content?: string
          category?: string | null
          is_active?: boolean
          created_by?: string | null
          created_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          company_id: string
          name: string
          color: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          color?: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          color?: string
          description?: string | null
          created_at?: string
        }
      }
    }
    Functions: {
      get_user_company_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
