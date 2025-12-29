export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit: number
          usage_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          rate_limit?: number
          usage_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit?: number
          usage_count?: number
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          actions_executed: Json | null
          automation_id: string
          conditions_evaluated: Json | null
          conditions_met: boolean
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          payload: Json
          status: string
          trigger_event: string
        }
        Insert: {
          actions_executed?: Json | null
          automation_id: string
          conditions_evaluated?: Json | null
          conditions_met?: boolean
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          payload?: Json
          status?: string
          trigger_event: string
        }
        Update: {
          actions_executed?: Json | null
          automation_id?: string
          conditions_evaluated?: Json | null
          conditions_met?: boolean
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          payload?: Json
          status?: string
          trigger_event?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_queue: {
        Row: {
          created_at: string
          event: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
        }
        Relationships: []
      }
      automations: {
        Row: {
          actions: Json | null
          conditions: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          trigger: Database["public"]["Enums"]["automation_trigger"]
          updated_at: string
        }
        Insert: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Update: {
          actions?: Json | null
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger?: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Relationships: []
      }
      chatbot_flows: {
        Row: {
          connections: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          nodes: Json
          updated_at: string
        }
        Insert: {
          connections?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          nodes?: Json
          updated_at?: string
        }
        Update: {
          connections?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          nodes?: Json
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          is_favorite: boolean | null
          last_message_at: string
          last_message_content: string | null
          lead_id: string
          status: Database["public"]["Enums"]["conversation_status"]
          unread_count: number
          whatsapp_instance_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          last_message_at?: string
          last_message_content?: string | null
          lead_id: string
          status?: Database["public"]["Enums"]["conversation_status"]
          unread_count?: number
          whatsapp_instance_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          is_favorite?: boolean | null
          last_message_at?: string
          last_message_content?: string | null
          lead_id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          unread_count?: number
          whatsapp_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_config"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          color: string
          created_at: string
          grupo: string | null
          id: string
          name: string
          order: number
        }
        Insert: {
          color?: string
          created_at?: string
          grupo?: string | null
          id?: string
          name: string
          order?: number
        }
        Update: {
          color?: string
          created_at?: string
          grupo?: string | null
          id?: string
          name?: string
          order?: number
        }
        Relationships: []
      }
      internal_notes: {
        Row: {
          author_id: string
          content: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          content: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          category: Database["public"]["Enums"]["label_category"]
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["label_category"]
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          category?: Database["public"]["Enums"]["label_category"]
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          lead_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          lead_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          lead_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_history: {
        Row: {
          action: string
          created_at: string
          field_name: string | null
          id: string
          lead_id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          field_name?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          field_name?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_labels: {
        Row: {
          created_at: string
          id: string
          label_id: string
          lead_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_id: string
          lead_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label_id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_labels_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_summary: string | null
          assigned_to: string | null
          avatar_url: string | null
          benefit_type: string | null
          birth_date: string | null
          case_status: string | null
          country_code: string | null
          cpf: string | null
          created_at: string
          custom_fields: Json | null
          documents_checklist: Json | null
          email: string | null
          estimated_value: number | null
          id: string
          internal_notes: string | null
          is_facebook_lid: boolean | null
          last_interaction_at: string | null
          name: string
          nit_pis: string | null
          original_lid: string | null
          phone: string
          qualification: Json | null
          source: string
          stage_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          temperature: Database["public"]["Enums"]["lead_temperature"]
          updated_at: string
          utm_medium: string | null
          whatsapp_chat_id: string | null
          whatsapp_name: string | null
        }
        Insert: {
          ai_summary?: string | null
          assigned_to?: string | null
          avatar_url?: string | null
          benefit_type?: string | null
          birth_date?: string | null
          case_status?: string | null
          country_code?: string | null
          cpf?: string | null
          created_at?: string
          custom_fields?: Json | null
          documents_checklist?: Json | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          internal_notes?: string | null
          is_facebook_lid?: boolean | null
          last_interaction_at?: string | null
          name: string
          nit_pis?: string | null
          original_lid?: string | null
          phone: string
          qualification?: Json | null
          source?: string
          stage_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          utm_medium?: string | null
          whatsapp_chat_id?: string | null
          whatsapp_name?: string | null
        }
        Update: {
          ai_summary?: string | null
          assigned_to?: string | null
          avatar_url?: string | null
          benefit_type?: string | null
          birth_date?: string | null
          case_status?: string | null
          country_code?: string | null
          cpf?: string | null
          created_at?: string
          custom_fields?: Json | null
          documents_checklist?: Json | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          internal_notes?: string | null
          is_facebook_lid?: boolean | null
          last_interaction_at?: string | null
          name?: string
          nit_pis?: string | null
          original_lid?: string | null
          phone?: string
          qualification?: Json | null
          source?: string
          stage_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          utm_medium?: string | null
          whatsapp_chat_id?: string | null
          whatsapp_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"] | null
          external_id: string | null
          id: string
          is_internal_note: boolean | null
          is_starred: boolean | null
          lead_id: string | null
          media_url: string | null
          sender_id: string
          sender_type: Database["public"]["Enums"]["sender_type"]
          status: Database["public"]["Enums"]["message_status"]
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"] | null
          external_id?: string | null
          id?: string
          is_internal_note?: boolean | null
          is_starred?: boolean | null
          lead_id?: string | null
          media_url?: string | null
          sender_id: string
          sender_type: Database["public"]["Enums"]["sender_type"]
          status?: Database["public"]["Enums"]["message_status"]
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"] | null
          external_id?: string | null
          id?: string
          is_internal_note?: boolean | null
          is_starred?: boolean | null
          lead_id?: string | null
          media_url?: string | null
          sender_id?: string
          sender_type?: Database["public"]["Enums"]["sender_type"]
          status?: Database["public"]["Enums"]["message_status"]
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          name: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          lead_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          lead_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          lead_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          created_at: string
          created_by: string | null
          filters: Json | null
          format: string
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          recipients: string[] | null
          report_type: string
          schedule_cron: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filters?: Json | null
          format?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          recipients?: string[] | null
          report_type: string
          schedule_cron?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filters?: Json | null
          format?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          recipients?: string[] | null
          report_type?: string
          schedule_cron?: string | null
        }
        Relationships: []
      }
      sla_configs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_hours: number
          stage_id: string
          updated_at: string
          warning_hours: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_hours?: number
          stage_id: string
          updated_at?: string
          warning_hours?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_hours?: number
          stage_id?: string
          updated_at?: string
          warning_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "sla_configs_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: true
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          subtasks: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          subtasks?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          subtasks?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          shortcut: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          shortcut: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          shortcut?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          event: Database["public"]["Enums"]["webhook_event"]
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          status: Database["public"]["Enums"]["webhook_log_status"]
          webhook_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event: Database["public"]["Enums"]["webhook_event"]
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: Database["public"]["Enums"]["webhook_log_status"]
          webhook_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          event?: Database["public"]["Enums"]["webhook_event"]
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: Database["public"]["Enums"]["webhook_log_status"]
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_queue: {
        Row: {
          created_at: string
          event: Database["public"]["Enums"]["webhook_event"]
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
        }
        Insert: {
          created_at?: string
          event: Database["public"]["Enums"]["webhook_event"]
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
        }
        Update: {
          created_at?: string
          event?: Database["public"]["Enums"]["webhook_event"]
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          events: Database["public"]["Enums"]["webhook_event"][]
          headers: Json | null
          id: string
          is_active: boolean
          name: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: Database["public"]["Enums"]["webhook_event"][]
          headers?: Json | null
          id?: string
          is_active?: boolean
          name: string
          secret?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: Database["public"]["Enums"]["webhook_event"][]
          headers?: Json | null
          id?: string
          is_active?: boolean
          name?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          api_key: string
          base_url: string
          created_at: string
          created_by: string | null
          id: string
          instance_name: string | null
          is_active: boolean
          name: string
          phone_number: string | null
          provider: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          api_key: string
          base_url: string
          created_at?: string
          created_by?: string | null
          id?: string
          instance_name?: string | null
          is_active?: boolean
          name: string
          phone_number?: string | null
          provider: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          api_key?: string
          base_url?: string
          created_at?: string
          created_by?: string | null
          id?: string
          instance_name?: string | null
          is_active?: boolean
          name?: string
          phone_number?: string | null
          provider?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_notification: {
        Args: {
          p_data?: Json
          p_link?: string
          p_message: string
          p_title: string
          p_type?: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      validate_api_key: { Args: { key_value: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "manager" | "agent" | "viewer"
      automation_action:
        | "move_lead_to_stage"
        | "change_lead_temperature"
        | "add_label"
        | "remove_label"
        | "create_task"
        | "notify_user"
        | "assign_to_user"
        | "send_message"
      automation_trigger:
        | "lead_created"
        | "lead_stage_changed"
        | "lead_temperature_changed"
        | "lead_no_response"
        | "lead_label_added"
        | "task_overdue"
        | "conversation_no_response"
      conversation_status: "open" | "pending" | "resolved"
      label_category:
        | "origem"
        | "interesse"
        | "prioridade"
        | "status"
        | "beneficio"
        | "condicao_saude"
        | "desqualificacao"
        | "situacao"
        | "perda"
      lead_status: "active" | "archived" | "converted" | "lost"
      lead_temperature: "cold" | "warm" | "hot"
      message_direction: "inbound" | "outbound"
      message_status: "sent" | "delivered" | "read"
      message_type: "text" | "image" | "audio" | "video" | "document"
      notification_type:
        | "info"
        | "success"
        | "warning"
        | "error"
        | "message"
        | "task"
        | "lead"
      sender_type: "lead" | "agent"
      task_priority: "urgent" | "high" | "medium" | "low"
      task_status: "todo" | "in_progress" | "done"
      webhook_event:
        | "lead.created"
        | "lead.updated"
        | "lead.deleted"
        | "lead.stage_changed"
        | "lead.assigned"
        | "lead.temperature_changed"
        | "lead.label_added"
        | "lead.label_removed"
        | "message.received"
        | "message.sent"
        | "conversation.created"
        | "conversation.assigned"
        | "conversation.resolved"
        | "task.created"
        | "task.completed"
      webhook_log_status: "pending" | "success" | "failed" | "retrying"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "agent", "viewer"],
      automation_action: [
        "move_lead_to_stage",
        "change_lead_temperature",
        "add_label",
        "remove_label",
        "create_task",
        "notify_user",
        "assign_to_user",
        "send_message",
      ],
      automation_trigger: [
        "lead_created",
        "lead_stage_changed",
        "lead_temperature_changed",
        "lead_no_response",
        "lead_label_added",
        "task_overdue",
        "conversation_no_response",
      ],
      conversation_status: ["open", "pending", "resolved"],
      label_category: [
        "origem",
        "interesse",
        "prioridade",
        "status",
        "beneficio",
        "condicao_saude",
        "desqualificacao",
        "situacao",
        "perda",
      ],
      lead_status: ["active", "archived", "converted", "lost"],
      lead_temperature: ["cold", "warm", "hot"],
      message_direction: ["inbound", "outbound"],
      message_status: ["sent", "delivered", "read"],
      message_type: ["text", "image", "audio", "video", "document"],
      notification_type: [
        "info",
        "success",
        "warning",
        "error",
        "message",
        "task",
        "lead",
      ],
      sender_type: ["lead", "agent"],
      task_priority: ["urgent", "high", "medium", "low"],
      task_status: ["todo", "in_progress", "done"],
      webhook_event: [
        "lead.created",
        "lead.updated",
        "lead.deleted",
        "lead.stage_changed",
        "lead.assigned",
        "lead.temperature_changed",
        "lead.label_added",
        "lead.label_removed",
        "message.received",
        "message.sent",
        "conversation.created",
        "conversation.assigned",
        "conversation.resolved",
        "task.created",
        "task.completed",
      ],
      webhook_log_status: ["pending", "success", "failed", "retrying"],
    },
  },
} as const
