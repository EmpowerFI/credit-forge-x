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
      chain_anchors: {
        Row: {
          account_address: string | null
          attempts: number
          commitment: string | null
          confirmed_at: string | null
          created_at: string
          depends_on: number | null
          entity_id: string
          id: number
          kind: Database["public"]["Enums"]["anchor_kind"]
          last_error: string | null
          next_attempt_at: string
          payload: Json | null
          program_id: string
          reconcile: Database["public"]["Enums"]["reconcile_status"]
          reconciled_at: string | null
          signature: string | null
          slot: number | null
          status: Database["public"]["Enums"]["anchor_status"]
          submitted_at: string | null
        }
        Insert: {
          account_address?: string | null
          attempts?: number
          commitment?: string | null
          confirmed_at?: string | null
          created_at?: string
          depends_on?: number | null
          entity_id: string
          id?: never
          kind: Database["public"]["Enums"]["anchor_kind"]
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json | null
          program_id?: string
          reconcile?: Database["public"]["Enums"]["reconcile_status"]
          reconciled_at?: string | null
          signature?: string | null
          slot?: number | null
          status?: Database["public"]["Enums"]["anchor_status"]
          submitted_at?: string | null
        }
        Update: {
          account_address?: string | null
          attempts?: number
          commitment?: string | null
          confirmed_at?: string | null
          created_at?: string
          depends_on?: number | null
          entity_id?: string
          id?: never
          kind?: Database["public"]["Enums"]["anchor_kind"]
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json | null
          program_id?: string
          reconcile?: Database["public"]["Enums"]["reconcile_status"]
          reconciled_at?: string | null
          signature?: string | null
          slot?: number | null
          status?: Database["public"]["Enums"]["anchor_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chain_anchors_depends_on_fkey"
            columns: ["depends_on"]
            isOneToOne: false
            referencedRelation: "chain_anchors"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          chain_ref: string
          city: string
          created_at: string
          description: string | null
          id: string
          is_simulated: boolean
          kind: Database["public"]["Enums"]["community_kind"]
          leader_id: string
          name: string
          review_note: string | null
          state: string
          status: Database["public"]["Enums"]["community_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          chain_ref?: string
          city: string
          created_at?: string
          description?: string | null
          id?: string
          is_simulated?: boolean
          kind: Database["public"]["Enums"]["community_kind"]
          leader_id: string
          name: string
          review_note?: string | null
          state: string
          status?: Database["public"]["Enums"]["community_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          chain_ref?: string
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          is_simulated?: boolean
          kind?: Database["public"]["Enums"]["community_kind"]
          leader_id?: string
          name?: string
          review_note?: string | null
          state?: string
          status?: Database["public"]["Enums"]["community_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communities_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_memberships: {
        Row: {
          community_id: string
          entrepreneur_id: string
          joined_at: string
          status: Database["public"]["Enums"]["membership_status"]
        }
        Insert: {
          community_id: string
          entrepreneur_id: string
          joined_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
        }
        Update: {
          community_id?: string
          entrepreneur_id?: string
          joined_at?: string
          status?: Database["public"]["Enums"]["membership_status"]
        }
        Relationships: [
          {
            foreignKeyName: "community_memberships_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_memberships_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
        ]
      }
      entrepreneurs: {
        Row: {
          borrower_ref: string
          business_name: string | null
          business_sector: string | null
          city: string | null
          created_at: string
          display_name: string
          id: string
          is_simulated: boolean
          profile_id: string | null
          state: string | null
        }
        Insert: {
          borrower_ref?: string
          business_name?: string | null
          business_sector?: string | null
          city?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_simulated?: boolean
          profile_id?: string | null
          state?: string | null
        }
        Update: {
          borrower_ref?: string
          business_name?: string | null
          business_sector?: string | null
          city?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_simulated?: boolean
          profile_id?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entrepreneurs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          accepted_purposes: string[]
          active: boolean
          created_at: string
          decision_method: string
          id: string
          is_simulated: boolean
          kind: Database["public"]["Enums"]["partner_kind"]
          max_ticket_cents: number
          min_ticket_cents: number
          name: string
        }
        Insert: {
          accepted_purposes?: string[]
          active?: boolean
          created_at?: string
          decision_method?: string
          id?: string
          is_simulated?: boolean
          kind: Database["public"]["Enums"]["partner_kind"]
          max_ticket_cents: number
          min_ticket_cents: number
          name: string
        }
        Update: {
          accepted_purposes?: string[]
          active?: boolean
          created_at?: string
          decision_method?: string
          id?: string
          is_simulated?: boolean
          kind?: Database["public"]["Enums"]["partner_kind"]
          max_ticket_cents?: number
          min_ticket_cents?: number
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          partner_id: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          partner_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          partner_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      audit_record: {
        Args: {
          p_entity_id: string
          p_kind: Database["public"]["Enums"]["anchor_kind"]
        }
        Returns: Json
      }
      claim_anchor_jobs: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          borrower_ref: string
          community_ref: string
          entity_id: string
          id: number
          kind: Database["public"]["Enums"]["anchor_kind"]
          payload: Json
        }[]
      }
      complete_anchor_job: {
        Args: {
          p_account_address: string
          p_commitment: string
          p_id: number
          p_payload: Json
          p_signature: string
          p_slot: number
        }
        Returns: undefined
      }
      create_community: {
        Args: {
          p_city: string
          p_description?: string
          p_kind: Database["public"]["Enums"]["community_kind"]
          p_name: string
          p_state: string
        }
        Returns: string
      }
      enroll_entrepreneur: {
        Args: {
          p_business_name?: string
          p_business_sector?: string
          p_city?: string
          p_community_id: string
          p_display_name?: string
          p_entrepreneur_id?: string
          p_state?: string
        }
        Returns: string
      }
      fail_anchor_job: {
        Args: { p_error: string; p_id: number; p_retryable?: boolean }
        Returns: undefined
      }
      reject_community: {
        Args: { p_community_id: string; p_note: string }
        Returns: undefined
      }
      verify_community: {
        Args: { p_community_id: string; p_note?: string }
        Returns: undefined
      }
    }
    Enums: {
      anchor_kind: "community" | "community_verification" | "enrollment"
      anchor_status: "pending" | "submitted" | "confirmed" | "failed"
      app_role:
        | "entrepreneur"
        | "community_leader"
        | "partner"
        | "capital_provider"
        | "auditor"
        | "admin"
      community_kind:
        | "education_programme"
        | "association"
        | "cooperative"
        | "collective"
        | "other"
      community_status: "pending_verification" | "verified" | "rejected"
      membership_status: "active" | "left"
      partner_kind:
        | "credit_union"
        | "scd"
        | "fintech"
        | "bank"
        | "impact_fund"
        | "other"
      reconcile_status: "unchecked" | "verified" | "missing" | "mismatch"
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
      anchor_kind: ["community", "community_verification", "enrollment"],
      anchor_status: ["pending", "submitted", "confirmed", "failed"],
      app_role: [
        "entrepreneur",
        "community_leader",
        "partner",
        "capital_provider",
        "auditor",
        "admin",
      ],
      community_kind: [
        "education_programme",
        "association",
        "cooperative",
        "collective",
        "other",
      ],
      community_status: ["pending_verification", "verified", "rejected"],
      membership_status: ["active", "left"],
      partner_kind: [
        "credit_union",
        "scd",
        "fintech",
        "bank",
        "impact_fund",
        "other",
      ],
      reconcile_status: ["unchecked", "verified", "missing", "mismatch"],
    },
  },
} as const
