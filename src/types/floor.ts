import type { Database } from './database';

// ─── Shape types ─────────────────────────────────────────────────────────────

// Shapes accepted by the DB (tables.shape)
export type FloorTableDbShape = Database['public']['Tables']['tables']['Row']['shape'];
// 'round' | 'square' | 'rectangle'

// Shapes used in the visual layout (superset)
export type FloorTableVisualShape = 'round' | 'square' | 'rectangle' | 'rect' | 'diamond';

// Maps a visual shape to a DB-compatible shape
export function visualShapeToDbShape(shape: FloorTableVisualShape): FloorTableDbShape {
  switch (shape) {
    case 'round':     return 'round';
    case 'square':    return 'square';
    case 'rectangle': return 'rectangle';
    case 'rect':      return 'rectangle';
    case 'diamond':   return 'square';
  }
}

// ─── Zone keys ───────────────────────────────────────────────────────────────

export type FloorZoneKey =
  | 'bar_central'
  | 'bar_cigare'
  | 'interieur'
  | 'balcon'
  | 'terrasse'
  | 'lounge';

// ─── Status ──────────────────────────────────────────────────────────────────

export type FloorTableStatus = 'free' | 'reserved' | 'occupied' | 'unavailable';

// ─── Service filter ───────────────────────────────────────────────────────────

export type FloorServiceFilter = 'all' | 'lunch' | 'dinner';

// ─── Layout definitions (percentage-based coordinates) ───────────────────────

export interface FloorTableLayout {
  id: number;
  zone: FloorZoneKey;
  shape: FloorTableVisualShape;
  x: number;   // % of canvas width (left edge)
  y: number;   // % of canvas height (top edge)
  w: number;   // % of canvas width
  h: number;   // % of canvas height
  capacity: number;
  approx?: boolean;
}

export interface FloorLabelLayout {
  id: string;
  zone: FloorZoneKey;
  x: number;   // % of canvas width
  y: number;   // % of canvas height
  lines: string[];
  rotation: number; // degrees
}

// ─── Runtime table state ─────────────────────────────────────────────────────

export interface FloorTableWithState extends FloorTableLayout {
  dbId: string | null;      // UUID from the tables table
  dbStatus: Database['public']['Tables']['tables']['Row']['status'];
  computedStatus: FloorTableStatus;
  reservation: FloorPlanReservation | null;   // first/best for visual hint on canvas
  reservations: FloorPlanReservation[];        // all active reservations for detail panel
}

// ─── Reservation summary used by the floor plan ──────────────────────────────

export interface FloorPlanReservation {
  id: string;
  timeSlot: string;
  partySize: number;
  status: Database['public']['Tables']['reservations']['Row']['status'];
  source: Database['public']['Tables']['reservations']['Row']['source'];
  guestName: string | null;
  guestPhone: string | null;
  guestEmail: string | null;
  guestVip: boolean;
  shiftName: string | null;
  notes: string | null;
  tableLabels: string[];
}
