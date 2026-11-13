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
      admin_users: {
        Row: { user_id: string; created_at: string }
        Insert: { user_id: string; created_at?: string }
        Update: { user_id?: string; created_at?: string }
        Relationships: []
      }
      availability_overrides: {
        Row: {
          date: string
          laser: number
          location: string
          updated_at: string
          windows: Json
        }
        Insert: {
          date: string
          laser?: number
          location?: string
          updated_at?: string
          windows?: Json
        }
        Update: {
          date?: string
          laser?: number
          location?: string
          updated_at?: string
          windows?: Json
        }
        Relationships: []
      }
      weekly_schedule: {
        Row: {
          laser: number
          location: string
          weekday: number
          windows: Json
        }
        Insert: {
          laser?: number
          location?: string
          weekday: number
          windows?: Json
        }
        Update: {
          laser?: number
          location?: string
          weekday?: number
          windows?: Json
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string | null
          email: string
          id: string
          promo_used: boolean
          source: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          promo_used?: boolean
          source?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          promo_used?: boolean
          source?: string | null
        }
        Relationships: []
      }
      marketing_spend: {
        Row: {
          amount: number
          location: string
          month: string
          updated_at: string
        }
        Insert: {
          amount?: number
          location?: string
          month: string
          updated_at?: string
        }
        Update: {
          amount?: number
          location?: string
          month?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservation_services: {
        Row: {
          reservation_id: string
          service_id: string
        }
        Insert: {
          reservation_id: string
          service_id: string
        }
        Update: {
          reservation_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_services_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          call_attempted_at: string | null
          call_status: string
          client_cancelled_at: string | null
          client_id: string | null
          created_at: string | null
          customer_email: string
          customer_name: string
          customer_note: string | null
          customer_phone: string | null
          date: string
          end_time: string
          id: string
          late_cancel: boolean
          laser: number
          location: string
          notes: string | null
          price_override: number | null
          promo_code: string | null
          start_time: string
          status: string
          total_duration: number
        }
        Insert: {
          call_attempted_at?: string | null
          call_status?: string
          client_cancelled_at?: string | null
          client_id?: string | null
          created_at?: string | null
          customer_email: string
          customer_name: string
          customer_note?: string | null
          customer_phone?: string | null
          date: string
          end_time: string
          id?: string
          late_cancel?: boolean
          laser?: number
          location?: string
          notes?: string | null
          price_override?: number | null
          promo_code?: string | null
          start_time: string
          status?: string
          total_duration: number
        }
        Update: {
          call_attempted_at?: string | null
          call_status?: string
          client_cancelled_at?: string | null
          client_id?: string | null
          created_at?: string | null
          customer_email?: string
          customer_name?: string
          customer_note?: string | null
          customer_phone?: string | null
          date?: string
          end_time?: string
          id?: string
          late_cancel?: boolean
          laser?: number
          location?: string
          notes?: string | null
          price_override?: number | null
          promo_code?: string | null
          start_time?: string
          status?: string
          total_duration?: number
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          email_norm: string | null
          gender: string | null
          id: string
          name: string
          name_norm: string | null
          phone: string | null
          phone_norm: string | null
          search_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          gender?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          gender?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kartoni: {
        Row: {
          client_id: string
          created_at: string
          id: string
          note: string
          number: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kartoni_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      karton_rows: {
        Row: {
          created_at: string
          date: string
          id: string
          karton_id: string
          location: string
          reservation_id: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          karton_id: string
          location?: string
          reservation_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          karton_id?: string
          location?: string
          reservation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "karton_rows_karton_id_fkey"
            columns: ["karton_id"]
            isOneToOne: false
            referencedRelation: "kartoni"
            referencedColumns: ["id"]
          },
        ]
      }
      karton_entries: {
        Row: {
          energy_j: number | null
          frequency_hz: number | null
          planned: boolean
          region: string
          row_id: string
          updated_at: string
        }
        Insert: {
          energy_j?: number | null
          planned?: boolean
          region: string
          row_id: string
          updated_at?: string
        }
        Update: {
          energy_j?: number | null
          planned?: boolean
          region?: string
          row_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "karton_entries_row_id_fkey"
            columns: ["row_id"]
            isOneToOne: false
            referencedRelation: "karton_rows"
            referencedColumns: ["id"]
          },
        ]
      }
      upiti: {
        Row: {
          id: string
          name: string
          phone: string | null
          source: string
          note: string
          location: string | null
          status: string
          attempts: number
          last_call_at: string | null
          closed_at: string | null
          remind_on: string | null
          phone_norm: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          source?: string
          note?: string
          location?: string | null
          status?: string
          attempts?: number
          last_call_at?: string | null
          closed_at?: string | null
          remind_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          source?: string
          note?: string
          location?: string | null
          status?: string
          attempts?: number
          last_call_at?: string | null
          closed_at?: string | null
          remind_on?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_prices: {
        Row: {
          location: string
          price: number
          service_id: string
          valid_from: string
        }
        Insert: {
          location: string
          price: number
          service_id: string
          valid_from: string
        }
        Update: {
          location?: string
          price?: number
          service_id?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      lasers: {
        Row: {
          location: string
          laser: number
          name: string
          active_from: string | null
        }
        Insert: {
          location: string
          laser: number
          name: string
          active_from?: string | null
        }
        Update: {
          location?: string
          laser?: number
          name?: string
          active_from?: string | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      staff_overrides: {
        Row: {
          date: string
          location: string
          staff_ids: string[]
          updated_at: string
        }
        Insert: {
          date: string
          location: string
          staff_ids?: string[]
          updated_at?: string
        }
        Update: {
          date?: string
          location?: string
          staff_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      staff_weekly: {
        Row: {
          location: string
          staff_ids: string[]
          weekday: number
        }
        Insert: {
          location: string
          staff_ids?: string[]
          weekday: number
        }
        Update: {
          location?: string
          staff_ids?: string[]
          weekday?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          created_at: string | null
          description: string | null
          gender: string
          id: string
          name: string
          pause_duration: number
          price: number
          service_duration: number
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          description?: string | null
          gender: string
          id?: string
          name: string
          pause_duration?: number
          price?: number
          service_duration: number
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string | null
          description?: string | null
          gender?: string
          id?: string
          name?: string
          pause_duration?: number
          price?: number
          service_duration?: number
          sort_order?: number
        }
        Relationships: []
      }
      uplatnica_submissions: {
        Row: {
          access_token: string | null
          approve_secret: string
          created_at: string
          email: string
          id: string
          image_url: string
          name: string
          phone: string | null
          status: string
        }
        Insert: {
          access_token?: string | null
          approve_secret: string
          created_at?: string
          email: string
          id?: string
          image_url: string
          name: string
          phone?: string | null
          status?: string
        }
        Update: {
          access_token?: string | null
          approve_secret?: string
          created_at?: string
          email?: string
          id?: string
          image_url?: string
          name?: string
          phone?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean }
      admin_move_reservation: {
        Args: { p_id: string; p_date: string; p_start_time: string }
        Returns: Json
      }
      client_cancel_reservation: {
        Args: { p_id: string; p_confirm?: boolean }
        Returns: Json
      }
      admin_create_booking: {
        Args: {
          p_id: string
          p_location: string
          p_name: string
          p_email: string
          p_phone: string | null
          p_date: string
          p_start_time: string
          p_service_ids: string[]
          p_with_consultation: boolean
          p_promo_code: string | null
          p_notes: string | null
          /** Preferred laser (sql/lasers_phase1.sql); left out = the first free one. */
          p_laser?: number | null
        }
        Returns: Json
      }
      admin_set_laser: {
        Args: { p_id: string; p_laser: number }
        Returns: Json
      }
      admin_cancel_reservation: {
        Args: { p_id: string; p_reason?: string | null }
        Returns: Json
      }
      infy_facts: { Args: { p_return_weeks?: number }; Returns: Json }
      karton_search: {
        Args: { p_query?: string; p_limit?: number; p_offset?: number }
        Returns: {
          karton_id: string; number: number; client_id: string; name: string; name_norm: string;
          phone: string | null; email: string | null; rows_count: number;
          last_date: string | null; next_date: string | null; total: number
        }[]
      }
      karton_today: {
        Args: { p_location: string }
        Returns: {
          karton_id: string; number: number; name: string; start_time: string | null; regions: string[]; filled: number
        }[]
      }
      karton_create: {
        Args: { p_name: string; p_phone?: string | null; p_email?: string | null; p_gender?: string | null; p_force?: boolean }
        Returns: Json
      }
      karton_for_reservation: { Args: { p_reservation_id: string }; Returns: string | null }
      karton_delete: { Args: { p_id: string }; Returns: undefined }
      karton_merge: { Args: { p_keep: string; p_drop: string }; Returns: undefined }
      upiti_list: {
        Args: { p_open?: boolean; p_limit?: number; p_offset?: number }
        Returns: {
          id: string; name: string; phone: string | null; source: string; note: string; location: string | null;
          status: string; saved_status: string; attempts: number; last_call_at: string | null;
          created_at: string; done_at: string | null;
          karton_id: string | null; karton_number: number | null; karton_name: string | null;
          booked_date: string | null; booked_time: string | null; booked_location: string | null; booked_after: boolean;
          remind_on: string | null; due_on: string;
          total: number
        }[]
      }
      upiti_open_count: { Args: Record<string, never>; Returns: number }
      public_busy_slots: {
        Args: { p_from: string; p_to: string; p_location?: string }
        Returns: { date: string; start_time: string; end_time: string; status: string; laser: number }[]
      }
      public_is_returning: { Args: { p_email: string }; Returns: boolean }
      public_staff_days: {
        Args: { p_from: string; p_to: string; p_location: string }
        Returns: { date: string; names: string[] }[]
      }
      public_track_funnel: {
        Args: { p_session: string; p_stage: string; p_location?: string | null; p_source?: string | null; p_utm?: string | null }
        Returns: undefined
      }
      admin_funnel_sources: {
        Args: { p_from: string; p_to: string; p_location?: string | null }
        Returns: { source: string; utm: string; opened: number; picked_studio: number; booked: number; entry: string; landed: number }[]
      }
      public_popular_services: { Args: Record<string, never>; Returns: { service_id: string; rank: number }[] }
      admin_booking_funnel: {
        Args: { p_from: string; p_to: string; p_location?: string | null }
        Returns: { stage: string; sessions: number }[]
      }
      bundle_sessions_left: { Args: { p_email: string; p_code: string; p_location?: string }; Returns: number }
      public_create_booking: {
        Args: {
          p_id: string
          p_name: string
          p_email: string
          p_phone: string
          p_customer_note: string | null
          p_date: string
          p_start_time: string
          p_service_ids: string[]
          p_promo_code: string | null
          p_notes: string | null
          p_location?: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

// ── Convenience types ─────────────────────────────────────────────────────────
export type Service     = Database["public"]["Tables"]["services"]["Row"];

/** Narrowed status union – the DB stores this as plain string */
export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "blacklisted";
