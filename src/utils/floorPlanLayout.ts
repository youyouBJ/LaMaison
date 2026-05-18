import type { FloorTableLayout, FloorLabelLayout, FloorZoneKey } from '../types/floor';

// ─── Types visuels du plan (spécifiques à ce module) ─────────────────────────

export interface FloorZoneDefinition {
  key: FloorZoneKey;
  x: number;           // % de la largeur du canvas (bord gauche)
  y: number;           // % de la hauteur du canvas (bord haut)
  w: number;           // % largeur
  h: number;           // % hauteur
  borderRadius: number;
  fillColor: string;
  strokeColor: string;
}

export interface FloorArchElement {
  type: 'counter' | 'separator';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  borderRadius?: number;
}

// ─── Couleurs du plan de salle ────────────────────────────────────────────────
// Appliquées uniquement à FloorCanvas, FloorTable, FloorZoneLabel.
// Ne pas modifier src/theme/index.ts.

export const floorPlanColors = {
  // Canvas
  canvasBg:          '#201B17',                    // brun très foncé chaud
  canvasBorder:      'rgba(184, 151, 58, 0.20)',   // bordure or discrète
  canvasWarmOverlay: 'rgba(88, 68, 42, 0.035)',    // halo chaud central, presque imperceptible
  canvasInnerBorder: 'rgba(184, 151, 58, 0.07)',   // encadrement interne décoratif
  gridLine:          'rgba(140, 115, 85, 0.045)',  // grille quasi-invisible

  // Éléments architecturaux
  counterSurface:  '#2E251E',                      // comptoir bar (légèrement plus clair que le fond)
  counterHighlight: 'rgba(255, 215, 120, 0.12)',   // reflet or sur le bord supérieur du comptoir
  separatorColor:  'rgba(160, 130, 80, 0.16)',

  // Labels de zones
  labelBg:     'rgba(18, 12, 8, 0.72)',            // moins opaque → plus intégré au plan
  labelBorder: 'rgba(200, 160, 60, 0.40)',
  labelText:   '#C8BAAC',                          // légèrement plus doux que avant

  // Statuts tables — fonds solides sur fond sombre (lisibles sans transparence)
  statusFree:         '#3D8B68',
  statusFreeBg:       '#172D22',
  statusFreeText:     '#7DCCA8',

  statusReserved:     '#C4A838',
  statusReservedBg:   '#2A2208',
  statusReservedText: '#E8CA50',

  statusOccupied:     '#C03535',
  statusOccupiedBg:   '#2A1010',
  statusOccupiedText: '#E88080',

  statusUnavailable:     '#555555',
  statusUnavailableBg:   '#202020',
  statusUnavailableText: '#888888',

  // Sélection
  selectionBorder: '#D4AA40',
  selectionShadow: 'rgba(212, 170, 64, 0.85)',

  // Numéro (fallback; les composants utilisent les couleurs per-statut)
  tableNumber: '#F0EAE0',
};

// ─── Zones visuelles ──────────────────────────────────────────────────────────
// Chaque zone est un rectangle semi-transparent positionné en % du canvas.
// Elles ne bloquent pas les interactions (pointerEvents="none").

export const LA_MAISON_FLOOR_ZONES: FloorZoneDefinition[] = [
  {
    key:          'bar_central',
    x: 49.0, y:  1.0, w: 32.5, h: 40.5,
    borderRadius: 14,
    fillColor:   'rgba(130, 90, 40, 0.10)',
    strokeColor: 'rgba(184, 151, 58, 0.10)',  // quasi-invisible
  },
  {
    key:          'bar_cigare',
    x:  9.0, y:  4.5, w: 33.5, h: 30.0,
    borderRadius: 14,
    fillColor:   'rgba(110, 72, 35, 0.10)',
    strokeColor: 'rgba(184, 151, 58, 0.08)',
  },
  {
    key:          'interieur',
    x:  7.0, y: 30.5, w: 49.5, h: 35.0,
    borderRadius: 12,
    fillColor:   'rgba(40, 75, 58, 0.10)',
    strokeColor: 'rgba(90, 155, 110, 0.10)',
  },
  {
    key:          'balcon',
    x:  7.0, y: 56.5, w: 74.0, h: 28.5,
    borderRadius: 12,
    fillColor:   'rgba(40, 62, 100, 0.11)',
    strokeColor: 'rgba(80, 125, 180, 0.09)',
  },
  {
    key:          'terrasse',
    x: 12.0, y: 73.0, w: 46.0, h: 28.5,
    borderRadius: 14,
    fillColor:   'rgba(42, 82, 58, 0.10)',
    strokeColor: 'rgba(80, 158, 100, 0.09)',
  },
  {
    key:          'lounge',
    x: 62.5, y: 73.0, w: 32.5, h: 28.5,
    borderRadius: 14,
    fillColor:   'rgba(82, 46, 88, 0.13)',
    strokeColor: 'rgba(158, 90, 170, 0.10)',
  },
];

// ─── Éléments architecturaux ──────────────────────────────────────────────────
// Comptoirs de bar et lignes de séparation entre zones.

export const LA_MAISON_ARCH_ELEMENTS: FloorArchElement[] = [
  // Comptoir bar — section verticale (à gauche des tabourets 1-5)
  { type: 'counter',   x: 49.8, y:  2.5, w: 2.8,  h: 20.5, borderRadius: 4, color: '#2C231C' },
  // Comptoir bar — section horizontale (sous les tabourets 6-11)
  { type: 'counter',   x: 56.5, y: 27.2, w: 22.5, h:  2.2, borderRadius: 4, color: '#2C231C' },
  // Comptoir lounge bar (à droite des tabourets 101-106)
  { type: 'counter',   x: 91.0, y: 74.0, w:  2.8, h: 26.0, borderRadius: 4, color: '#2C231C' },
  // Séparateur — zone bar → intérieur
  { type: 'separator', x:  7.0, y: 30.2, w: 49.5, h:  0.30, color: 'rgba(165, 135, 80, 0.18)' },
  // Séparateur — intérieur → balcon
  { type: 'separator', x:  7.0, y: 56.2, w: 74.0, h:  0.30, color: 'rgba(165, 135, 80, 0.18)' },
  // Séparateur — balcon → terrasse / lounge
  { type: 'separator', x:  7.0, y: 72.8, w: 87.5, h:  0.30, color: 'rgba(165, 135, 80, 0.18)' },
];

// ─── Zone labels ─────────────────────────────────────────────────────────────

export const LA_MAISON_FLOOR_LABELS: FloorLabelLayout[] = [
  { id: 'lbl_bar_cigare',  zone: 'bar_cigare',  x: 33.85, y:  9.66, lines: ['BAR — SALON', 'CIGARE'],    rotation: -90 },
  { id: 'lbl_bar_central', zone: 'bar_central',  x: 56.75, y: 13.92, lines: ['BAR CENTRAL'],              rotation:   0 },
  { id: 'lbl_interieur',   zone: 'interieur',    x: 29.22, y: 31.94, lines: ['RESTAURANT', 'INTÉRIEUR'],  rotation:   0 },
  { id: 'lbl_balcon',      zone: 'balcon',       x: 13.55, y: 56.52, lines: ['RESTAURANT', 'BALCON'],     rotation:   0 },
  { id: 'lbl_terrasse',    zone: 'terrasse',     x:  2.22, y: 81.99, lines: ['RESTAURANT', 'TERRASSE'],   rotation: -90 },
  { id: 'lbl_lounge',      zone: 'lounge',       x: 73.27, y: 85.48, lines: ['LOUNGE'],                   rotation: -90 },
  { id: 'lbl_lounge_bar',  zone: 'lounge',       x: 87.68, y: 80.77, lines: ['LOUNGE', 'BAR'],            rotation: -90 },
];

// ─── Tables ───────────────────────────────────────────────────────────────────

export const LA_MAISON_FLOOR_TABLES: FloorTableLayout[] = [
  // ── Bar Central ──────────────────────────────────────────────────────────
  { id:  1, zone: 'bar_central', shape: 'square', x: 53.00, y:  5.00, w: 2.2, h: 2.2, capacity: 1 },
  { id:  2, zone: 'bar_central', shape: 'square', x: 53.00, y:  8.60, w: 2.2, h: 2.2, capacity: 1 },
  { id:  3, zone: 'bar_central', shape: 'square', x: 53.00, y: 12.20, w: 2.2, h: 2.2, capacity: 1 },
  { id:  4, zone: 'bar_central', shape: 'square', x: 53.00, y: 15.80, w: 2.2, h: 2.2, capacity: 1 },
  { id:  5, zone: 'bar_central', shape: 'square', x: 53.00, y: 19.40, w: 2.2, h: 2.2, capacity: 1 },
  { id:  6, zone: 'bar_central', shape: 'square', x: 58.00, y: 25.00, w: 2.2, h: 2.2, capacity: 1 },
  { id:  7, zone: 'bar_central', shape: 'square', x: 61.60, y: 25.00, w: 2.2, h: 2.2, capacity: 1 },
  { id:  8, zone: 'bar_central', shape: 'square', x: 65.20, y: 25.00, w: 2.2, h: 2.2, capacity: 1 },
  { id:  9, zone: 'bar_central', shape: 'square', x: 68.80, y: 25.00, w: 2.2, h: 2.2, capacity: 1 },
  { id: 10, zone: 'bar_central', shape: 'square', x: 72.40, y: 25.00, w: 2.2, h: 2.2, capacity: 1 },
  { id: 11, zone: 'bar_central', shape: 'square', x: 76.00, y: 25.00, w: 2.2, h: 2.2, capacity: 1 },
  { id: 12, zone: 'bar_central', shape: 'rect',   x: 53.64, y: 34.66, w: 4.0, h: 3.0, capacity: 4, approx: true },

  // ── Bar Salon Cigare ─────────────────────────────────────────────────────
  // Table 15 légèrement décalée vers la gauche (x: 38.15 → 36.80)
  { id: 15, zone: 'bar_cigare', shape: 'rect',  x: 36.80, y: 11.55, w: 3.0, h: 8.0, capacity: 2 },
  { id: 31, zone: 'bar_cigare', shape: 'round', x: 23.00, y: 24.00, w: 6.0, h: 6.0, capacity: 6 },
  { id: 32, zone: 'bar_cigare', shape: 'rect',  x: 13.50, y: 22.00, w: 6.5, h: 3.4, capacity: 4 },

  // ── Restaurant Intérieur ─────────────────────────────────────────────────
  { id: 34, zone: 'interieur', shape: 'round', x: 19.44, y: 34.93, w: 3.6, h: 3.6, capacity: 2 },
  { id: 43, zone: 'interieur', shape: 'round', x: 11.00, y: 38.50, w: 3.6, h: 3.6, capacity: 2 },
  { id: 42, zone: 'interieur', shape: 'round', x: 18.33, y: 41.15, w: 3.6, h: 3.6, capacity: 2 },
  { id: 41, zone: 'interieur', shape: 'round', x: 25.04, y: 41.24, w: 3.6, h: 3.6, capacity: 2 },
  { id: 24, zone: 'interieur', shape: 'rect',  x: 37.00, y: 40.00, w: 3.2, h: 3.5, capacity: 2 },
  { id: 23, zone: 'interieur', shape: 'rect',  x: 41.50, y: 40.00, w: 3.2, h: 3.5, capacity: 2 },
  { id: 22, zone: 'interieur', shape: 'rect',  x: 46.00, y: 40.00, w: 3.2, h: 3.5, capacity: 2 },
  { id: 21, zone: 'interieur', shape: 'rect',  x: 50.50, y: 40.00, w: 3.2, h: 3.5, capacity: 2 },
  { id: 44, zone: 'interieur', shape: 'round', x: 11.00, y: 48.00, w: 6.2, h: 6.2, capacity: 6 },
  { id: 45, zone: 'interieur', shape: 'round', x: 18.50, y: 48.00, w: 4.8, h: 4.8, capacity: 4 },
  { id: 46, zone: 'interieur', shape: 'round', x: 25.50, y: 48.00, w: 4.8, h: 4.8, capacity: 4 },
  { id: 62, zone: 'interieur', shape: 'round', x: 36.79, y: 58.29, w: 3.6, h: 3.6, capacity: 2 },
  { id: 61, zone: 'interieur', shape: 'round', x: 43.24, y: 58.50, w: 3.6, h: 3.6, capacity: 2 },

  // ── Restaurant Balcon ────────────────────────────────────────────────────
  { id: 54,  zone: 'balcon', shape: 'round', x: 69.72, y: 59.12, w: 3.6, h: 3.6, capacity: 2 },
  { id: 53,  zone: 'balcon', shape: 'round', x: 75.81, y: 59.18, w: 3.6, h: 3.6, capacity: 2 },
  { id: 63,  zone: 'balcon', shape: 'rect',  x: 10.40, y: 64.15, w: 3.2, h: 3.5, capacity: 2 },
  { id: 64,  zone: 'balcon', shape: 'rect',  x: 18.41, y: 69.27, w: 3.2, h: 3.5, capacity: 2 },
  { id: 65,  zone: 'balcon', shape: 'rect',  x: 23.88, y: 69.17, w: 3.2, h: 3.5, capacity: 2 },
  { id: 66,  zone: 'balcon', shape: 'rect',  x: 29.50, y: 69.04, w: 3.2, h: 3.5, capacity: 2 },
  { id: 67,  zone: 'balcon', shape: 'rect',  x: 36.78, y: 67.87, w: 3.2, h: 5.8, capacity: 2 },
  { id: 68,  zone: 'balcon', shape: 'rect',  x: 43.26, y: 67.83, w: 3.2, h: 5.8, capacity: 2 },
  { id: 51,  zone: 'balcon', shape: 'rect',  x: 68.82, y: 69.42, w: 3.2, h: 5.8, capacity: 2 },
  { id: 52,  zone: 'balcon', shape: 'rect',  x: 74.44, y: 69.29, w: 3.2, h: 5.8, capacity: 2 },
  { id: 112, zone: 'balcon', shape: 'rect',  x: 67.96, y: 77.29, w: 3.2, h: 5.8, capacity: 2 },
  { id: 111, zone: 'balcon', shape: 'rect',  x: 74.45, y: 77.25, w: 3.2, h: 5.8, capacity: 2 },

  // ── Restaurant Terrasse ──────────────────────────────────────────────────
  { id: 82, zone: 'terrasse', shape: 'round', x: 22.00, y: 76.00, w: 4.4, h: 4.4, capacity: 4 },
  { id: 81, zone: 'terrasse', shape: 'round', x: 30.00, y: 76.50, w: 6.4, h: 6.4, capacity: 6 },
  { id: 72, zone: 'terrasse', shape: 'round', x: 39.00, y: 76.00, w: 3.6, h: 3.6, capacity: 2 },
  { id: 71, zone: 'terrasse', shape: 'round', x: 46.50, y: 76.00, w: 3.6, h: 3.6, capacity: 2 },
  { id: 83, zone: 'terrasse', shape: 'round', x: 22.00, y: 85.00, w: 3.6, h: 3.6, capacity: 2 },
  { id: 86, zone: 'terrasse', shape: 'round', x: 31.00, y: 85.00, w: 4.6, h: 4.6, capacity: 4 },
  { id: 73, zone: 'terrasse', shape: 'round', x: 40.00, y: 85.00, w: 4.6, h: 4.6, capacity: 4 },
  { id: 76, zone: 'terrasse', shape: 'round', x: 48.00, y: 85.00, w: 4.6, h: 4.6, capacity: 4 },
  { id: 84, zone: 'terrasse', shape: 'round', x: 22.00, y: 93.00, w: 6.2, h: 6.2, capacity: 6 },
  { id: 85, zone: 'terrasse', shape: 'round', x: 32.00, y: 93.50, w: 4.6, h: 4.6, capacity: 4 },
  { id: 74, zone: 'terrasse', shape: 'round', x: 40.00, y: 93.50, w: 4.6, h: 4.6, capacity: 4 },
  { id: 75, zone: 'terrasse', shape: 'round', x: 48.00, y: 93.00, w: 6.2, h: 6.2, capacity: 6 },

  // ── Lounge / Lounge Bar ──────────────────────────────────────────────────
  { id: 114, zone: 'lounge', shape: 'rect',    x: 67.87, y: 85.14, w: 3.2, h: 5.8, capacity: 4 },
  { id: 115, zone: 'lounge', shape: 'rect',    x: 67.82, y: 93.49, w: 3.2, h: 5.8, capacity: 4 },
  { id: 116, zone: 'lounge', shape: 'diamond', x: 75.10, y: 94.58, w: 3.6, h: 3.6, capacity: 2 },
  { id: 101, zone: 'lounge', shape: 'round',   x: 87.00, y: 76.00, w: 3.0, h: 3.0, capacity: 2 },
  { id: 102, zone: 'lounge', shape: 'round',   x: 87.00, y: 79.40, w: 3.0, h: 3.0, capacity: 2 },
  { id: 103, zone: 'lounge', shape: 'round',   x: 87.13, y: 83.44, w: 3.0, h: 3.0, capacity: 2 },
  { id: 104, zone: 'lounge', shape: 'round',   x: 87.19, y: 87.44, w: 3.0, h: 3.0, capacity: 2 },
  { id: 105, zone: 'lounge', shape: 'round',   x: 87.47, y: 91.89, w: 3.0, h: 3.0, capacity: 2 },
  { id: 106, zone: 'lounge', shape: 'round',   x: 89.20, y: 97.34, w: 3.0, h: 3.0, capacity: 2 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const ZONE_LABELS: Record<FloorZoneKey, string> = {
  bar_central: 'Bar Central',
  bar_cigare:  'Bar Salon Cigare',
  interieur:   'Restaurant Intérieur',
  balcon:      'Restaurant Balcon',
  terrasse:    'Restaurant Terrasse',
  lounge:      'Lounge / Lounge Bar',
};
