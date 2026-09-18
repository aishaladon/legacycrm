// Auto-generated from the Supabase schema (project aherxqnaufiaotspzrbn).
// Regenerate after every migration:
//   supabase gen types typescript --project-id aherxqnaufiaotspzrbn > src/lib/types/database.ts

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      campaign_sends: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string
          id: string
          message_body: string | null
          sent_at: string | null
          social_platform: string | null
          social_post_url: string | null
          status: Database["public"]["Enums"]["campaign_status"]
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string
          id?: string
          message_body?: string | null
          sent_at?: string | null
          social_platform?: string | null
          social_post_url?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          message_body?: string | null
          sent_at?: string | null
          social_platform?: string | null
          social_post_url?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          template_body: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          template_body: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          template_body?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          lead_source_platform: string | null
          lead_source_post: string | null
          notes: string | null
          phone: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          lead_source_platform?: string | null
          lead_source_post?: string | null
          notes?: string | null
          phone?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          lead_source_platform?: string | null
          lead_source_post?: string | null
          notes?: string | null
          phone?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      interactions: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          occurred_at: string
          source_ref: string | null
          subject: string | null
          summary: string | null
          transcript: string | null
          transcript_drive_url: string | null
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          occurred_at?: string
          source_ref?: string | null
          subject?: string | null
          summary?: string | null
          transcript?: string | null
          transcript_drive_url?: string | null
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          occurred_at?: string
          source_ref?: string | null
          subject?: string | null
          summary?: string | null
          transcript?: string | null
          transcript_drive_url?: string | null
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contact_id: string
          created_at: string
          currency: string
          external_id: string | null
          id: string
          paid_at: string
          product_service: string | null
          source: Database["public"]["Enums"]["payment_source"]
        }
        Insert: {
          amount: number
          contact_id: string
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          paid_at: string
          product_service?: string | null
          source: Database["public"]["Enums"]["payment_source"]
        }
        Update: {
          amount?: number
          contact_id?: string
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          paid_at?: string
          product_service?: string | null
          source?: Database["public"]["Enums"]["payment_source"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline: {
        Row: {
          actual_date: string | null
          contact_id: string
          created_at: string
          expected_date: string | null
          id: string
          income_stream: Database["public"]["Enums"]["income_stream"]
          stage: string
          updated_at: string
          value: number | null
        }
        Insert: {
          actual_date?: string | null
          contact_id: string
          created_at?: string
          expected_date?: string | null
          id?: string
          income_stream: Database["public"]["Enums"]["income_stream"]
          stage: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          actual_date?: string | null
          contact_id?: string
          created_at?: string
          expected_date?: string | null
          id?: string
          income_stream?: Database["public"]["Enums"]["income_stream"]
          stage?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      projects_tasks: {
        Row: {
          contact_id: string | null
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      campaign_status: "draft" | "scheduled" | "sent"
      income_stream: "consulting" | "retreat" | "course" | "book"
      interaction_type:
        | "email"
        | "call"
        | "meeting"
        | "whatsapp"
        | "form"
        | "other"
      payment_source: "stripe" | "paypal" | "novo"
      task_status: "todo" | "in_progress" | "done"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      campaign_status: ["draft", "scheduled", "sent"],
      income_stream: ["consulting", "retreat", "course", "book"],
      interaction_type: [
        "email",
        "call",
        "meeting",
        "whatsapp",
        "form",
        "other",
      ],
      payment_source: ["stripe", "paypal", "novo"],
      task_status: ["todo", "in_progress", "done"],
    },
  },
} as const
