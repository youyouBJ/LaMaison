// ─────────────────────────────────────────────────────────────────────────────
// FICHIER TEMPORAIRE — types manuels alignés sur 001_initial_schema.sql
//
// Pour remplacer par les types auto-générés, se connecter d'abord au CLI :
//   npx supabase login
// Puis générer :
//   npx supabase gen types typescript \
//     --project-id nosflczsevtrxnyienyn \
//     --schema public \
//     > src/types/database.ts
//
// ⚠️  La redirection `>` vide le fichier si la commande échoue.
//     Vérifier que la commande s'exécute SANS erreur avant de rediriger.
//     En cas de doute, générer d'abord dans un fichier temporaire :
//       npx supabase gen types typescript ... > /tmp/db_types.ts
//     Puis vérifier qu'il n'est pas vide avant de copier.
// ─────────────────────────────────────────────────────────────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ─── Enums métier ─────────────────────────────────────────────────────────────

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
          id: string;
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
          days_of_week: number[];
          start_time: string;
          end_time: string;
          slot_duration: number;
          max_covers_per_slot: number;
          duration_rules: Json;
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
          birthday: string | null;
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
          last_visit: string | null;
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
          date: string;
          time_slot: string;
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
      // shift_id et time_slot ajoutés dans 003_waitlist_shift_time.sql
      waitlist: {
        Row: {
          id:            string;
          restaurant_id: string;
          guest_id:      string | null;
          shift_id:      string | null;
          date:          string;
          time_slot:     string | null;  // HH:MM:SS (PostgreSQL time)
          party_size:    number;
          status:        WaitlistStatus;
          notes:         string | null;
          created_at:    string;
          updated_at:    string;
        };
        Insert: {
          id?:            string;
          restaurant_id:  string;
          guest_id?:      string | null;
          shift_id?:      string | null;
          date:           string;
          time_slot?:     string | null;
          party_size:     number;
          status?:        WaitlistStatus;
          notes?:         string | null;
          created_at?:    string;
          updated_at?:    string;
        };
        Update: {
          id?:            string;
          restaurant_id?: string;
          guest_id?:      string | null;
          shift_id?:      string | null;
          date?:          string;
          time_slot?:     string | null;
          party_size?:    number;
          status?:        WaitlistStatus;
          notes?:         string | null;
          created_at?:    string;
          updated_at?:    string;
        };
        Relationships: [];
      };

      // ── reservation_tables ───────────────────────────────────────────────
      // Ajouté dans 002_reservation_tables.sql — régénérer database.ts après migration.
      reservation_tables: {
        Row: {
          id:             string;
          reservation_id: string;
          table_id:       string;
          restaurant_id:  string;
          created_at:     string;
        };
        Insert: {
          id?:            string;
          reservation_id: string;
          table_id:       string;
          restaurant_id:  string;
          created_at?:    string;
        };
        Update: {
          id?:             string;
          reservation_id?: string;
          table_id?:       string;
          restaurant_id?:  string;
          created_at?:     string;
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
