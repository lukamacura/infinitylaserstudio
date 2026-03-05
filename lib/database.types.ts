export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
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
          created_at: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          date: string
          end_time: string
          id: string
          notes: string | null
          start_time: string
          status: string
          total_duration: number
        }
        Insert: {
          created_at?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          date: string
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
          status?: string
          total_duration: number
        }
        Update: {
          created_at?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          date?: string
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
          status?: string
          total_duration?: number
        }
        Relationships: []
      }
      services: {
        Row: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ── Convenience types ─────────────────────────────────────────────────────────
export type Service     = Database["public"]["Tables"]["services"]["Row"];
export type Reservation = Database["public"]["Tables"]["reservations"]["Row"];
export type ReservationService = Database["public"]["Tables"]["reservation_services"]["Row"];

/** Narrowed status union – the DB stores this as plain string */
export type ReservationStatus = "pending" | "confirmed" | "cancelled";

/** Narrowed gender union – the DB stores this as plain string */
export type Gender = "zene" | "muskarci";
