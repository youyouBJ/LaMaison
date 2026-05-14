// ─────────────────────────────────────────────────────────────────────────────
// FICHIER TEMPORAIRE — types manuels alignés sur 001_initial_schema.sql
//
// À remplacer par les types auto-générés après avoir appliqué la migration :
//   npx supabase gen types typescript \
//     --project-id nosflczsevtrxnyienyn \
//     --schema public \
//     > src/types/database.ts
//
// Ne pas modifier ce fichier à la main si la migration a déjà été générée.
// ─────────────────────────────────────────────────────────────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Enums métier (unions de chaînes) ────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'host' | 'waiter';
export type TableShape = 'round' | 'square' | 'rectangle';
export type TableStatus = 'free' | 'occupied' | 'reserved' | 'unavailable';
export type GuestSource = 'manual' | 'import' | 'walkin';
export type ReservationStatus = 'confirmed' | 'pending' | 'cancelled' | 'noshow' | 'seated' | 'completed';
export type ReservationSource = 'manual' | 'phone' | 'walkin';
export type WaitlistStatus = 'waiting' | 'notified' | 'seated' | 'left';
export type NotificationChannel = 'sms' | 'whatsapp' | 'email';
export type NotificationStatus = 'sent' | 'failed' | 'pending';

// ─────────────────────────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {

      // ── restaurants ──────────────────────────────────────────────────────
      restaurants: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          phone: string | null;
          email: string | null;
          timezone: string;
          logo_url: string | null;
          settings: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          timezone?: string;
          logo_url?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          phone?: string | null;
          email?: string | null;
          timezone?: string;
          logo_url?: string | null;
          settings?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ── users ────────────────────────────────────────────────────────────
      users: {
        Row: {
          id: string;
          restaurant_id: string;
          full_name: string;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string; // fourni par auth.users — pas de default
          restaurant_id: string;
          full_name: string;
          role: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          full_name?: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ── floor_plans ──────────────────────────────────────────────────────
      floor_plans: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          layout: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          layout?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          name?: string;
          layout?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ── tables ───────────────────────────────────────────────────────────
      tables: {
        Row: {
          id: string;
          restaurant_id: string;
          floor_plan_id: string | null;
          label: string;
          capacity: number;
          position_x: number;
          position_y: number;
          shape: TableShape;
          zone: string;
          status: TableStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          floor_plan_id?: string | null;
          label: string;
          capacity?: number;
          position_x?: number;
          position_y?: number;
          shape?: TableShape;
          zone: string;
          status?: TableStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          floor_plan_id?: string | null;
          label?: string;
          capacity?: number;
          position_x?: number;
          position_y?: number;
          shape?: TableShape;
          zone?: string;
          status?: TableStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ── shifts ───────────────────────────────────────────────────────────
      shifts: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          days_of_week: number[]; // 0=dim 1=lun 2=mar 3=mer 4=jeu 5=ven 6=sam
          start_time: string;     // "HH:MM:SS"
          end_time: string;       // "HH:MM:SS" — "00:00:00" = minuit (J+1 si < start)
          slot_duration: number;
          max_covers_per_slot: number;
          duration_rules: Json;   // {"party_size": duration_minutes}
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          name: string;
          days_of_week: number[];
          start_time: string;
          end_time: string;
          slot_duration?: number;
          max_covers_per_slot?: number;
          duration_rules: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          name?: string;
          days_of_week?: number[];
          start_time?: string;
          end_time?: string;
          slot_duration?: number;
          max_covers_per_slot?: number;
          duration_rules?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ── guests ───────────────────────────────────────────────────────────
      guests: {
        Row: {
          id: string;
          restaurant_id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          birthday: string | null; // "YYYY-MM-DD"
          notes: string | null;
          tags: string[];
          visit_count: number;
          cancels: number;
          no_shows: number;
          avg_spend: number | null;
          avg_rating: number | null;
          vip: boolean;
          marketing_opt_in: boolean;
          source: GuestSource;
          last_visit: string | null; // "YYYY-MM-DD"
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          birthday?: string | null;
          notes?: string | null;
          tags?: string[];
          visit_count?: number;
          cancels?: number;
          no_shows?: number;
          avg_spend?: number | null;
          avg_rating?: number | null;
          vip?: boolean;
          marketing_opt_in?: boolean;
          source?: GuestSource;
          last_visit?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          first_name?: string | null;
          last_name?: string | null;
          email?: string | null;
          phone?: string | null;
          birthday?: string | null;
          notes?: string | null;
          tags?: string[];
          visit_count?: number;
          cancels?: number;
          no_shows?: number;
          avg_spend?: number | null;
          avg_rating?: number | null;
          vip?: boolean;
          marketing_opt_in?: boolean;
          source?: GuestSource;
          last_visit?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ── reservations ─────────────────────────────────────────────────────
      reservations: {
        Row: {
          id: string;
          restaurant_id: string;
          guest_id: string | null;
          table_id: string | null;
          shift_id: string | null;
          date: string;       // "YYYY-MM-DD"
          time_slot: string;  // "HH:MM:SS"
          party_size: number;
          status: ReservationStatus;
          notes: string | null;
          source: ReservationSource;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          guest_id?: string | null;
          table_id?: string | null;
          shift_id?: string | null;
          date: string;
          time_slot: string;
          party_size: number;
          status?: ReservationStatus;
          notes?: string | null;
          source?: ReservationSource;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          guest_id?: string | null;
          table_id?: string | null;
          shift_id?: string | null;
          date?: string;
          time_slot?: string;
          party_size?: number;
          status?: ReservationStatus;
          notes?: string | null;
          source?: ReservationSource;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ── waitlist ─────────────────────────────────────────────────────────
      waitlist: {
        Row: {
          id: string;
          restaurant_id: string;
          guest_id: string | null;
          date: string;       // "YYYY-MM-DD"
          party_size: number;
          status: WaitlistStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          guest_id?: string | null;
          date: string;
          party_size: number;
          status?: WaitlistStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          guest_id?: string | null;
          date?: string;
          party_size?: number;
          status?: WaitlistStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ── notifications_log ────────────────────────────────────────────────
      notifications_log: {
        Row: {
          id: string;
          restaurant_id: string;
          reservation_id: string | null;
          guest_id: string | null;
          channel: NotificationChannel;
          type: string;
          status: NotificationStatus;
          sent_at: string | null;
          created_at: string;
          // Pas de updated_at : table immuable
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          reservation_id?: string | null;
          guest_id?: string | null;
          channel: NotificationChannel;
          type: string;
          status?: NotificationStatus;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          reservation_id?: string | null;
          guest_id?: string | null;
          channel?: NotificationChannel;
          type?: string;
          status?: NotificationStatus;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

    };

    Views: Record<string, never>;

    Functions: {
      current_user_restaurant_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      current_user_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_manager_or_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_host_or_above: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      has_restaurant_access: {
        Args: { target_restaurant_id: string };
        Returns: boolean;
      };
    };

    Enums: Record<string, never>;
  };
}
