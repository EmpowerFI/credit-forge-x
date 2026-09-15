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
        ]
      }
      cost_rates: {
        Row: {
          borne_by: Database["public"]["Enums"]["cost_bearer"]
          fixed_cents: number
          hourly_rate_cents: number
          is_assumption: boolean
          note: string
          phase: string
          staff_minutes: number
          stage: Database["public"]["Enums"]["cost_stage"]
        }
        Insert: {
          borne_by: Database["public"]["Enums"]["cost_bearer"]
          fixed_cents: number
          hourly_rate_cents: number
          is_assumption?: boolean
          note: string
          phase: string
          staff_minutes: number
          stage: Database["public"]["Enums"]["cost_stage"]
        }
        Update: {
          borne_by?: Database["public"]["Enums"]["cost_bearer"]
          fixed_cents?: number
          hourly_rate_cents?: number
          is_assumption?: boolean
          note?: string
          phase?: string
          staff_minutes?: number
          stage?: Database["public"]["Enums"]["cost_stage"]
        }
        Relationships: []
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
      investments: {
        Row: {
          allocation_ref: string
          amount_micro_usdc: number
          created_at: string
          deposit_signature: string | null
          id: string
          investor_id: string
          is_simulated: boolean
          mode: Database["public"]["Enums"]["investment_mode"]
          opportunity_id: string
          status: Database["public"]["Enums"]["investment_status"]
          wallet_address: string | null
        }
        Insert: {
          allocation_ref?: string
          amount_micro_usdc: number
          created_at?: string
          deposit_signature?: string | null
          id?: string
          investor_id: string
          is_simulated?: boolean
          mode: Database["public"]["Enums"]["investment_mode"]
          opportunity_id: string
          status?: Database["public"]["Enums"]["investment_status"]
          wallet_address?: string | null
        }
        Update: {
          allocation_ref?: string
          amount_micro_usdc?: number
          created_at?: string
          deposit_signature?: string | null
          id?: string
          investor_id?: string
          is_simulated?: boolean
          mode?: Database["public"]["Enums"]["investment_mode"]
          opportunity_id?: string
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
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          partner_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          partner_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
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
        ]
      }
      qualified_credit_opportunities: {
        Row: {
          amount_cents: number
          confidence: Database["public"]["Enums"]["grade"]
          created_at: string
          eligibility_id: string
          entrepreneur_id: string
          funded_micro_usdc: number
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
        }
        Insert: {
          amount_cents: number
          confidence: Database["public"]["Enums"]["grade"]
          created_at?: string
          eligibility_id: string
          entrepreneur_id: string
          funded_micro_usdc?: number
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
        }
        Update: {
          amount_cents?: number
          confidence?: Database["public"]["Enums"]["grade"]
          created_at?: string
          eligibility_id?: string
          entrepreneur_id?: string
          funded_micro_usdc?: number
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
      audit_record: {
        Args: {
          p_entity_id: string
          p_kind: Database["public"]["Enums"]["anchor_kind"]
        }
        Returns: Json
      }
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
      finish_anchor_run: { Args: never; Returns: undefined }
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
      measure_outcome: {
        Args: {
          p_capital_use?: Database["public"]["Enums"]["capital_use"]
          p_loan_id: string
        }
        Returns: string
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
      readiness_inputs: { Args: { p_entrepreneur_id: string }; Returns: Json }
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
      reject_community: {
        Args: { p_community_id: string; p_note: string }
        Returns: undefined
      }
      release_anchor_jobs: {
        Args: { p_delay_seconds?: number; p_ids: number[] }
        Returns: undefined
      }
      reset_demo_data: { Args: { p_confirm: string }; Returns: Json }
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
      anchor_status: "pending" | "submitted" | "confirmed" | "failed"
      app_role:
        | "entrepreneur"
        | "community_leader"
        | "partner"
        | "capital_provider"
        | "auditor"
        | "admin"
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
      funding_status:
        | "open"
        | "partially_funded"
        | "funded"
        | "closed"
        | "refunded"
      grade: "LOW" | "MEDIUM" | "HIGH"
      investment_mode: "wallet" | "cloak" | "simulated"
      investment_status: "allocated" | "refund_due" | "refunded"
      loan_status:
        | "DRAFT"
        | "PARTNER_APPROVED"
        | "DISBURSED"
        | "ACTIVE"
        | "PAID"
        | "DEFAULTED"
        | "CANCELLED"
      membership_status: "active" | "left"
      opportunity_status:
        | "in_review"
        | "open"
        | "referred"
        | "partner_approved"
        | "partner_declined"
        | "withdrawn"
      partner_kind:
        | "credit_union"
        | "scd"
        | "fintech"
        | "bank"
        | "impact_fund"
        | "other"
      partner_verdict: "approved" | "declined" | "more_information"
      readiness_band: "LOW" | "MEDIUM" | "HIGH"
      readiness_status:
        | "CREDIT_READY"
        | "NEEDS_MORE_DATA"
        | "NEEDS_PREPARATION"
        | "MANUAL_REVIEW"
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
      ],
      anchor_status: ["pending", "submitted", "confirmed", "failed"],
      app_role: [
        "entrepreneur",
        "community_leader",
        "partner",
        "capital_provider",
        "auditor",
        "admin",
      ],
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
      funding_status: [
        "open",
        "partially_funded",
        "funded",
        "closed",
        "refunded",
      ],
      grade: ["LOW", "MEDIUM", "HIGH"],
      investment_mode: ["wallet", "cloak", "simulated"],
      investment_status: ["allocated", "refund_due", "refunded"],
      loan_status: [
        "DRAFT",
        "PARTNER_APPROVED",
        "DISBURSED",
        "ACTIVE",
        "PAID",
        "DEFAULTED",
        "CANCELLED",
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
      partner_kind: [
        "credit_union",
        "scd",
        "fintech",
        "bank",
        "impact_fund",
        "other",
      ],
      partner_verdict: ["approved", "declined", "more_information"],
      readiness_band: ["LOW", "MEDIUM", "HIGH"],
      readiness_status: [
        "CREDIT_READY",
        "NEEDS_MORE_DATA",
        "NEEDS_PREPARATION",
        "MANUAL_REVIEW",
      ],
      reconcile_status: ["unchecked", "verified", "missing", "mismatch"],
    },
  },
} as const
