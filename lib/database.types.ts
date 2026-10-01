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
          location: string
          updated_at: string
          windows: Json
        }
        Insert: {
          date: string
          location?: string
          updated_at?: string
          windows?: Json
        }
        Update: {
          date?: string
          location?: string
          updated_at?: string
          windows?: Json
        }
        Relationships: []
      }
      weekly_schedule: {
        Row: {
          location: string
          weekday: number
          windows: Json
        }
        Insert: {
          location?: string
          weekday: number
          windows?: Json
        }
        Update: {
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
          created_at: string | null
          customer_email: string
          customer_name: string
          customer_note: string | null
          customer_phone: string | null
          date: string
          end_time: string
          id: string
          location: string
          notes: string | null
          promo_code: string | null
          start_time: string
          status: string
          total_duration: number
        }
        Insert: {
          call_attempted_at?: string | null
          call_status?: string
          created_at?: string | null
          customer_email: string
          customer_name: string
          customer_note?: string | null
          customer_phone?: string | null
          date: string
          end_time: string
          id?: string
          location?: string
          notes?: string | null
          promo_code?: string | null
          start_time: string
          status?: string
          total_duration: number
        }
        Update: {
          call_attempted_at?: string | null
          call_status?: string
          created_at?: string | null
          customer_email?: string
          customer_name?: string
          customer_note?: string | null
          customer_phone?: string | null
          date?: string
          end_time?: string
          id?: string
          location?: string
          notes?: string | null
          promo_code?: string | null
          start_time?: string
          status?: string
          total_duration?: number
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
      public_busy_slots: {
        Args: { p_from: string; p_to: string; p_location?: string }
        Returns: { date: string; start_time: string; end_time: string; status: string }[]
      }
      public_is_returning: { Args: { p_email: string }; Returns: boolean }
      public_track_funnel: { Args: { p_session: string; p_stage: string; p_location?: string | null }; Returns: undefined }
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
