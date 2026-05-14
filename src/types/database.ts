// TEMPORARY — Ce fichier sera remplacé par les types générés automatiquement depuis Supabase
// via la commande : npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
// À faire lors du module Base de données.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
