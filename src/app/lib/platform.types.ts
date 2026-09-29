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
      audit_reports: {
        Row: {
          checks: Json
          created_at: string
          created_by: string | null
          id: string
          revoked_at: string | null
          snapshot: Json
          title: string
          token: string
        }
        Insert: {
          checks?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          revoked_at?: string | null
          snapshot: Json
          title: string
          token?: string
        }
        Update: {
          checks?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          revoked_at?: string | null
          snapshot?: Json
          title?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_commitments: {
        Row: {
          committed_cents: number
          created_at: string
          currency: string
          id: string
          is_simulated: boolean
          partner_id: string
          provider_id: string
          target_return_bps: number
        }
        Insert: {
          committed_cents: number
          created_at?: string
          currency?: string
          id?: string
          is_simulated?: boolean
          partner_id: string
          provider_id: string
          target_return_bps: number
        }
        Update: {
          committed_cents?: number
          created_at?: string
          currency?: string
          id?: string
          is_simulated?: boolean
          partner_id?: string
          provider_id?: string
          target_return_bps?: number
        }
        Relationships: [
          {
            foreignKeyName: "capital_commitments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_commitments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_instruments: {
        Row: {
          active: boolean
          business_age_min_months: number
          capacity_cents: number | null
          capital_scope: Database["public"]["Enums"]["capital_scope"]
          closed_network_rules: Json
          code: string
          created_at: string
          currency: string
          effective_from: string
          effective_to: string | null
          eligible_uf: string[]
          estimated_cost_bps: number | null
          id: string
          impact_mandate: boolean
          instrument_type: Database["public"]["Enums"]["capital_instrument_type"]
          is_credit: boolean
          is_domestic: boolean
          is_global: boolean
          is_simulated: boolean
          max_instalment_share_bps: number | null
          name: string
          policy_version: number
          pool: Database["public"]["Enums"]["funding_pool"] | null
          provider_id: string
          purposes: Database["public"]["Enums"]["credit_purpose"][]
          required_documents: string[]
          requires_partner_approval: boolean
          settlement_rail: Database["public"]["Enums"]["settlement_rail"]
          target_population: string[]
          term_max_months: number | null
          term_min_months: number | null
          ticket_max_cents: number | null
          ticket_min_cents: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_age_min_months?: number
          capacity_cents?: number | null
          capital_scope?: Database["public"]["Enums"]["capital_scope"]
          closed_network_rules?: Json
          code: string
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          eligible_uf?: string[]
          estimated_cost_bps?: number | null
          id?: string
          impact_mandate?: boolean
          instrument_type: Database["public"]["Enums"]["capital_instrument_type"]
          is_credit?: boolean
          is_domestic?: boolean
          is_global?: boolean
          is_simulated?: boolean
          max_instalment_share_bps?: number | null
          name: string
          policy_version?: number
          pool?: Database["public"]["Enums"]["funding_pool"] | null
          provider_id: string
          purposes?: Database["public"]["Enums"]["credit_purpose"][]
          required_documents?: string[]
          requires_partner_approval?: boolean
          settlement_rail?: Database["public"]["Enums"]["settlement_rail"]
          target_population?: string[]
          term_max_months?: number | null
          term_min_months?: number | null
          ticket_max_cents?: number | null
          ticket_min_cents?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_age_min_months?: number
          capacity_cents?: number | null
          capital_scope?: Database["public"]["Enums"]["capital_scope"]
          closed_network_rules?: Json
          code?: string
          created_at?: string
          currency?: string
          effective_from?: string
          effective_to?: string | null
          eligible_uf?: string[]
          estimated_cost_bps?: number | null
          id?: string
          impact_mandate?: boolean
          instrument_type?: Database["public"]["Enums"]["capital_instrument_type"]
          is_credit?: boolean
          is_domestic?: boolean
          is_global?: boolean
          is_simulated?: boolean
          max_instalment_share_bps?: number | null
          name?: string
          policy_version?: number
          pool?: Database["public"]["Enums"]["funding_pool"] | null
          provider_id?: string
          purposes?: Database["public"]["Enums"]["credit_purpose"][]
          required_documents?: string[]
          requires_partner_approval?: boolean
          settlement_rail?: Database["public"]["Enums"]["settlement_rail"]
          target_population?: string[]
          term_max_months?: number | null
          term_min_months?: number | null
          ticket_max_cents?: number | null
          ticket_min_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_instruments_pool_fkey"
            columns: ["pool"]
            isOneToOne: false
            referencedRelation: "funding_pools"
            referencedColumns: ["pool"]
          },
          {
            foreignKeyName: "capital_instruments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "capital_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_mobilization_rates: {
        Row: {
          card_version: string
          fixed_cents: number
          hourly_rate_cents: number
          note: string
          staff_minutes: number
          stage: string
        }
        Insert: {
          card_version: string
          fixed_cents: number
          hourly_rate_cents: number
          note: string
          staff_minutes: number
          stage: string
        }
        Update: {
          card_version?: string
          fixed_cents?: number
          hourly_rate_cents?: number
          note?: string
          staff_minutes?: number
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_mobilization_rates_card_version_fkey"
            columns: ["card_version"]
            isOneToOne: false
            referencedRelation: "cost_rate_cards"
            referencedColumns: ["version"]
          },
        ]
      }
      capital_providers: {
        Row: {
          active: boolean
          code: string
          commercial_model: Json
          coverage_note: string | null
          coverage_uf: string[]
          created_at: string
          display_name: string
          domicile: string | null
          id: string
          is_simulated: boolean
          kyb: Json
          legal_name: string | null
          partner_id: string | null
          provider_type: Database["public"]["Enums"]["capital_provider_type"]
          reporting_requirements: string[]
          required_return_bps: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          commercial_model?: Json
          coverage_note?: string | null
          coverage_uf?: string[]
          created_at?: string
          display_name: string
          domicile?: string | null
          id?: string
          is_simulated?: boolean
          kyb?: Json
          legal_name?: string | null
          partner_id?: string | null
          provider_type: Database["public"]["Enums"]["capital_provider_type"]
          reporting_requirements?: string[]
          required_return_bps?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          commercial_model?: Json
          coverage_note?: string | null
          coverage_uf?: string[]
          created_at?: string
          display_name?: string
          domicile?: string | null
          id?: string
          is_simulated?: boolean
          kyb?: Json
          legal_name?: string | null
          partner_id?: string | null
          provider_type?: Database["public"]["Enums"]["capital_provider_type"]
          reporting_requirements?: string[]
          required_return_bps?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_providers_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_route_decisions: {
        Row: {
          allocations: Json
          decided_at: string
          decision_no: number
          domestic_coverage_cents: number
          eligible_gap_cents: number
          engine_version: string
          evaluated: Json
          external_capital_gap_cents: number | null
          global_coverage_cents: number
          global_eligibility: Json
          id: string
          instrument_policy: Json
          is_simulated: boolean
          need: Json
          opportunity_id: string
          reason_codes: string[]
          requested_cents: number
          snapshot_hash: string | null
          status: Database["public"]["Enums"]["capital_route_status"]
          unfunded_cents: number
        }
        Insert: {
          allocations: Json
          decided_at?: string
          decision_no: number
          domestic_coverage_cents: number
          eligible_gap_cents?: number
          engine_version: string
          evaluated: Json
          external_capital_gap_cents?: number | null
          global_coverage_cents: number
          global_eligibility?: Json
          id?: string
          instrument_policy?: Json
          is_simulated?: boolean
          need?: Json
          opportunity_id: string
          reason_codes: string[]
          requested_cents: number
          snapshot_hash?: string | null
          status: Database["public"]["Enums"]["capital_route_status"]
          unfunded_cents: number
        }
        Update: {
          allocations?: Json
          decided_at?: string
          decision_no?: number
          domestic_coverage_cents?: number
          eligible_gap_cents?: number
          engine_version?: string
          evaluated?: Json
          external_capital_gap_cents?: number | null
          global_coverage_cents?: number
          global_eligibility?: Json
          id?: string
          instrument_policy?: Json
          is_simulated?: boolean
          need?: Json
          opportunity_id?: string
          reason_codes?: string[]
          requested_cents?: number
          snapshot_hash?: string | null
          status?: Database["public"]["Enums"]["capital_route_status"]
          unfunded_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "capital_route_decisions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "qualified_credit_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
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
          reconcile_note: string | null
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
          reconcile_note?: string | null
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
          reconcile_note?: string | null
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
      checkins: {
        Row: {
          active_days: number
          cogs_cents: number
          created_at: string
          entrepreneur_id: string
          household_cents: number
          id: string
          is_simulated: boolean
          keeps_records: boolean
          note: string | null
          opex_cents: number
          period: string
          revenue_cents: number
          submitted_by: string | null
        }
        Insert: {
          active_days: number
          cogs_cents: number
          created_at?: string
          entrepreneur_id: string
          household_cents: number
          id?: string
          is_simulated?: boolean
          keeps_records: boolean
          note?: string | null
          opex_cents: number
          period: string
          revenue_cents: number
          submitted_by?: string | null
        }
        Update: {
          active_days?: number
          cogs_cents?: number
          created_at?: string
          entrepreneur_id?: string
          household_cents?: number
          id?: string
          is_simulated?: boolean
          keeps_records?: boolean
          note?: string | null
          opex_cents?: number
          period?: string
          revenue_cents?: number
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      consents: {
        Row: {
          assessment: boolean
          channel: Database["public"]["Enums"]["consent_channel"]
          consent_no: number
          created_at: string
          entrepreneur_id: string
          id: string
          impact: boolean
          investors: boolean
          is_simulated: boolean
          partner: boolean
          recorded_by: string | null
          text_version: string
        }
        Insert: {
          assessment: boolean
          channel: Database["public"]["Enums"]["consent_channel"]
          consent_no: number
          created_at?: string
          entrepreneur_id: string
          id?: string
          impact: boolean
          investors: boolean
          is_simulated?: boolean
          partner: boolean
          recorded_by?: string | null
          text_version: string
        }
        Update: {
          assessment?: boolean
          channel?: Database["public"]["Enums"]["consent_channel"]
          consent_no?: number
          created_at?: string
          entrepreneur_id?: string
          id?: string
          impact?: boolean
          investors?: boolean
          is_simulated?: boolean
          partner?: boolean
          recorded_by?: string | null
          text_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_events: {
        Row: {
          amount_cents: number
          borne_by: Database["public"]["Enums"]["cost_bearer"]
          community_id: string | null
          created_at: string
          entrepreneur_id: string | null
          fact_id: string
          id: number
          is_simulated: boolean
          phase: string
          rate_version: string
          staff_minutes: number
          stage: Database["public"]["Enums"]["cost_stage"]
        }
        Insert: {
          amount_cents: number
          borne_by: Database["public"]["Enums"]["cost_bearer"]
          community_id?: string | null
          created_at?: string
          entrepreneur_id?: string | null
          fact_id: string
          id?: never
          is_simulated?: boolean
          phase: string
          rate_version: string
          staff_minutes: number
          stage: Database["public"]["Enums"]["cost_stage"]
        }
        Update: {
          amount_cents?: number
          borne_by?: Database["public"]["Enums"]["cost_bearer"]
          community_id?: string | null
          created_at?: string
          entrepreneur_id?: string | null
          fact_id?: string
          id?: never
          is_simulated?: boolean
          phase?: string
          rate_version?: string
          staff_minutes?: number
          stage?: Database["public"]["Enums"]["cost_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "cost_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_events_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_events_rate_version_fkey"
            columns: ["rate_version"]
            isOneToOne: false
            referencedRelation: "cost_rate_cards"
            referencedColumns: ["version"]
          },
        ]
      }
      cost_rate_cards: {
        Row: {
          created_at: string
          effective_from: string
          fixed_monthly_capacity_participants: number | null
          fixed_monthly_cents: number | null
          fixed_monthly_note: string | null
          note: string
          source: string
          version: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          fixed_monthly_capacity_participants?: number | null
          fixed_monthly_cents?: number | null
          fixed_monthly_note?: string | null
          note: string
          source: string
          version: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          fixed_monthly_capacity_participants?: number | null
          fixed_monthly_cents?: number | null
          fixed_monthly_note?: string | null
          note?: string
          source?: string
          version?: string
        }
        Relationships: []
      }
      cost_rates: {
        Row: {
          borne_by: Database["public"]["Enums"]["cost_bearer"]
          card_version: string
          fixed_cents: number
          hourly_rate_cents: number
          note: string
          phase: string
          staff_minutes: number
          stage: Database["public"]["Enums"]["cost_stage"]
        }
        Insert: {
          borne_by: Database["public"]["Enums"]["cost_bearer"]
          card_version: string
          fixed_cents: number
          hourly_rate_cents: number
          note: string
          phase: string
          staff_minutes: number
          stage: Database["public"]["Enums"]["cost_stage"]
        }
        Update: {
          borne_by?: Database["public"]["Enums"]["cost_bearer"]
          card_version?: string
          fixed_cents?: number
          hourly_rate_cents?: number
          note?: string
          phase?: string
          staff_minutes?: number
          stage?: Database["public"]["Enums"]["cost_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "cost_rates_card_version_fkey"
            columns: ["card_version"]
            isOneToOne: false
            referencedRelation: "cost_rate_cards"
            referencedColumns: ["version"]
          },
        ]
      }
      credit_intents: {
        Row: {
          created_at: string
          declared_by: string | null
          description: string | null
          entrepreneur_id: string
          id: string
          is_simulated: boolean
          purpose: Database["public"]["Enums"]["credit_purpose"]
          requested_amount_cents: number
          status: Database["public"]["Enums"]["credit_intent_status"]
          supplier_geography:
            | Database["public"]["Enums"]["supplier_geography"]
            | null
          withdrawn_at: string | null
        }
        Insert: {
          created_at?: string
          declared_by?: string | null
          description?: string | null
          entrepreneur_id: string
          id?: string
          is_simulated?: boolean
          purpose: Database["public"]["Enums"]["credit_purpose"]
          requested_amount_cents: number
          status?: Database["public"]["Enums"]["credit_intent_status"]
          supplier_geography?:
            | Database["public"]["Enums"]["supplier_geography"]
            | null
          withdrawn_at?: string | null
        }
        Update: {
          created_at?: string
          declared_by?: string | null
          description?: string | null
          entrepreneur_id?: string
          id?: string
          is_simulated?: boolean
          purpose?: Database["public"]["Enums"]["credit_purpose"]
          requested_amount_cents?: number
          status?: Database["public"]["Enums"]["credit_intent_status"]
          supplier_geography?:
            | Database["public"]["Enums"]["supplier_geography"]
            | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_intents_declared_by_fkey"
            columns: ["declared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_intents_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_positions: {
        Row: {
          asset_no: number
          closed_at: string | null
          created_at: string
          id: string
          investment_id: string
          investor_id: string
          is_simulated: boolean
          mint_address: string | null
          mint_claimed_at: string | null
          mint_error: string | null
          mint_signature: string | null
          minted_at: string | null
          opportunity_id: string
          owner_wallet: string | null
          principal_micro_usdc: number
          share_bps: number
          token_account: string | null
        }
        Insert: {
          asset_no?: never
          closed_at?: string | null
          created_at?: string
          id?: string
          investment_id: string
          investor_id: string
          is_simulated?: boolean
          mint_address?: string | null
          mint_claimed_at?: string | null
          mint_error?: string | null
          mint_signature?: string | null
          minted_at?: string | null
          opportunity_id: string
          owner_wallet?: string | null
          principal_micro_usdc: number
          share_bps: number
          token_account?: string | null
        }
        Update: {
          asset_no?: never
          closed_at?: string | null
          created_at?: string
          id?: string
          investment_id?: string
          investor_id?: string
          is_simulated?: boolean
          mint_address?: string | null
          mint_claimed_at?: string | null
          mint_error?: string | null
          mint_signature?: string | null
          minted_at?: string | null
          opportunity_id?: string
          owner_wallet?: string | null
          principal_micro_usdc?: number
          share_bps?: number
          token_account?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_positions_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: true
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_positions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_positions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "qualified_credit_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      education_modules: {
        Row: {
          created_at: string
          estimated_minutes: number
          id: string
          position: number
          program_id: string
          title: string
        }
        Insert: {
          created_at?: string
          estimated_minutes: number
          id?: string
          position: number
          program_id: string
          title: string
        }
        Update: {
          created_at?: string
          estimated_minutes?: number
          id?: string
          position?: number
          program_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_modules_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "education_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      education_programs: {
        Row: {
          community_id: string | null
          created_at: string
          description: string | null
          id: string
          is_simulated: boolean
          title: string
        }
        Insert: {
          community_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_simulated?: boolean
          title: string
        }
        Update: {
          community_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_simulated?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_programs_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      education_progress: {
        Row: {
          completed_at: string | null
          entrepreneur_id: string
          module_id: string
          recorded_by: string | null
          started_at: string
          status: Database["public"]["Enums"]["education_status"]
        }
        Insert: {
          completed_at?: string | null
          entrepreneur_id: string
          module_id: string
          recorded_by?: string | null
          started_at?: string
          status: Database["public"]["Enums"]["education_status"]
        }
        Update: {
          completed_at?: string | null
          entrepreneur_id?: string
          module_id?: string
          recorded_by?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["education_status"]
        }
        Relationships: [
          {
            foreignKeyName: "education_progress_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "education_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "education_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "education_progress_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_assessments: {
        Row: {
          affordability_bps: number | null
          confidence: Database["public"]["Enums"]["grade"]
          created_at: string
          decision: Database["public"]["Enums"]["eligibility_decision"]
          eligibility_no: number
          entrepreneur_id: string
          id: string
          inputs: Json
          instalment_cents: number | null
          intent_id: string
          is_simulated: boolean
          max_instalment_cents: number
          model_version: string
          proposed_amount_cents: number | null
          readiness_assessment_id: string
          reason_codes: string[]
          requested_amount_cents: number
          risk_band: Database["public"]["Enums"]["grade"]
          risk_points: number
          suggested_max_cents: number | null
          suggested_min_cents: number | null
          term_months: number | null
        }
        Insert: {
          affordability_bps?: number | null
          confidence: Database["public"]["Enums"]["grade"]
          created_at?: string
          decision: Database["public"]["Enums"]["eligibility_decision"]
          eligibility_no: number
          entrepreneur_id: string
          id?: string
          inputs: Json
          instalment_cents?: number | null
          intent_id: string
          is_simulated?: boolean
          max_instalment_cents: number
          model_version: string
          proposed_amount_cents?: number | null
          readiness_assessment_id: string
          reason_codes: string[]
          requested_amount_cents: number
          risk_band: Database["public"]["Enums"]["grade"]
          risk_points: number
          suggested_max_cents?: number | null
          suggested_min_cents?: number | null
          term_months?: number | null
        }
        Update: {
          affordability_bps?: number | null
          confidence?: Database["public"]["Enums"]["grade"]
          created_at?: string
          decision?: Database["public"]["Enums"]["eligibility_decision"]
          eligibility_no?: number
          entrepreneur_id?: string
          id?: string
          inputs?: Json
          instalment_cents?: number | null
          intent_id?: string
          is_simulated?: boolean
          max_instalment_cents?: number
          model_version?: string
          proposed_amount_cents?: number | null
          readiness_assessment_id?: string
          reason_codes?: string[]
          requested_amount_cents?: number
          risk_band?: Database["public"]["Enums"]["grade"]
          risk_points?: number
          suggested_max_cents?: number | null
          suggested_min_cents?: number | null
          term_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_assessments_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_assessments_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "credit_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_assessments_readiness_assessment_id_fkey"
            columns: ["readiness_assessment_id"]
            isOneToOne: false
            referencedRelation: "latest_readiness"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_assessments_readiness_assessment_id_fkey"
            columns: ["readiness_assessment_id"]
            isOneToOne: false
            referencedRelation: "readiness_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      eligible_wallets: {
        Row: {
          active: boolean
          admitted_by: string | null
          created_at: string
          is_simulated: boolean
          label: string
          note: string | null
          wallet: string
        }
        Insert: {
          active?: boolean
          admitted_by?: string | null
          created_at?: string
          is_simulated?: boolean
          label: string
          note?: string | null
          wallet: string
        }
        Update: {
          active?: boolean
          admitted_by?: string | null
          created_at?: string
          is_simulated?: boolean
          label?: string
          note?: string | null
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligible_wallets_admitted_by_fkey"
            columns: ["admitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      funding_pools: {
        Row: {
          capital_cents: number | null
          capital_micro_usdc: number | null
          eligible_risk_bands: Database["public"]["Enums"]["grade"][]
          fx_hedge_bps: number
          impact_mandate: boolean
          is_simulated: boolean
          max_ticket_cents: number
          min_ticket_cents: number
          name: string
          pool: Database["public"]["Enums"]["funding_pool"]
          purposes: Database["public"]["Enums"]["credit_purpose"][]
          ramp_bps: number
          required_return_bps: number
          updated_at: string
        }
        Insert: {
          capital_cents?: number | null
          capital_micro_usdc?: number | null
          eligible_risk_bands: Database["public"]["Enums"]["grade"][]
          fx_hedge_bps?: number
          impact_mandate?: boolean
          is_simulated?: boolean
          max_ticket_cents: number
          min_ticket_cents: number
          name: string
          pool: Database["public"]["Enums"]["funding_pool"]
          purposes?: Database["public"]["Enums"]["credit_purpose"][]
          ramp_bps?: number
          required_return_bps: number
          updated_at?: string
        }
        Update: {
          capital_cents?: number | null
          capital_micro_usdc?: number | null
          eligible_risk_bands?: Database["public"]["Enums"]["grade"][]
          fx_hedge_bps?: number
          impact_mandate?: boolean
          is_simulated?: boolean
          max_ticket_cents?: number
          min_ticket_cents?: number
          name?: string
          pool?: Database["public"]["Enums"]["funding_pool"]
          purposes?: Database["public"]["Enums"]["credit_purpose"][]
          ramp_bps?: number
          required_return_bps?: number
          updated_at?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          ask_milli: number
          bid_milli: number
          fetched_at: string
          id: number
          mid_milli: number
          observed_at: string
          pair: string
          source: string
        }
        Insert: {
          ask_milli: number
          bid_milli: number
          fetched_at?: string
          id?: never
          mid_milli: number
          observed_at: string
          pair: string
          source: string
        }
        Update: {
          ask_milli?: number
          bid_milli?: number
          fetched_at?: string
          id?: never
          mid_milli?: number
          observed_at?: string
          pair?: string
          source?: string
        }
        Relationships: []
      }
      investments: {
        Row: {
          allocation_ref: string
          amount_cents: number | null
          amount_micro_usdc: number
          created_at: string
          deposit_signature: string | null
          id: string
          investor_id: string
          is_simulated: boolean
          mode: Database["public"]["Enums"]["investment_mode"]
          opportunity_id: string
          refund_claimed_at: string | null
          refund_error: string | null
          refund_signature: string | null
          refund_valid_until: number | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["investment_status"]
          wallet_address: string | null
        }
        Insert: {
          allocation_ref?: string
          amount_cents?: number | null
          amount_micro_usdc: number
          created_at?: string
          deposit_signature?: string | null
          id?: string
          investor_id: string
          is_simulated?: boolean
          mode: Database["public"]["Enums"]["investment_mode"]
          opportunity_id: string
          refund_claimed_at?: string | null
          refund_error?: string | null
          refund_signature?: string | null
          refund_valid_until?: number | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["investment_status"]
          wallet_address?: string | null
        }
        Update: {
          allocation_ref?: string
          amount_cents?: number | null
          amount_micro_usdc?: number
          created_at?: string
          deposit_signature?: string | null
          id?: string
          investor_id?: string
          is_simulated?: boolean
          mode?: Database["public"]["Enums"]["investment_mode"]
          opportunity_id?: string
          refund_claimed_at?: string | null
          refund_error?: string | null
          refund_signature?: string | null
          refund_valid_until?: number | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["investment_status"]
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "qualified_credit_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_mandates: {
        Row: {
          impact_mandate: boolean
          investor_id: string
          is_simulated: boolean
          kind: Database["public"]["Enums"]["investor_kind"]
          label: string | null
          max_ticket_cents: number | null
          min_ticket_cents: number | null
          pools: Database["public"]["Enums"]["funding_pool"][]
          purposes: Database["public"]["Enums"]["credit_purpose"][]
          risk_bands: Database["public"]["Enums"]["grade"][]
          sectors: string[]
          states: string[]
          updated_at: string
        }
        Insert: {
          impact_mandate?: boolean
          investor_id: string
          is_simulated?: boolean
          kind?: Database["public"]["Enums"]["investor_kind"]
          label?: string | null
          max_ticket_cents?: number | null
          min_ticket_cents?: number | null
          pools?: Database["public"]["Enums"]["funding_pool"][]
          purposes?: Database["public"]["Enums"]["credit_purpose"][]
          risk_bands?: Database["public"]["Enums"]["grade"][]
          sectors?: string[]
          states?: string[]
          updated_at?: string
        }
        Update: {
          impact_mandate?: boolean
          investor_id?: string
          is_simulated?: boolean
          kind?: Database["public"]["Enums"]["investor_kind"]
          label?: string | null
          max_ticket_cents?: number | null
          min_ticket_cents?: number | null
          pools?: Database["public"]["Enums"]["funding_pool"][]
          purposes?: Database["public"]["Enums"]["credit_purpose"][]
          risk_bands?: Database["public"]["Enums"]["grade"][]
          sectors?: string[]
          states?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_mandates_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_events: {
        Row: {
          actor: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["loan_status"]
          id: string
          is_simulated: boolean
          loan_id: string
          note: string | null
          to_status: Database["public"]["Enums"]["loan_status"]
        }
        Insert: {
          actor?: string | null
          created_at?: string
          from_status: Database["public"]["Enums"]["loan_status"]
          id?: string
          is_simulated?: boolean
          loan_id: string
          note?: string | null
          to_status: Database["public"]["Enums"]["loan_status"]
        }
        Update: {
          actor?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["loan_status"]
          id?: string
          is_simulated?: boolean
          loan_id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["loan_status"]
        }
        Relationships: [
          {
            foreignKeyName: "loan_events_actor_fkey"
            columns: ["actor"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_events_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          created_at: string
          decision_id: string
          disbursed_at: string | null
          entrepreneur_id: string
          id: string
          instalment_cents: number
          is_simulated: boolean
          opportunity_id: string
          partner_id: string
          principal_cents: number
          rate_bps: number
          status: Database["public"]["Enums"]["loan_status"]
          term_months: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision_id: string
          disbursed_at?: string | null
          entrepreneur_id: string
          id?: string
          instalment_cents: number
          is_simulated?: boolean
          opportunity_id: string
          partner_id: string
          principal_cents: number
          rate_bps: number
          status?: Database["public"]["Enums"]["loan_status"]
          term_months: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision_id?: string
          disbursed_at?: string | null
          entrepreneur_id?: string
          id?: string
          instalment_cents?: number
          is_simulated?: boolean
          opportunity_id?: string
          partner_id?: string
          principal_cents?: number
          rate_bps?: number
          status?: Database["public"]["Enums"]["loan_status"]
          term_months?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "partner_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "qualified_credit_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      local_accounts: {
        Row: {
          balance_units: number
          created_at: string
          economy_id: string
          id: string
          owner_id: string | null
          owner_type: Database["public"]["Enums"]["local_owner_type"]
        }
        Insert: {
          balance_units?: number
          created_at?: string
          economy_id: string
          id?: string
          owner_id?: string | null
          owner_type: Database["public"]["Enums"]["local_owner_type"]
        }
        Update: {
          balance_units?: number
          created_at?: string
          economy_id?: string
          id?: string
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["local_owner_type"]
        }
        Relationships: [
          {
            foreignKeyName: "local_accounts_economy_id_fkey"
            columns: ["economy_id"]
            isOneToOne: false
            referencedRelation: "local_economies"
            referencedColumns: ["id"]
          },
        ]
      }
      local_conversions: {
        Row: {
          brl_cents: number
          direction: Database["public"]["Enums"]["local_conversion_direction"]
          economy_id: string
          evidence_status: Database["public"]["Enums"]["evidence_label"]
          id: string
          loan_id: string | null
          note: string | null
          occurred_at: string
          parity_bps: number
          payment_id: string | null
          transaction_id: string | null
          units: number
        }
        Insert: {
          brl_cents: number
          direction: Database["public"]["Enums"]["local_conversion_direction"]
          economy_id: string
          evidence_status?: Database["public"]["Enums"]["evidence_label"]
          id?: string
          loan_id?: string | null
          note?: string | null
          occurred_at?: string
          parity_bps: number
          payment_id?: string | null
          transaction_id?: string | null
          units: number
        }
        Update: {
          brl_cents?: number
          direction?: Database["public"]["Enums"]["local_conversion_direction"]
          economy_id?: string
          evidence_status?: Database["public"]["Enums"]["evidence_label"]
          id?: string
          loan_id?: string | null
          note?: string | null
          occurred_at?: string
          parity_bps?: number
          payment_id?: string | null
          transaction_id?: string | null
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "local_conversions_economy_id_fkey"
            columns: ["economy_id"]
            isOneToOne: false
            referencedRelation: "local_economies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_conversions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_conversions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_conversions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "local_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      local_economies: {
        Row: {
          code: string
          community_id: string | null
          created_at: string
          currency_code: string
          id: string
          is_simulated: boolean
          name: string
          parity_bps: number
          parity_reference: string
          status: Database["public"]["Enums"]["local_economy_status"]
          territory: string
          uf: string
        }
        Insert: {
          code: string
          community_id?: string | null
          created_at?: string
          currency_code: string
          id?: string
          is_simulated?: boolean
          name: string
          parity_bps?: number
          parity_reference: string
          status?: Database["public"]["Enums"]["local_economy_status"]
          territory: string
          uf: string
        }
        Update: {
          code?: string
          community_id?: string | null
          created_at?: string
          currency_code?: string
          id?: string
          is_simulated?: boolean
          name?: string
          parity_bps?: number
          parity_reference?: string
          status?: Database["public"]["Enums"]["local_economy_status"]
          territory?: string
          uf?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_economies_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      local_merchants: {
        Row: {
          city: string
          code: string
          created_at: string
          economy_id: string
          eligible: boolean
          id: string
          is_simulated: boolean
          name: string
          neighbourhood: string | null
          sector: string
          uf: string
        }
        Insert: {
          city: string
          code: string
          created_at?: string
          economy_id: string
          eligible?: boolean
          id?: string
          is_simulated?: boolean
          name: string
          neighbourhood?: string | null
          sector: string
          uf: string
        }
        Update: {
          city?: string
          code?: string
          created_at?: string
          economy_id?: string
          eligible?: boolean
          id?: string
          is_simulated?: boolean
          name?: string
          neighbourhood?: string | null
          sector?: string
          uf?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_merchants_economy_id_fkey"
            columns: ["economy_id"]
            isOneToOne: false
            referencedRelation: "local_economies"
            referencedColumns: ["id"]
          },
        ]
      }
      local_redemptions: {
        Row: {
          amount_brl_cents: number
          amount_units: number
          economy_id: string
          evidence_status: Database["public"]["Enums"]["evidence_label"]
          id: string
          merchant_id: string
          requested_at: string
          settled_at: string | null
          status: Database["public"]["Enums"]["local_redemption_status"]
          transaction_id: string | null
        }
        Insert: {
          amount_brl_cents: number
          amount_units: number
          economy_id: string
          evidence_status?: Database["public"]["Enums"]["evidence_label"]
          id?: string
          merchant_id: string
          requested_at?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["local_redemption_status"]
          transaction_id?: string | null
        }
        Update: {
          amount_brl_cents?: number
          amount_units?: number
          economy_id?: string
          evidence_status?: Database["public"]["Enums"]["evidence_label"]
          id?: string
          merchant_id?: string
          requested_at?: string
          settled_at?: string | null
          status?: Database["public"]["Enums"]["local_redemption_status"]
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "local_redemptions_economy_id_fkey"
            columns: ["economy_id"]
            isOneToOne: false
            referencedRelation: "local_economies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_redemptions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "local_merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_redemptions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "local_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      local_transactions: {
        Row: {
          amount_units: number
          created_at: string
          economy_id: string
          evidence_status: Database["public"]["Enums"]["evidence_label"]
          from_account_id: string
          id: string
          loan_id: string | null
          merchant_id: string | null
          note: string | null
          occurred_at: string
          opportunity_id: string | null
          purpose: Database["public"]["Enums"]["credit_purpose"] | null
          to_account_id: string
          transaction_no: number
          tx_type: Database["public"]["Enums"]["local_transaction_type"]
        }
        Insert: {
          amount_units: number
          created_at?: string
          economy_id: string
          evidence_status?: Database["public"]["Enums"]["evidence_label"]
          from_account_id: string
          id?: string
          loan_id?: string | null
          merchant_id?: string | null
          note?: string | null
          occurred_at?: string
          opportunity_id?: string | null
          purpose?: Database["public"]["Enums"]["credit_purpose"] | null
          to_account_id: string
          transaction_no: number
          tx_type: Database["public"]["Enums"]["local_transaction_type"]
        }
        Update: {
          amount_units?: number
          created_at?: string
          economy_id?: string
          evidence_status?: Database["public"]["Enums"]["evidence_label"]
          from_account_id?: string
          id?: string
          loan_id?: string | null
          merchant_id?: string | null
          note?: string | null
          occurred_at?: string
          opportunity_id?: string | null
          purpose?: Database["public"]["Enums"]["credit_purpose"] | null
          to_account_id?: string
          transaction_no?: number
          tx_type?: Database["public"]["Enums"]["local_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "local_transactions_economy_id_fkey"
            columns: ["economy_id"]
            isOneToOne: false
            referencedRelation: "local_economies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_transactions_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "local_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_transactions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "local_merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_transactions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "qualified_credit_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_transactions_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "local_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      operating_economics_snapshots: {
        Row: {
          allocation_model_version: string | null
          by_phase: Json
          by_stage: Json
          cost_total_cents: number
          created_at: string
          events: number
          mobilization_cents: number | null
          mobilization_rate_bps: number | null
          mobilized_cents: number | null
          opportunity_id: string
          per_100_of_ticket_cents: number | null
          rate_card_version: string
          staff_minutes: number
          taken_at: string
          ticket_cents: number
        }
        Insert: {
          allocation_model_version?: string | null
          by_phase: Json
          by_stage: Json
          cost_total_cents: number
          created_at?: string
          events: number
          mobilization_cents?: number | null
          mobilization_rate_bps?: number | null
          mobilized_cents?: number | null
          opportunity_id: string
          per_100_of_ticket_cents?: number | null
          rate_card_version: string
          staff_minutes: number
          taken_at: string
          ticket_cents: number
        }
        Update: {
          allocation_model_version?: string | null
          by_phase?: Json
          by_stage?: Json
          cost_total_cents?: number
          created_at?: string
          events?: number
          mobilization_cents?: number | null
          mobilization_rate_bps?: number | null
          mobilized_cents?: number | null
          opportunity_id?: string
          per_100_of_ticket_cents?: number | null
          rate_card_version?: string
          staff_minutes?: number
          taken_at?: string
          ticket_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "operating_economics_snapshots_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: true
            referencedRelation: "qualified_credit_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operating_economics_snapshots_rate_card_version_fkey"
            columns: ["rate_card_version"]
            isOneToOne: false
            referencedRelation: "cost_rate_cards"
            referencedColumns: ["version"]
          },
        ]
      }
      outreach_events: {
        Row: {
          action: Database["public"]["Enums"]["outreach_action"]
          community_id: string
          created_at: string
          created_by: string | null
          entrepreneur_id: string
          id: string
          is_simulated: boolean
          note: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["outreach_action"]
          community_id: string
          created_at?: string
          created_by?: string | null
          entrepreneur_id: string
          id?: string
          is_simulated?: boolean
          note?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["outreach_action"]
          community_id?: string
          created_at?: string
          created_by?: string | null
          entrepreneur_id?: string
          id?: string
          is_simulated?: boolean
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_events_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_events_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_decisions: {
        Row: {
          approved_amount_cents: number | null
          created_at: string
          decided_by: string | null
          id: string
          is_simulated: boolean
          opportunity_id: string
          partner_id: string
          rate_bps: number | null
          reason: string | null
          term_months: number | null
          verdict: Database["public"]["Enums"]["partner_verdict"]
        }
        Insert: {
          approved_amount_cents?: number | null
          created_at?: string
          decided_by?: string | null
          id?: string
          is_simulated?: boolean
          opportunity_id: string
          partner_id: string
          rate_bps?: number | null
          reason?: string | null
          term_months?: number | null
          verdict: Database["public"]["Enums"]["partner_verdict"]
        }
        Update: {
          approved_amount_cents?: number | null
          created_at?: string
          decided_by?: string | null
          id?: string
          is_simulated?: boolean
          opportunity_id?: string
          partner_id?: string
          rate_bps?: number | null
          reason?: string | null
          term_months?: number | null
          verdict?: Database["public"]["Enums"]["partner_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "partner_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_decisions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "qualified_credit_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_decisions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
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
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          instalment_no: number
          is_simulated: boolean
          loan_id: string
          paid_at: string
          recorded_by: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          instalment_no: number
          is_simulated?: boolean
          loan_id: string
          paid_at: string
          recorded_by?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          instalment_no?: number
          is_simulated?: boolean
          loan_id?: string
          paid_at?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      position_events: {
        Row: {
          created_at: string
          detail: Json
          from_wallet: string | null
          id: number
          kind: string
          occurred_at: string
          position_id: string
          signature: string | null
          to_wallet: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json
          from_wallet?: string | null
          id?: never
          kind: string
          occurred_at?: string
          position_id: string
          signature?: string | null
          to_wallet?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json
          from_wallet?: string | null
          id?: never
          kind?: string
          occurred_at?: string
          position_id?: string
          signature?: string | null
          to_wallet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "position_events_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "credit_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_cards: {
        Row: {
          billing_model: string
          community_share_cents: number
          created_at: string
          effective_from: string
          floor_cents: number
          is_default: boolean
          note: string
          seat_cents: number
          source: string
          version: string
        }
        Insert: {
          billing_model: string
          community_share_cents?: number
          created_at?: string
          effective_from: string
          floor_cents: number
          is_default?: boolean
          note: string
          seat_cents: number
          source: string
          version: string
        }
        Update: {
          billing_model?: string
          community_share_cents?: number
          created_at?: string
          effective_from?: string
          floor_cents?: number
          is_default?: boolean
          note?: string
          seat_cents?: number
          source?: string
          version?: string
        }
        Relationships: []
      }
      productive_outcomes: {
        Row: {
          avg_net_after_cents: number
          avg_net_before_cents: number
          avg_revenue_after_cents: number
          avg_revenue_before_cents: number
          capital_use: Database["public"]["Enums"]["capital_use"]
          confidence: Database["public"]["Enums"]["grade"]
          cost_of_credit_cents: number
          disbursement_period: string
          entrepreneur_id: string
          evc_cents: number
          id: string
          incremental_profit_cents: number
          is_simulated: boolean
          loan_id: string
          measured_at: string
          measured_by: string | null
          model_version: string
          months_after: number
          months_before: number
          outcome_no: number
        }
        Insert: {
          avg_net_after_cents: number
          avg_net_before_cents: number
          avg_revenue_after_cents: number
          avg_revenue_before_cents: number
          capital_use: Database["public"]["Enums"]["capital_use"]
          confidence: Database["public"]["Enums"]["grade"]
          cost_of_credit_cents: number
          disbursement_period: string
          entrepreneur_id: string
          evc_cents: number
          id?: string
          incremental_profit_cents: number
          is_simulated?: boolean
          loan_id: string
          measured_at?: string
          measured_by?: string | null
          model_version: string
          months_after: number
          months_before: number
          outcome_no: number
        }
        Update: {
          avg_net_after_cents?: number
          avg_net_before_cents?: number
          avg_revenue_after_cents?: number
          avg_revenue_before_cents?: number
          capital_use?: Database["public"]["Enums"]["capital_use"]
          confidence?: Database["public"]["Enums"]["grade"]
          cost_of_credit_cents?: number
          disbursement_period?: string
          entrepreneur_id?: string
          evc_cents?: number
          id?: string
          incremental_profit_cents?: number
          is_simulated?: boolean
          loan_id?: string
          measured_at?: string
          measured_by?: string | null
          model_version?: string
          months_after?: number
          months_before?: number
          outcome_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "productive_outcomes_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productive_outcomes_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "productive_outcomes_measured_by_fkey"
            columns: ["measured_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          partner_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          sponsor_id: string | null
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          partner_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          sponsor_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          partner_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          sponsor_id?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      program_communities: {
        Row: {
          community_id: string
          program_id: string
        }
        Insert: {
          community_id: string
          program_id: string
        }
        Update: {
          community_id?: string
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_communities_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_communities_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          description: string | null
          funding_committed_cents: number
          funding_deployed_cents: number
          id: string
          is_simulated: boolean
          name: string
          period_end: string
          period_start: string
          sponsor_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          funding_committed_cents: number
          funding_deployed_cents?: number
          id?: string
          is_simulated?: boolean
          name: string
          period_end: string
          period_start: string
          sponsor_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          funding_committed_cents?: number
          funding_deployed_cents?: number
          id?: string
          is_simulated?: boolean
          name?: string
          period_end?: string
          period_start?: string
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      qualified_credit_opportunities: {
        Row: {
          allocated_at: string | null
          allocation: Json | null
          allocation_model_version: string | null
          allocation_reason_codes: string[] | null
          amount_cents: number
          confidence: Database["public"]["Enums"]["grade"]
          created_at: string
          desired_date: string | null
          documents_on_file: string[]
          eligibility_id: string
          entrepreneur_id: string
          funded_micro_usdc: number
          funding_pool: Database["public"]["Enums"]["funding_pool"] | null
          funding_status: Database["public"]["Enums"]["funding_status"] | null
          funding_target_micro_usdc: number | null
          fx_brl_per_usdc_milli: number | null
          id: string
          instalment_cents: number
          intent_id: string
          is_simulated: boolean
          opportunity_no: number
          partner_id: string | null
          purpose: Database["public"]["Enums"]["credit_purpose"]
          referred_at: string | null
          risk_band: Database["public"]["Enums"]["grade"]
          status: Database["public"]["Enums"]["opportunity_status"]
          term_months: number
          urgency: string | null
        }
        Insert: {
          allocated_at?: string | null
          allocation?: Json | null
          allocation_model_version?: string | null
          allocation_reason_codes?: string[] | null
          amount_cents: number
          confidence: Database["public"]["Enums"]["grade"]
          created_at?: string
          desired_date?: string | null
          documents_on_file?: string[]
          eligibility_id: string
          entrepreneur_id: string
          funded_micro_usdc?: number
          funding_pool?: Database["public"]["Enums"]["funding_pool"] | null
          funding_status?: Database["public"]["Enums"]["funding_status"] | null
          funding_target_micro_usdc?: number | null
          fx_brl_per_usdc_milli?: number | null
          id?: string
          instalment_cents: number
          intent_id: string
          is_simulated?: boolean
          opportunity_no: number
          partner_id?: string | null
          purpose: Database["public"]["Enums"]["credit_purpose"]
          referred_at?: string | null
          risk_band: Database["public"]["Enums"]["grade"]
          status: Database["public"]["Enums"]["opportunity_status"]
          term_months: number
          urgency?: string | null
        }
        Update: {
          allocated_at?: string | null
          allocation?: Json | null
          allocation_model_version?: string | null
          allocation_reason_codes?: string[] | null
          amount_cents?: number
          confidence?: Database["public"]["Enums"]["grade"]
          created_at?: string
          desired_date?: string | null
          documents_on_file?: string[]
          eligibility_id?: string
          entrepreneur_id?: string
          funded_micro_usdc?: number
          funding_pool?: Database["public"]["Enums"]["funding_pool"] | null
          funding_status?: Database["public"]["Enums"]["funding_status"] | null
          funding_target_micro_usdc?: number | null
          fx_brl_per_usdc_milli?: number | null
          id?: string
          instalment_cents?: number
          intent_id?: string
          is_simulated?: boolean
          opportunity_no?: number
          partner_id?: string | null
          purpose?: Database["public"]["Enums"]["credit_purpose"]
          referred_at?: string | null
          risk_band?: Database["public"]["Enums"]["grade"]
          status?: Database["public"]["Enums"]["opportunity_status"]
          term_months?: number
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qualified_credit_opportunities_eligibility_id_fkey"
            columns: ["eligibility_id"]
            isOneToOne: false
            referencedRelation: "eligibility_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualified_credit_opportunities_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualified_credit_opportunities_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: true
            referencedRelation: "credit_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualified_credit_opportunities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      readiness_assessments: {
        Row: {
          as_of_period: string
          assessment_no: number
          band: Database["public"]["Enums"]["readiness_band"]
          components: Json
          created_at: string
          entrepreneur_id: string
          features: Json
          id: string
          is_simulated: boolean
          missing_requirements: Json
          model_version: string
          reason_codes: string[]
          requested_by: string | null
          score: number
          status: Database["public"]["Enums"]["readiness_status"]
        }
        Insert: {
          as_of_period: string
          assessment_no: number
          band: Database["public"]["Enums"]["readiness_band"]
          components: Json
          created_at?: string
          entrepreneur_id: string
          features: Json
          id?: string
          is_simulated?: boolean
          missing_requirements: Json
          model_version: string
          reason_codes: string[]
          requested_by?: string | null
          score: number
          status: Database["public"]["Enums"]["readiness_status"]
        }
        Update: {
          as_of_period?: string
          assessment_no?: number
          band?: Database["public"]["Enums"]["readiness_band"]
          components?: Json
          created_at?: string
          entrepreneur_id?: string
          features?: Json
          id?: string
          is_simulated?: boolean
          missing_requirements?: Json
          model_version?: string
          reason_codes?: string[]
          requested_by?: string | null
          score?: number
          status?: Database["public"]["Enums"]["readiness_status"]
        }
        Relationships: [
          {
            foreignKeyName: "readiness_assessments_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readiness_assessments_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_points: {
        Row: {
          created_at: string
          evidence_status: Database["public"]["Enums"]["evidence_label"]
          key: string
          label: string
          note: string | null
          observed_period: string | null
          source: string
          source_url: string
          value_bps: number | null
          value_cents: number | null
          value_count: number | null
        }
        Insert: {
          created_at?: string
          evidence_status?: Database["public"]["Enums"]["evidence_label"]
          key: string
          label: string
          note?: string | null
          observed_period?: string | null
          source: string
          source_url: string
          value_bps?: number | null
          value_cents?: number | null
          value_count?: number | null
        }
        Update: {
          created_at?: string
          evidence_status?: Database["public"]["Enums"]["evidence_label"]
          key?: string
          label?: string
          note?: string | null
          observed_period?: string | null
          source?: string
          source_url?: string
          value_bps?: number | null
          value_cents?: number | null
          value_count?: number | null
        }
        Relationships: []
      }
      settlement_decisions: {
        Row: {
          compared: Json
          compared_gross_micro_usdc: number
          decided_at: string
          loan_id: string
          model_version: string
          net_brl_delta_cents: number | null
          principal_cents: number | null
          reason_codes: string[]
          selected_quote_id: string | null
          selected_route: Database["public"]["Enums"]["settlement_route"] | null
        }
        Insert: {
          compared: Json
          compared_gross_micro_usdc: number
          decided_at?: string
          loan_id: string
          model_version: string
          net_brl_delta_cents?: number | null
          principal_cents?: number | null
          reason_codes: string[]
          selected_quote_id?: string | null
          selected_route?:
            | Database["public"]["Enums"]["settlement_route"]
            | null
        }
        Update: {
          compared?: Json
          compared_gross_micro_usdc?: number
          decided_at?: string
          loan_id?: string
          model_version?: string
          net_brl_delta_cents?: number | null
          principal_cents?: number | null
          reason_codes?: string[]
          selected_quote_id?: string | null
          selected_route?:
            | Database["public"]["Enums"]["settlement_route"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_decisions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_decisions_selected_quote_id_fkey"
            columns: ["selected_quote_id"]
            isOneToOne: false
            referencedRelation: "settlement_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_legs: {
        Row: {
          amount_cents: number | null
          amount_micro_usdc: number | null
          created_at: string
          destination: string | null
          done_at: string | null
          id: string
          investment_id: string | null
          kind: Database["public"]["Enums"]["settlement_leg_kind"]
          loan_id: string
          payment_id: string | null
          pix_e2e: string | null
          quote_id: string | null
          route: Database["public"]["Enums"]["settlement_route"] | null
          status: Database["public"]["Enums"]["settlement_leg_status"]
          transfer_id: number | null
        }
        Insert: {
          amount_cents?: number | null
          amount_micro_usdc?: number | null
          created_at?: string
          destination?: string | null
          done_at?: string | null
          id?: string
          investment_id?: string | null
          kind: Database["public"]["Enums"]["settlement_leg_kind"]
          loan_id: string
          payment_id?: string | null
          pix_e2e?: string | null
          quote_id?: string | null
          route?: Database["public"]["Enums"]["settlement_route"] | null
          status: Database["public"]["Enums"]["settlement_leg_status"]
          transfer_id?: number | null
        }
        Update: {
          amount_cents?: number | null
          amount_micro_usdc?: number | null
          created_at?: string
          destination?: string | null
          done_at?: string | null
          id?: string
          investment_id?: string | null
          kind?: Database["public"]["Enums"]["settlement_leg_kind"]
          loan_id?: string
          payment_id?: string | null
          pix_e2e?: string | null
          quote_id?: string | null
          route?: Database["public"]["Enums"]["settlement_route"] | null
          status?: Database["public"]["Enums"]["settlement_leg_status"]
          transfer_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_legs_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_legs_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_legs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_legs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "settlement_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_legs_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "vault_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_providers: {
        Row: {
          asset: string
          enabled: boolean
          execution_eta_sec: number
          fx_spread_bps: number
          fx_struck: string
          liquidity_cents: number
          max_ticket_cents: number
          min_ticket_cents: number
          name: string
          network_fee_cents: number
          provider: string
          provider_fee_bps: number
          provider_fee_fixed_cents: number
          quote_ttl_sec: number
          reality: Database["public"]["Enums"]["quote_reality"]
          route: Database["public"]["Enums"]["settlement_route"]
          source_url: string | null
          updated_at: string
        }
        Insert: {
          asset: string
          enabled?: boolean
          execution_eta_sec: number
          fx_spread_bps: number
          fx_struck: string
          liquidity_cents: number
          max_ticket_cents: number
          min_ticket_cents: number
          name: string
          network_fee_cents?: number
          provider: string
          provider_fee_bps: number
          provider_fee_fixed_cents?: number
          quote_ttl_sec: number
          reality: Database["public"]["Enums"]["quote_reality"]
          route: Database["public"]["Enums"]["settlement_route"]
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          asset?: string
          enabled?: boolean
          execution_eta_sec?: number
          fx_spread_bps?: number
          fx_struck?: string
          liquidity_cents?: number
          max_ticket_cents?: number
          min_ticket_cents?: number
          name?: string
          network_fee_cents?: number
          provider?: string
          provider_fee_bps?: number
          provider_fee_fixed_cents?: number
          quote_ttl_sec?: number
          reality?: Database["public"]["Enums"]["quote_reality"]
          route?: Database["public"]["Enums"]["settlement_route"]
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      settlement_quotes: {
        Row: {
          blocks: string[]
          cost_bps: number
          created_at: string
          execution_eta_sec: number
          expires_at: string
          feasible: boolean
          fx_cost_cents: number
          fx_rate_milli: number
          fx_spread_bps: number
          fx_struck: string
          gross_brl_cents: number
          gross_for_principal_micro_usdc: number | null
          gross_micro_usdc: number
          hops: number
          id: string
          liquidity_ok: boolean
          loan_id: string
          net_brl_cents: number
          network_fee_cents: number
          provider: string
          provider_fee_cents: number
          quote_ttl_sec: number
          quoted_at: string
          reality: Database["public"]["Enums"]["quote_reality"]
          route: Database["public"]["Enums"]["settlement_route"]
          total_cost_cents: number
        }
        Insert: {
          blocks?: string[]
          cost_bps: number
          created_at?: string
          execution_eta_sec: number
          expires_at: string
          feasible: boolean
          fx_cost_cents: number
          fx_rate_milli: number
          fx_spread_bps: number
          fx_struck: string
          gross_brl_cents: number
          gross_for_principal_micro_usdc?: number | null
          gross_micro_usdc: number
          hops: number
          id?: string
          liquidity_ok: boolean
          loan_id: string
          net_brl_cents: number
          network_fee_cents: number
          provider: string
          provider_fee_cents: number
          quote_ttl_sec: number
          quoted_at: string
          reality: Database["public"]["Enums"]["quote_reality"]
          route: Database["public"]["Enums"]["settlement_route"]
          total_cost_cents: number
        }
        Update: {
          blocks?: string[]
          cost_bps?: number
          created_at?: string
          execution_eta_sec?: number
          expires_at?: string
          feasible?: boolean
          fx_cost_cents?: number
          fx_rate_milli?: number
          fx_spread_bps?: number
          fx_struck?: string
          gross_brl_cents?: number
          gross_for_principal_micro_usdc?: number | null
          gross_micro_usdc?: number
          hops?: number
          id?: string
          liquidity_ok?: boolean
          loan_id?: string
          net_brl_cents?: number
          network_fee_cents?: number
          provider?: string
          provider_fee_cents?: number
          quote_ttl_sec?: number
          quoted_at?: string
          reality?: Database["public"]["Enums"]["quote_reality"]
          route?: Database["public"]["Enums"]["settlement_route"]
          total_cost_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "settlement_quotes_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_quotes_provider_fkey"
            columns: ["provider"]
            isOneToOne: false
            referencedRelation: "settlement_providers"
            referencedColumns: ["provider"]
          },
        ]
      }
      sponsors: {
        Row: {
          created_at: string
          id: string
          is_simulated: boolean
          kind: Database["public"]["Enums"]["sponsor_kind"]
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_simulated?: boolean
          kind: Database["public"]["Enums"]["sponsor_kind"]
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_simulated?: boolean
          kind?: Database["public"]["Enums"]["sponsor_kind"]
          name?: string
        }
        Relationships: []
      }
      vault_transfers: {
        Row: {
          claimed_at: string | null
          confirmed_at: string | null
          created_at: string
          error: string | null
          id: number
          inflow_micro_usdc: number
          kind: Database["public"]["Enums"]["vault_transfer_kind"]
          outflow_micro_usdc: number
          signature: string | null
          status: Database["public"]["Enums"]["vault_transfer_status"]
          valid_until: number | null
        }
        Insert: {
          claimed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          error?: string | null
          id?: never
          inflow_micro_usdc?: number
          kind: Database["public"]["Enums"]["vault_transfer_kind"]
          outflow_micro_usdc: number
          signature?: string | null
          status?: Database["public"]["Enums"]["vault_transfer_status"]
          valid_until?: number | null
        }
        Update: {
          claimed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          error?: string | null
          id?: never
          inflow_micro_usdc?: number
          kind?: Database["public"]["Enums"]["vault_transfer_kind"]
          outflow_micro_usdc?: number
          signature?: string | null
          status?: Database["public"]["Enums"]["vault_transfer_status"]
          valid_until?: number | null
        }
        Relationships: []
      }
      zcash_payment_requests: {
        Row: {
          amount_micro_usdc: number
          amount_zat: number
          confirmed_at: string | null
          created_at: string
          credit_claimed_at: string | null
          credit_signature: string | null
          credit_valid_until: number | null
          error: string | null
          expires_at: string
          id: string
          investment_id: string | null
          investor_id: string
          mined_height: number | null
          opportunity_id: string
          pool: string | null
          quote_source: string
          received_zat: number | null
          ref: string
          return_address: string | null
          status: Database["public"]["Enums"]["zcash_request_status"]
          txid: string | null
          updated_at: string
          usd_per_zec_cents: number
        }
        Insert: {
          amount_micro_usdc: number
          amount_zat: number
          confirmed_at?: string | null
          created_at?: string
          credit_claimed_at?: string | null
          credit_signature?: string | null
          credit_valid_until?: number | null
          error?: string | null
          expires_at: string
          id?: string
          investment_id?: string | null
          investor_id: string
          mined_height?: number | null
          opportunity_id: string
          pool?: string | null
          quote_source: string
          received_zat?: number | null
          ref: string
          return_address?: string | null
          status?: Database["public"]["Enums"]["zcash_request_status"]
          txid?: string | null
          updated_at?: string
          usd_per_zec_cents: number
        }
        Update: {
          amount_micro_usdc?: number
          amount_zat?: number
          confirmed_at?: string | null
          created_at?: string
          credit_claimed_at?: string | null
          credit_signature?: string | null
          credit_valid_until?: number | null
          error?: string | null
          expires_at?: string
          id?: string
          investment_id?: string | null
          investor_id?: string
          mined_height?: number | null
          opportunity_id?: string
          pool?: string | null
          quote_source?: string
          received_zat?: number | null
          ref?: string
          return_address?: string | null
          status?: Database["public"]["Enums"]["zcash_request_status"]
          txid?: string | null
          updated_at?: string
          usd_per_zec_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "zcash_payment_requests_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zcash_payment_requests_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zcash_payment_requests_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "qualified_credit_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      zcash_receipts: {
        Row: {
          memo: string | null
          mined_height: number
          output_index: number
          pool: string
          request_id: string | null
          seen_at: string
          txid: string
          value_zat: number
        }
        Insert: {
          memo?: string | null
          mined_height: number
          output_index: number
          pool: string
          request_id?: string | null
          seen_at?: string
          txid: string
          value_zat: number
        }
        Update: {
          memo?: string | null
          mined_height?: number
          output_index?: number
          pool?: string
          request_id?: string | null
          seen_at?: string
          txid?: string
          value_zat?: number
        }
        Relationships: [
          {
            foreignKeyName: "zcash_receipts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "zcash_payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      zcash_returns: {
        Row: {
          address: string
          amount_micro_usdc: number
          amount_zat: number | null
          claimed_at: string | null
          created_at: string
          error: string | null
          id: string
          investment_id: string
          kind: string
          leg_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["zcash_return_status"]
          txid: string | null
          usd_per_zec_cents: number | null
        }
        Insert: {
          address: string
          amount_micro_usdc: number
          amount_zat?: number | null
          claimed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          investment_id: string
          kind: string
          leg_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["zcash_return_status"]
          txid?: string | null
          usd_per_zec_cents?: number | null
        }
        Update: {
          address?: string
          amount_micro_usdc?: number
          amount_zat?: number | null
          claimed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          investment_id?: string
          kind?: string
          leg_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["zcash_return_status"]
          txid?: string | null
          usd_per_zec_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "zcash_returns_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zcash_returns_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: true
            referencedRelation: "settlement_legs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      checkin_cash_flow: {
        Row: {
          active_days: number | null
          checkin_id: string | null
          cogs_cents: number | null
          entrepreneur_id: string | null
          gross_margin_bps: number | null
          household_cents: number | null
          keeps_records: boolean | null
          net_after_household_cents: number | null
          net_business_cents: number | null
          opex_cents: number | null
          period: string | null
          revenue_cents: number | null
        }
        Insert: {
          active_days?: number | null
          checkin_id?: string | null
          cogs_cents?: number | null
          entrepreneur_id?: string | null
          gross_margin_bps?: never
          household_cents?: number | null
          keeps_records?: boolean | null
          net_after_household_cents?: never
          net_business_cents?: never
          opex_cents?: number | null
          period?: string | null
          revenue_cents?: number | null
        }
        Update: {
          active_days?: number | null
          checkin_id?: string | null
          cogs_cents?: number | null
          entrepreneur_id?: string | null
          gross_margin_bps?: never
          household_cents?: number | null
          keeps_records?: boolean | null
          net_after_household_cents?: never
          net_business_cents?: never
          opex_cents?: number | null
          period?: string | null
          revenue_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
        ]
      }
      latest_readiness: {
        Row: {
          as_of_period: string | null
          assessment_no: number | null
          band: Database["public"]["Enums"]["readiness_band"] | null
          components: Json | null
          created_at: string | null
          entrepreneur_id: string | null
          features: Json | null
          id: string | null
          is_simulated: boolean | null
          missing_requirements: Json | null
          model_version: string | null
          reason_codes: string[] | null
          requested_by: string | null
          score: number | null
          status: Database["public"]["Enums"]["readiness_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "readiness_assessments_entrepreneur_id_fkey"
            columns: ["entrepreneur_id"]
            isOneToOne: false
            referencedRelation: "entrepreneurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readiness_assessments_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      allocate_domestic: {
        Args: { p_amount_cents: number; p_opportunity_id: string }
        Returns: Json
      }
      audit_attestations: {
        Args: {
          p_kind?: Database["public"]["Enums"]["anchor_kind"]
          p_limit?: number
          p_offset?: number
          p_state?: string
        }
        Returns: Json
      }
      audit_consents: { Args: never; Returns: Json }
      audit_events: {
        Args: { p_kind?: string; p_limit?: number }
        Returns: Json
      }
      audit_model_sample: { Args: { p_limit?: number }; Returns: Json }
      audit_models: { Args: never; Returns: Json }
      audit_record: {
        Args: {
          p_entity_id: string
          p_kind: Database["public"]["Enums"]["anchor_kind"]
        }
        Returns: Json
      }
      audit_reports: { Args: never; Returns: Json }
      audit_system: { Args: never; Returns: Json }
      audit_zcash: { Args: never; Returns: Json }
      audit_zcash_returns: { Args: never; Returns: Json }
      business_model: {
        Args: { p_pricing_version?: string; p_program_id?: string }
        Returns: Json
      }
      capital_journey: { Args: { p_opportunity_id?: string }; Returns: Json }
      capital_mobilization_summary: {
        Args: { p_program_id?: string }
        Returns: Json
      }
      capital_network_origin: { Args: never; Returns: Json }
      capital_overview: { Args: never; Returns: Json }
      capital_plan: { Args: { p_opportunity_id: string }; Returns: Json }
      capital_portfolio: { Args: never; Returns: Json }
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
      claim_reconcile_batch: {
        Args: { p_limit?: number }
        Returns: {
          account_address: string
          commitment: string
          entity_id: string
          id: number
          kind: Database["public"]["Enums"]["anchor_kind"]
          payload: Json
          signature: string
        }[]
      }
      community_cohorts: { Args: { p_community_id: string }; Returns: Json }
      community_overview: { Args: { p_community_id: string }; Returns: Json }
      community_participant: {
        Args: { p_community_id: string; p_entrepreneur_id: string }
        Returns: Json
      }
      community_participants: {
        Args: { p_community_id: string }
        Returns: Json
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
      cost_sensitivity: {
        Args: {
          p_participants_per_loan?: number
          p_program_id?: string
          p_tickets_cents?: number[]
        }
        Returns: Json
      }
      create_audit_report: {
        Args: { p_checks?: Json; p_title: string }
        Returns: Json
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
      create_zcash_request: {
        Args: {
          p_amount_micro_usdc: number
          p_investor_id: string
          p_opportunity_id: string
          p_quote_source: string
          p_usd_per_zec_cents: number
        }
        Returns: Json
      }
      cts_summary: { Args: { p_community_id?: string }; Returns: Json }
      declare_credit_intent: {
        Args: {
          p_description?: string
          p_purpose: Database["public"]["Enums"]["credit_purpose"]
          p_requested_amount_cents: number
        }
        Returns: string
      }
      eligibility_inputs: { Args: { p_entrepreneur_id: string }; Returns: Json }
      engine_opportunities: {
        Args: { p_include_settled?: boolean }
        Returns: Json
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
      evidence_ledger: { Args: never; Returns: Json }
      fail_anchor_job: {
        Args: { p_error: string; p_id: number; p_retryable?: boolean }
        Returns: undefined
      }
      finish_anchor_run: { Args: never; Returns: undefined }
      formalise_loan: {
        Args: { p_note?: string; p_opportunity_id: string }
        Returns: string
      }
      fx_market: { Args: never; Returns: Json }
      impact_intelligence: { Args: { p_program_id: string }; Returns: Json }
      investor_activity: {
        Args: { p_limit?: number }
        Returns: {
          at: string
          code: string
          entity_id: string
          entity_kind: Database["public"]["Enums"]["anchor_kind"]
          investment_id: string
          kind: string
          micro_usdc: number
          purpose: Database["public"]["Enums"]["credit_purpose"]
          signature: string
        }[]
      }
      investor_opportunities: {
        Args: never
        Returns: {
          affordability_bps: number
          allocation: Json
          allocation_reason_codes: string[]
          amount_cents: number
          business_sector: string
          code: string
          community_city: string
          community_name: string
          community_state: string
          confidence: Database["public"]["Enums"]["grade"]
          created_at: string
          eligibility_decision: Database["public"]["Enums"]["eligibility_decision"]
          eligibility_model: string
          eligibility_reasons: string[]
          funded_micro_usdc: number
          funding_pool: Database["public"]["Enums"]["funding_pool"]
          funding_status: Database["public"]["Enums"]["funding_status"]
          funding_target_micro_usdc: number
          fx_brl_per_usdc_milli: number
          indicative_yield_bps: number
          instalment_cents: number
          investors: number
          loan_status: Database["public"]["Enums"]["loan_status"]
          months_reported: number
          my_micro_usdc: number
          opportunity_id: string
          proofs: Json
          purpose: Database["public"]["Enums"]["credit_purpose"]
          readiness_band: Database["public"]["Enums"]["readiness_band"]
          readiness_model: string
          readiness_score: number
          records_kept_bps: number
          risk_band: Database["public"]["Enums"]["grade"]
          term_months: number
        }[]
      }
      investor_portfolio: { Args: never; Returns: Json }
      investor_position: { Args: { p_investment_id: string }; Returns: Json }
      investor_proofs: {
        Args: never
        Returns: {
          account_address: string
          code: string
          confirmed_at: string
          entity_id: string
          kind: Database["public"]["Enums"]["anchor_kind"]
          reconcile: Database["public"]["Enums"]["reconcile_status"]
          signature: string
          status: Database["public"]["Enums"]["anchor_status"]
        }[]
      }
      journey_opportunities: { Args: never; Returns: Json }
      local_economies_listed: { Args: never; Returns: Json }
      local_economy_dashboard: {
        Args: { p_economy_id?: string }
        Returns: Json
      }
      local_inject_capital: {
        Args: { p_economy_id?: string; p_loan_id: string }
        Returns: Json
      }
      local_merchant_payment: {
        Args: {
          p_from_merchant_id: string
          p_note?: string
          p_to_merchant_id: string
          p_units: number
        }
        Returns: Json
      }
      local_redeem: {
        Args: { p_merchant_id: string; p_units: number }
        Returns: Json
      }
      local_repay: {
        Args: { p_entrepreneur_id?: string; p_loan_id: string; p_units: number }
        Returns: Json
      }
      local_sale: {
        Args: {
          p_entrepreneur_id: string
          p_merchant_id: string
          p_note?: string
          p_units: number
        }
        Returns: Json
      }
      local_spend: {
        Args: {
          p_entrepreneur_id?: string
          p_merchant_id: string
          p_note?: string
          p_purpose?: Database["public"]["Enums"]["credit_purpose"]
          p_units: number
        }
        Returns: Json
      }
      market_funded_elsewhere: { Args: never; Returns: Json }
      measure_outcome: {
        Args: {
          p_capital_use?: Database["public"]["Enums"]["capital_use"]
          p_loan_id: string
        }
        Returns: string
      }
      operating_economics: { Args: { p_program_id?: string }; Returns: Json }
      opportunity_economics: {
        Args: { p_opportunity_id: string }
        Returns: Json
      }
      partner_decide: {
        Args: {
          p_approved_amount_cents?: number
          p_opportunity_id: string
          p_rate_bps?: number
          p_reason?: string
          p_term_months?: number
          p_verdict: Database["public"]["Enums"]["partner_verdict"]
        }
        Returns: string
      }
      partner_desk: { Args: never; Returns: Json }
      partner_pipeline: {
        Args: never
        Returns: {
          affordability_bps: number
          amount_cents: number
          avg_net_business_cents: number
          avg_revenue_cents: number
          business_sector: string
          community_city: string
          community_name: string
          community_state: string
          confidence: Database["public"]["Enums"]["grade"]
          eligibility_decision: Database["public"]["Enums"]["eligibility_decision"]
          eligibility_reasons: string[]
          instalment_cents: number
          is_simulated: boolean
          max_instalment_cents: number
          months_reported: number
          opportunity_id: string
          participant: string
          purpose: Database["public"]["Enums"]["credit_purpose"]
          readiness_band: Database["public"]["Enums"]["readiness_band"]
          referred_at: string
          requested_amount_cents: number
          revenue_cv_bps: number
          risk_band: Database["public"]["Enums"]["grade"]
          status: Database["public"]["Enums"]["opportunity_status"]
          suggested_max_cents: number
          suggested_min_cents: number
          term_months: number
        }[]
      }
      pay_instalment: {
        Args: { p_instalment_no?: number; p_loan_id: string }
        Returns: Json
      }
      position_history: { Args: never; Returns: Json }
      position_mint_claim: { Args: { p_limit?: number }; Returns: Json }
      position_mint_failed: {
        Args: { p_error: string; p_position_id: string }
        Returns: undefined
      }
      position_mint_record: {
        Args: {
          p_mint: string
          p_position_id: string
          p_signature: string
          p_token_account: string
        }
        Returns: undefined
      }
      position_transfer_check: {
        Args: { p_position_id: string; p_to_wallet: string }
        Returns: Json
      }
      position_transferred: {
        Args: {
          p_from: string
          p_position_id: string
          p_signature: string
          p_to: string
          p_token_account: string
        }
        Returns: undefined
      }
      readiness_inputs: { Args: { p_entrepreneur_id: string }; Returns: Json }
      record_audit_report_checks: {
        Args: { p_checks: Json; p_id: string }
        Returns: undefined
      }
      record_consent: {
        Args: {
          p_assessment: boolean
          p_entrepreneur_id?: string
          p_impact: boolean
          p_investors: boolean
          p_partner: boolean
        }
        Returns: Json
      }
      record_education_progress: {
        Args: {
          p_entrepreneur_id: string
          p_module_id: string
          p_status: Database["public"]["Enums"]["education_status"]
        }
        Returns: undefined
      }
      record_eligibility_assessment: {
        Args: {
          p_created_at?: string
          p_entrepreneur_id: string
          p_inputs: Json
          p_intent_id: string
          p_is_simulated?: boolean
          p_readiness_assessment_id: string
          p_result: Json
        }
        Returns: Json
      }
      record_fx_rates: { Args: { p_rows: Json }; Returns: number }
      record_investment: {
        Args: {
          p_amount_micro_usdc: number
          p_created_at?: string
          p_deposit_signature?: string
          p_investor_id: string
          p_is_simulated?: boolean
          p_mode: Database["public"]["Enums"]["investment_mode"]
          p_opportunity_id: string
          p_wallet_address?: string
        }
        Returns: Json
      }
      record_outreach: {
        Args: {
          p_action: Database["public"]["Enums"]["outreach_action"]
          p_community_id: string
          p_entrepreneur_ids: string[]
          p_note?: string
        }
        Returns: number
      }
      record_payment: {
        Args: {
          p_amount_cents: number
          p_instalment_no: number
          p_loan_id: string
          p_paid_at?: string
        }
        Returns: string
      }
      record_readiness_assessment: {
        Args: {
          p_created_at?: string
          p_entrepreneur_id: string
          p_features: Json
          p_is_simulated?: boolean
          p_requested_by?: string
          p_result: Json
        }
        Returns: Json
      }
      record_reconciliation: { Args: { p_results: Json }; Returns: number }
      refer_opportunity: { Args: { p_opportunity_id: string }; Returns: string }
      reference_points_listed: { Args: never; Returns: Json }
      refund_claim: {
        Args: { p_limit?: number }
        Returns: {
          amount_micro_usdc: number
          id: string
          refund_signature: string
          refund_valid_until: number
          wallet_address: string
        }[]
      }
      refund_done: {
        Args: { p_id: string; p_signature: string }
        Returns: undefined
      }
      refund_failed: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      refund_sending: {
        Args: { p_id: string; p_signature: string; p_valid_until: number }
        Returns: undefined
      }
      reject_community: {
        Args: { p_community_id: string; p_note: string }
        Returns: undefined
      }
      release_anchor_jobs: {
        Args: { p_delay_seconds?: number; p_ids: number[] }
        Returns: undefined
      }
      reset_demo_data: { Args: { p_confirm: string }; Returns: Json }
      revoke_audit_report: { Args: { p_id: string }; Returns: undefined }
      run_capital_engine: {
        Args: { p_documents?: string[]; p_opportunity_id: string }
        Returns: Json
      }
      set_mandate: {
        Args: {
          p_impact_mandate?: boolean
          p_kind: Database["public"]["Enums"]["investor_kind"]
          p_label?: string
          p_max_ticket_cents?: number
          p_min_ticket_cents?: number
          p_pools?: Database["public"]["Enums"]["funding_pool"][]
          p_purposes?: Database["public"]["Enums"]["credit_purpose"][]
          p_risk_bands?: Database["public"]["Enums"]["grade"][]
          p_sectors?: string[]
          p_states?: string[]
        }
        Returns: {
          impact_mandate: boolean
          investor_id: string
          is_simulated: boolean
          kind: Database["public"]["Enums"]["investor_kind"]
          label: string | null
          max_ticket_cents: number | null
          min_ticket_cents: number | null
          pools: Database["public"]["Enums"]["funding_pool"][]
          purposes: Database["public"]["Enums"]["credit_purpose"][]
          risk_bands: Database["public"]["Enums"]["grade"][]
          sectors: string[]
          states: string[]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "investor_mandates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_zcash_request_return_address: {
        Args: { p_address: string; p_request_id: string }
        Returns: Json
      }
      set_zcash_return_address: {
        Args: { p_address: string; p_investment_id: string }
        Returns: Json
      }
      settle_claim: {
        Args: { p_per_transfer?: number }
        Returns: {
          id: number
          inflow_micro_usdc: number
          kind: Database["public"]["Enums"]["vault_transfer_kind"]
          legs: Json
          outflow_micro_usdc: number
          signature: string
          valid_until: number
        }[]
      }
      settle_done: {
        Args: { p_id: number; p_signature: string }
        Returns: undefined
      }
      settle_failed: {
        Args: { p_error: string; p_id: number }
        Returns: undefined
      }
      settle_sending: {
        Args: { p_id: number; p_signature: string; p_valid_until: number }
        Returns: undefined
      }
      settlement_overview: { Args: never; Returns: Json }
      settlement_route_preview: {
        Args: { p_opportunity_id: string }
        Returns: Json
      }
      shared_audit_report: { Args: { p_token: string }; Returns: Json }
      start_anchor_run: { Args: { p_lease_seconds?: number }; Returns: boolean }
      submit_checkin: {
        Args: {
          p_active_days: number
          p_cogs_cents: number
          p_entrepreneur_id?: string
          p_household_cents: number
          p_keeps_records: boolean
          p_note?: string
          p_opex_cents: number
          p_period: string
          p_revenue_cents: number
        }
        Returns: string
      }
      tokenized_position: { Args: { p_position_id: string }; Returns: Json }
      tokenized_positions: { Args: never; Returns: Json }
      transition_loan: {
        Args: {
          p_loan_id: string
          p_note?: string
          p_to: Database["public"]["Enums"]["loan_status"]
        }
        Returns: undefined
      }
      verify_community: {
        Args: { p_community_id: string; p_note?: string }
        Returns: undefined
      }
      withdraw_credit_intent: { Args: never; Returns: undefined }
      zcash_configure_treasury: {
        Args: {
          p_address: string
          p_birthday_height: number
          p_network: string
          p_ufvk: string
        }
        Returns: Json
      }
      zcash_credit_claim: {
        Args: { p_limit?: number }
        Returns: {
          amount_micro_usdc: number
          credit_signature: string
          credit_valid_until: number
          id: string
        }[]
      }
      zcash_credit_done: {
        Args: { p_id: string; p_signature: string }
        Returns: Json
      }
      zcash_credit_failed: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      zcash_credit_sending: {
        Args: { p_id: string; p_signature: string; p_valid_until: number }
        Returns: undefined
      }
      zcash_position_returns: {
        Args: { p_investment_id: string }
        Returns: Json
      }
      zcash_request: { Args: { p_id: string }; Returns: Json }
      zcash_return_failed: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      zcash_return_release: {
        Args: { p_error?: string; p_id: string }
        Returns: undefined
      }
      zcash_return_sent: {
        Args: {
          p_amount_zat: number
          p_id: string
          p_txid: string
          p_usd_per_zec_cents: number
        }
        Returns: undefined
      }
      zcash_returns_claim: {
        Args: { p_limit?: number }
        Returns: {
          address: string
          amount_micro_usdc: number
          id: string
          instalment_no: number
          kind: string
          ref: string
        }[]
      }
      zcash_watch_record: {
        Args: {
          p_outputs: Json
          p_tip: number
          p_to: number
          p_to_hash: string
        }
        Returns: Json
      }
      zcash_watch_state: { Args: never; Returns: Json }
    }
    Enums: {
      anchor_kind:
        | "community"
        | "community_verification"
        | "enrollment"
        | "checkin"
        | "readiness"
        | "eligibility"
        | "opportunity"
        | "loan"
        | "loan_transition"
        | "payment"
        | "outcome"
        | "allocation"
        | "consent"
        | "settlement_route"
        | "capital_route"
      anchor_status: "pending" | "submitted" | "confirmed" | "failed"
      app_role:
        | "entrepreneur"
        | "community_leader"
        | "partner"
        | "capital_provider"
        | "auditor"
        | "admin"
        | "sponsor"
      capital_instrument_type:
        | "regional_credit_product"
        | "microcredit"
        | "commercial_credit"
        | "productive_exchange_network"
        | "sponsored_capital"
        | "domestic_p2p"
        | "global_impact_capital"
        | "impact_fund_capital"
      capital_provider_type:
        | "credit_cooperative"
        | "microcredit_operator"
        | "commercial_partner"
        | "community_network"
        | "sponsor_programme"
        | "p2p_pool"
        | "other"
        | "impact_fund"
      capital_route_status: "recommended" | "manual_review" | "no_route"
      capital_scope: "territorial" | "regional" | "national" | "global"
      capital_use:
        | "as_declared"
        | "partly_as_declared"
        | "other_use"
        | "not_reported"
      community_kind:
        | "education_programme"
        | "association"
        | "cooperative"
        | "collective"
        | "other"
      community_status: "pending_verification" | "verified" | "rejected"
      consent_channel: "app" | "community"
      cost_bearer: "empowerfi" | "community" | "partner"
      cost_stage:
        | "community_onboarding"
        | "community_verification"
        | "enrollment"
        | "education"
        | "checkin"
        | "readiness_assessment"
        | "credit_intent"
        | "eligibility_assessment"
        | "opportunity_preparation"
        | "partner_referral"
        | "partner_decision"
        | "disbursement"
        | "servicing"
        | "chain_anchoring"
        | "outcome_measurement"
        | "outreach"
      credit_intent_status: "active" | "withdrawn"
      credit_purpose:
        | "working_capital"
        | "inventory"
        | "equipment"
        | "renovation"
        | "other"
      education_status: "in_progress" | "completed"
      eligibility_decision:
        | "ELIGIBLE"
        | "ELIGIBLE_REDUCED"
        | "MANUAL_REVIEW"
        | "NOT_ELIGIBLE"
      evidence_label:
        | "observed_pilot_data"
        | "partner_provided"
        | "simulated_assumption"
        | "external_benchmark"
      funding_pool: "domestic" | "global"
      funding_status:
        | "open"
        | "partially_funded"
        | "funded"
        | "closed"
        | "refunded"
      grade: "LOW" | "MEDIUM" | "HIGH"
      investment_mode: "wallet" | "cloak" | "simulated" | "zcash"
      investment_status: "allocated" | "refund_due" | "refunded"
      investor_kind: "individual" | "impact_fund"
      loan_status:
        | "DRAFT"
        | "PARTNER_APPROVED"
        | "DISBURSED"
        | "ACTIVE"
        | "PAID"
        | "DEFAULTED"
        | "CANCELLED"
      local_conversion_direction: "issue" | "redeem"
      local_economy_status: "demo"
      local_owner_type: "treasury" | "entrepreneur" | "merchant"
      local_redemption_status: "requested" | "settled" | "failed"
      local_transaction_type:
        | "capital_injection"
        | "productive_purchase"
        | "merchant_payment"
        | "transfer"
        | "repayment"
        | "redemption"
      membership_status: "active" | "left"
      opportunity_status:
        | "in_review"
        | "open"
        | "referred"
        | "partner_approved"
        | "partner_declined"
        | "withdrawn"
      outreach_action:
        | "checkin_reminder"
        | "education_followup"
        | "human_followup"
        | "readiness_followup"
        | "credit_intent_check"
        | "capital_need_check"
        | "funding_followup"
        | "servicing_followup"
      partner_kind:
        | "credit_union"
        | "scd"
        | "fintech"
        | "bank"
        | "impact_fund"
        | "other"
      partner_verdict: "approved" | "declined" | "more_information"
      quote_reality: "sandbox" | "devnet" | "test" | "simulated"
      readiness_band: "LOW" | "MEDIUM" | "HIGH"
      readiness_status:
        | "CREDIT_READY"
        | "NEEDS_MORE_DATA"
        | "NEEDS_PREPARATION"
        | "MANUAL_REVIEW"
      reconcile_status: "unchecked" | "verified" | "missing" | "mismatch"
      settlement_leg_kind: "release" | "pix_payout" | "pix_in" | "payout"
      settlement_leg_status:
        | "due"
        | "held"
        | "sending"
        | "done"
        | "failed"
        | "mock"
      settlement_rail:
        | "local_currency"
        | "brl_pix"
        | "partner_card"
        | "usdc_solana"
      settlement_route: "direct_usdc_pix" | "brl_stable_pix"
      sponsor_kind: "company" | "foundation" | "impact_fund"
      supplier_geography:
        | "same_neighbourhood"
        | "municipality"
        | "state"
        | "other_brazil"
        | "international"
      vault_transfer_kind: "release" | "payout"
      vault_transfer_status: "pending" | "confirmed" | "failed"
      zcash_request_status:
        | "awaiting"
        | "seen"
        | "confirmed"
        | "credited"
        | "underpaid"
        | "expired"
        | "failed"
      zcash_return_status: "due" | "sending" | "sent" | "failed"
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
      anchor_kind: [
        "community",
        "community_verification",
        "enrollment",
        "checkin",
        "readiness",
        "eligibility",
        "opportunity",
        "loan",
        "loan_transition",
        "payment",
        "outcome",
        "allocation",
        "consent",
        "settlement_route",
        "capital_route",
      ],
      anchor_status: ["pending", "submitted", "confirmed", "failed"],
      app_role: [
        "entrepreneur",
        "community_leader",
        "partner",
        "capital_provider",
        "auditor",
        "admin",
        "sponsor",
      ],
      capital_instrument_type: [
        "regional_credit_product",
        "microcredit",
        "commercial_credit",
        "productive_exchange_network",
        "sponsored_capital",
        "domestic_p2p",
        "global_impact_capital",
        "impact_fund_capital",
      ],
      capital_provider_type: [
        "credit_cooperative",
        "microcredit_operator",
        "commercial_partner",
        "community_network",
        "sponsor_programme",
        "p2p_pool",
        "other",
        "impact_fund",
      ],
      capital_route_status: ["recommended", "manual_review", "no_route"],
      capital_scope: ["territorial", "regional", "national", "global"],
      capital_use: [
        "as_declared",
        "partly_as_declared",
        "other_use",
        "not_reported",
      ],
      community_kind: [
        "education_programme",
        "association",
        "cooperative",
        "collective",
        "other",
      ],
      community_status: ["pending_verification", "verified", "rejected"],
      consent_channel: ["app", "community"],
      cost_bearer: ["empowerfi", "community", "partner"],
      cost_stage: [
        "community_onboarding",
        "community_verification",
        "enrollment",
        "education",
        "checkin",
        "readiness_assessment",
        "credit_intent",
        "eligibility_assessment",
        "opportunity_preparation",
        "partner_referral",
        "partner_decision",
        "disbursement",
        "servicing",
        "chain_anchoring",
        "outcome_measurement",
        "outreach",
      ],
      credit_intent_status: ["active", "withdrawn"],
      credit_purpose: [
        "working_capital",
        "inventory",
        "equipment",
        "renovation",
        "other",
      ],
      education_status: ["in_progress", "completed"],
      eligibility_decision: [
        "ELIGIBLE",
        "ELIGIBLE_REDUCED",
        "MANUAL_REVIEW",
        "NOT_ELIGIBLE",
      ],
      evidence_label: [
        "observed_pilot_data",
        "partner_provided",
        "simulated_assumption",
        "external_benchmark",
      ],
      funding_pool: ["domestic", "global"],
      funding_status: [
        "open",
        "partially_funded",
        "funded",
        "closed",
        "refunded",
      ],
      grade: ["LOW", "MEDIUM", "HIGH"],
      investment_mode: ["wallet", "cloak", "simulated", "zcash"],
      investment_status: ["allocated", "refund_due", "refunded"],
      investor_kind: ["individual", "impact_fund"],
      loan_status: [
        "DRAFT",
        "PARTNER_APPROVED",
        "DISBURSED",
        "ACTIVE",
        "PAID",
        "DEFAULTED",
        "CANCELLED",
      ],
      local_conversion_direction: ["issue", "redeem"],
      local_economy_status: ["demo"],
      local_owner_type: ["treasury", "entrepreneur", "merchant"],
      local_redemption_status: ["requested", "settled", "failed"],
      local_transaction_type: [
        "capital_injection",
        "productive_purchase",
        "merchant_payment",
        "transfer",
        "repayment",
        "redemption",
      ],
      membership_status: ["active", "left"],
      opportunity_status: [
        "in_review",
        "open",
        "referred",
        "partner_approved",
        "partner_declined",
        "withdrawn",
      ],
      outreach_action: [
        "checkin_reminder",
        "education_followup",
        "human_followup",
        "readiness_followup",
        "credit_intent_check",
        "capital_need_check",
        "funding_followup",
        "servicing_followup",
      ],
      partner_kind: [
        "credit_union",
        "scd",
        "fintech",
        "bank",
        "impact_fund",
        "other",
      ],
      partner_verdict: ["approved", "declined", "more_information"],
      quote_reality: ["sandbox", "devnet", "test", "simulated"],
      readiness_band: ["LOW", "MEDIUM", "HIGH"],
      readiness_status: [
        "CREDIT_READY",
        "NEEDS_MORE_DATA",
        "NEEDS_PREPARATION",
        "MANUAL_REVIEW",
      ],
      reconcile_status: ["unchecked", "verified", "missing", "mismatch"],
      settlement_leg_kind: ["release", "pix_payout", "pix_in", "payout"],
      settlement_leg_status: [
        "due",
        "held",
        "sending",
        "done",
        "failed",
        "mock",
      ],
      settlement_rail: [
        "local_currency",
        "brl_pix",
        "partner_card",
        "usdc_solana",
      ],
      settlement_route: ["direct_usdc_pix", "brl_stable_pix"],
      sponsor_kind: ["company", "foundation", "impact_fund"],
      supplier_geography: [
        "same_neighbourhood",
        "municipality",
        "state",
        "other_brazil",
        "international",
      ],
      vault_transfer_kind: ["release", "payout"],
      vault_transfer_status: ["pending", "confirmed", "failed"],
      zcash_request_status: [
        "awaiting",
        "seen",
        "confirmed",
        "credited",
        "underpaid",
        "expired",
        "failed",
      ],
      zcash_return_status: ["due", "sending", "sent", "failed"],
    },
  },
} as const
