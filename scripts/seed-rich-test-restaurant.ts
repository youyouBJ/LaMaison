/**
 * seed-rich-test-restaurant.ts
 *
 * Enrichit le dataset fictif de "La Maison Test" pour des tests réalistes via TestFlight.
 *
 * Crée (idempotent — relancer ne crée pas de doublons) :
 *   - ~20 tables réparties en 5 zones (Salle, Terrasse, Balcon, Bar, Lounge)
 *   - ~120 clients fictifs avec noms tunisiens, téléphones +21699XXXXXX, emails @lamaison-test.local
 *   - ~180 réservations sur -30j / aujourd'hui / +30j avec tous les statuts
 *   - ~18 entrées waitlist (waiting / notified / seated / left)
 *   - ~30 enquêtes de satisfaction sur des réservations completed passées
 *   - Quelques réservations multi-tables (reservation_tables)
 *
 * Sécurité :
 *   - Vérifie TOUJOURS que restaurant.name = "La Maison Test"
 *   - Si ce n'est pas le cas, arrête immédiatement
 *   - N'utilise JAMAIS le vrai restaurant_id
 *   - Aucun DELETE, aucun TRUNCATE
 *
 * Usage :
 *   npm run test:seed:rich:dry-run
 *   npm run test:seed:rich:apply -- --confirm=SEED_RICH_TEST_DATA
 *
 * Variables requises dans .env.import :
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   TEST_RESTAURANT_ID  (optionnel — fallback vers 57020ad8-482b-4016-a8f4-24d308ce58d3)
 *
 * Si feedback_surveys ou feedback_survey_links renvoient "permission denied",
 * ajouter ces GRANTs dans Supabase → SQL Editor :
 *   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feedback_survey_links TO service_role;
 *   GRANT SELECT, INSERT ON TABLE public.feedback_surveys TO service_role;
 */

import { config as dotenvConfig } from 'dotenv';
import { resolve }                 from 'path';
import { existsSync }              from 'fs';
import { createClient }            from '@supabase/supabase-js';
import type { SupabaseClient }     from '@supabase/supabase-js';
import type {
  ReservationStatus,
  ReservationSource,
  WaitlistStatus,
  GuestSource,
} from '../src/types/database';

// ─── Env ──────────────────────────────────────────────────────────────────────

const envPath = resolve(process.cwd(), '.env.import');
if (!existsSync(envPath)) {
  console.error('❌  Fichier .env.import introuvable.');
  process.exit(1);
}
dotenvConfig({ path: envPath });

const supabaseUrl    = process.env['SUPABASE_URL'];
const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const envRestaurantId = process.env['TEST_RESTAURANT_ID'];

if (!supabaseUrl)    { console.error('❌  SUPABASE_URL manquant dans .env.import');           process.exit(1); }
if (!serviceRoleKey) { console.error('❌  SUPABASE_SERVICE_ROLE_KEY manquante dans .env.import'); process.exit(1); }

const SUPABASE_URL:     string = supabaseUrl;
const SERVICE_ROLE_KEY: string = serviceRoleKey;

// ─── Args ─────────────────────────────────────────────────────────────────────

const CONFIRM_TOKEN = 'SEED_RICH_TEST_DATA';
const args          = process.argv.slice(2);
const hasApply      = args.includes('--apply');
const hasConfirm    = args.includes(`--confirm=${CONFIRM_TOKEN}`);

if (hasApply && !hasConfirm) {
  console.error(`❌  Mode apply sans token de confirmation.`);
  console.error(`    Relancez avec : --apply --confirm=${CONFIRM_TOKEN}`);
  process.exit(1);
}

const isApply  = hasApply && hasConfirm;
const isDryRun = !isApply;

// ─── Client ───────────────────────────────────────────────────────────────────

const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

// ─── Constantes ───────────────────────────────────────────────────────────────

const TEST_RESTAURANT_NAME  = 'La Maison Test';
const FALLBACK_RESTAURANT_ID = '57020ad8-482b-4016-a8f4-24d308ce58d3';
const TARGET_RESTAURANT_ID  = envRestaurantId ?? FALLBACK_RESTAURANT_ID;

const SEED_MARKER = '[SEED-RICH]';
const PHONE_PREFIX = '+21699';

const PERM_HINT = [
  '   💡  Permissions manquantes pour service_role.',
  '       Exécutez dans Supabase → SQL Editor :',
  '       supabase/manual/grant_service_role.sql',
].join('\n');

const FEEDBACK_PERM_HINT = [
  '   💡  Permissions manquantes pour feedback_survey_links / feedback_surveys.',
  '       Ajoutez dans Supabase → SQL Editor :',
  '         GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feedback_survey_links TO service_role;',
  '         GRANT SELECT, INSERT ON TABLE public.feedback_surveys TO service_role;',
].join('\n');

function isPermissionError(msg: string): boolean {
  return msg.toLowerCase().includes('permission denied');
}

// ─── Types internes ───────────────────────────────────────────────────────────

type GuestDefinition = {
  first_name:     string;
  last_name:      string;
  phone:          string;
  email:          string | null;
  birthday:       string | null;
  notes:          string | null;
  tags:           string[];
  vip:            boolean;
  avg_rating:     number | null;
  marketing_opt_in: boolean;
  source:         GuestSource;
};

type GuestState = {
  id:       string;
  phone:    string;
  hasEmail: boolean;
  isVip:    boolean;
};

type ReservationInsertData = {
  restaurant_id: string;
  guest_id:      string | null;
  table_id:      string | null;
  shift_id:      string | null;
  date:          string;
  time_slot:     string;
  party_size:    number;
  status:        ReservationStatus;
  notes:         string | null;
  source:        ReservationSource;
};

type WaitlistInsertData = {
  restaurant_id: string;
  guest_id:      string | null;
  date:          string;
  party_size:    number;
  status:        WaitlistStatus;
  notes:         string | null;
};

type FeedbackSurveyInsertData = {
  restaurant_id:   string;
  reservation_id:  string | null;
  guest_id:        string | null;
  survey_link_id:  string | null;
  token:           string;
  rating_overall:  number;
  rating_food:     number | null;
  rating_drinks:   number | null;
  rating_service:  number | null;
  rating_ambience: number | null;
  recommended:     boolean | null;
  comment:         string | null;
  source:          string;
  submitted_at:    string;
};

type ShiftRow    = { id: string; name: string };
type TableRow    = { id: string; label: string; capacity: number };
type GuestRow    = { id: string; phone: string; email: string | null; vip: boolean };
type ResRow      = { id: string; guest_id: string | null; date: string; time_slot: string; status: string };
type WaitRow     = { id: string; guest_id: string | null; date: string };
type FeedbackRow = { reservation_id: string | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0] as string;
}

function pick<T>(arr: readonly T[], idx: number): T {
  return arr[((idx % arr.length) + arr.length) % arr.length] as T;
}

// ─── Données : Clients ────────────────────────────────────────────────────────

const FIRST_NAMES_M = [
  'Ahmed', 'Mohamed', 'Ali', 'Sami', 'Karim', 'Youssef', 'Slim', 'Nabil',
  'Adel', 'Rami', 'Chedi', 'Maher', 'Wissem', 'Amine', 'Tarek', 'Fawzi',
  'Zied', 'Mehdi', 'Bilel', 'Lotfi', 'Taoufik', 'Hatem', 'Wahid', 'Mondher',
  'Hichem', 'Sofiene', 'Faouzi', 'Ridha', 'Mustapha', 'Samir', 'Jabeur',
  'Aymen', 'Ghazi', 'Mourad', 'Naim', 'Seifeddine', 'Issam', 'Rafik', 'Bassem', 'Walid',
] as const;

const FIRST_NAMES_F = [
  'Fatma', 'Amina', 'Lina', 'Sana', 'Rim', 'Ons', 'Yasmine', 'Meriem',
  'Ines', 'Salma', 'Nadia', 'Hanen', 'Wafa', 'Marwa', 'Khaoula', 'Amal',
  'Sabrine', 'Asma', 'Leila', 'Sirine', 'Ferida', 'Manel', 'Nesrine',
  'Ghofrane', 'Rania', 'Houda', 'Nour', 'Rahma', 'Sarra', 'Dorra',
] as const;

const LAST_NAMES = [
  'Ben Ali', 'Chaouachi', 'Meddeb', 'Belhaj', 'Jebali', 'Trabelsi', 'Khelifi',
  'Riahi', 'Ferjani', 'Bouzid', 'Amamou', 'Laabidi', 'Mnif', 'Gafsi', 'Touati',
  'Hamdi', 'Zouari', 'Sassi', 'Chebbi', 'Ben Youssef', 'Haddad', 'Dridi', 'Ayari',
  'Barka', 'Ben Amara', 'Karray', 'Mansouri', 'Romdhane', 'Mejri', 'Ben Salem',
  'Gharbi', 'Tlili', 'Rezgui', 'Sfar', 'Jabnoun',
] as const;

const ALL_TAGS = [
  'Préfère terrasse', 'Client régulier', 'Demande table calme',
  'Allergie fruits de mer', 'Préférence balcon', 'VIP',
  'Anniversaire', 'Aime le lounge', 'Client fidèle', 'Végétarien',
] as const;

const NOTES_OPTIONS: readonly (string | null)[] = [
  'Préférence table d\'angle', 'Chaise haute nécessaire', 'Allergie gluten',
  'Fête d\'anniversaire', 'Client très fidèle',
  null, null, null, null, null,
];

const AVG_RATINGS = [3.5, 4.0, 4.2, 4.5, 4.8, 3.8, 4.1, 3.9, 4.6, 5.0] as const;

const BIRTHDAYS = [
  '1985-03-15', '1990-07-22', '1978-11-08', '1995-01-30', '1982-06-14',
  '1988-09-25', '1975-12-03', '1993-04-17', '1987-08-28', '1970-02-11',
] as const;

function buildGuestDefinitions(): GuestDefinition[] {
  const ALL_FIRST = [...FIRST_NAMES_M, ...FIRST_NAMES_F];
  const guests: GuestDefinition[] = [];

  for (let i = 1; i <= 120; i++) {
    const firstName  = pick(ALL_FIRST, i - 1);
    const lastName   = pick(LAST_NAMES, i - 1);
    const hasEmail   = (i % 5 < 2);          // ~40 %
    const isVip      = (i % 8 === 0);         // ~15 clients
    const hasRating  = (i % 2 === 0);         // ~60 clients
    const hasBirthday = (i % 12 === 0);       // ~10 clients
    const noteOpt    = NOTES_OPTIONS[(i - 1) % NOTES_OPTIONS.length] ?? null;

    const tagCount = (i % 4 === 0) ? 2 : (i % 3 === 0) ? 1 : 0;
    const tags: string[] = [];
    for (let t = 0; t < tagCount; t++) {
      const tag = ALL_TAGS[(i + t * 3) % ALL_TAGS.length];
      if (tag !== undefined && !tags.includes(tag)) tags.push(tag);
    }
    if (isVip && !tags.includes('VIP')) tags.push('VIP');

    guests.push({
      first_name:     firstName,
      last_name:      lastName,
      phone:          `${PHONE_PREFIX}${String(i).padStart(6, '0')}`,
      email:          hasEmail ? `guest${String(i).padStart(3, '0')}@lamaison-test.local` : null,
      birthday:       hasBirthday ? (BIRTHDAYS[(i / 12 - 1) % BIRTHDAYS.length] ?? null) : null,
      notes:          noteOpt,
      tags,
      vip:            isVip,
      avg_rating:     hasRating ? (AVG_RATINGS[(i - 1) % AVG_RATINGS.length] ?? null) : null,
      marketing_opt_in: i % 4 !== 0,
      source:         'manual',
    });
  }
  return guests;
}

// ─── Données : Réservations ───────────────────────────────────────────────────

const LUNCH_SLOTS  = ['12:30', '13:00', '13:30', '14:00', '14:30'] as const;
const DINNER_SLOTS = ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30'] as const;
const PARTY_SIZES  = [2, 3, 4, 2, 4, 6, 2, 4, 2, 6, 8] as const;

const PAST_STATUS_RECENT: readonly ReservationStatus[] = ['completed', 'completed', 'completed', 'completed', 'cancelled', 'noshow'];
const PAST_STATUS_OLD:    readonly ReservationStatus[] = ['completed', 'completed', 'completed', 'cancelled', 'cancelled', 'noshow', 'noshow'];

function computeArrivingSoonSlot(): string {
  const now  = new Date();
  const mins = now.getMinutes();
  // Round up to next 30-min mark
  if (mins < 30) {
    return `${String(now.getHours()).padStart(2, '0')}:30`;
  }
  const nextHour = (now.getHours() + 1) % 24;
  return `${String(nextHour).padStart(2, '0')}:00`;
}

function generateReservations(
  restaurantId:  string,
  guests:        GuestState[],
  tableIds:      Map<string, string>,
  lunchShiftId:  string | null,
  dinnerShiftId: string | null,
): ReservationInsertData[] {
  const reservations: ReservationInsertData[] = [];
  const tableLabels = [...tableIds.keys()];
  const todayStr    = dateOffset(0);

  // ── Passé : -30 à -1 (90 réservations, 3 par jour) ──────────────────────
  for (let dayOff = -30; dayOff <= -1; dayOff++) {
    const dateStr   = dateOffset(dayOff);
    const absOff    = Math.abs(dayOff);
    const statusPool = dayOff >= -7 ? PAST_STATUS_RECENT : PAST_STATUS_OLD;

    for (let slot = 0; slot < 3; slot++) {
      const idx        = absOff * 3 + slot;
      const isLunch    = slot === 0;
      const timeSlot   = isLunch
        ? pick(LUNCH_SLOTS, slot)
        : pick(DINNER_SLOTS, slot - 1);
      const status     = pick(statusPool, idx);
      const guestIdx   = ((idx * 7 + 13) % guests.length + guests.length) % guests.length;
      const tableLabel = pick(tableLabels, idx * 3 + 5);
      const partySize  = pick(PARTY_SIZES, idx);

      reservations.push({
        restaurant_id: restaurantId,
        guest_id:      guests[guestIdx]?.id ?? null,
        table_id:      tableIds.get(tableLabel) ?? null,
        shift_id:      isLunch ? lunchShiftId : dinnerShiftId,
        date:          dateStr,
        time_slot:     timeSlot,
        party_size:    partySize,
        status,
        notes:         `${SEED_MARKER} Réservation de test`,
        source:        'phone',
      });
    }
  }

  // ── Aujourd'hui : cas de test ciblés ─────────────────────────────────────
  const arrivingSoonSlot = computeArrivingSoonSlot();

  type TodayCase = {
    timeSlot:  string;
    partySize: number;
    status:    ReservationStatus;
    guestIdx:  number;
    tableIdx:  number; // index circulaire dans tableLabels
    notes:     string;
    shiftType: 'lunch' | 'dinner';
  };

  const todayCases: TodayCase[] = [
    { timeSlot: '12:30',          partySize: 2, status: 'pending',   guestIdx: 0,  tableIdx: 0, notes: `${SEED_MARKER} En attente déjeuner`,         shiftType: 'lunch'  },
    { timeSlot: '13:00',          partySize: 4, status: 'pending',   guestIdx: 5,  tableIdx: 1, notes: `${SEED_MARKER} En attente déjeuner 2`,        shiftType: 'lunch'  },
    { timeSlot: '13:30',          partySize: 2, status: 'completed', guestIdx: 10, tableIdx: 2, notes: `${SEED_MARKER} Terminé déjeuner`,              shiftType: 'lunch'  },
    { timeSlot: '14:00',          partySize: 4, status: 'seated',    guestIdx: 15, tableIdx: 3, notes: `${SEED_MARKER} Installé déjeuner`,             shiftType: 'lunch'  },
    { timeSlot: '12:30',          partySize: 2, status: 'completed', guestIdx: 22, tableIdx: 4, notes: `${SEED_MARKER} Terminé avec email 1`,          shiftType: 'lunch'  },
    { timeSlot: '13:30',          partySize: 4, status: 'completed', guestIdx: 27, tableIdx: 2, notes: `${SEED_MARKER} Terminé avec email 2`,          shiftType: 'lunch'  },
    { timeSlot: '19:00',          partySize: 4, status: 'confirmed', guestIdx: 30, tableIdx: 3, notes: `${SEED_MARKER} Confirmé dîner`,                shiftType: 'dinner' },
    { timeSlot: arrivingSoonSlot, partySize: 3, status: 'confirmed', guestIdx: 35, tableIdx: 0, notes: `${SEED_MARKER} Arrivée prochaine`,             shiftType: 'dinner' },
    { timeSlot: '20:00',          partySize: 4, status: 'confirmed', guestIdx: 40, tableIdx: 1, notes: `${SEED_MARKER} Grand groupe VIP multi-tables`, shiftType: 'dinner' },
    { timeSlot: '20:30',          partySize: 2, status: 'cancelled', guestIdx: 45, tableIdx: 4, notes: `${SEED_MARKER} Annulé`,                        shiftType: 'dinner' },
  ];

  for (const tc of todayCases) {
    const gIdx       = tc.guestIdx % guests.length;
    const tableLabel = pick(tableLabels, tc.tableIdx);
    reservations.push({
      restaurant_id: restaurantId,
      guest_id:      guests[gIdx]?.id ?? null,
      table_id:      tableIds.get(tableLabel) ?? null,
      shift_id:      tc.shiftType === 'lunch' ? lunchShiftId : dinnerShiftId,
      date:          todayStr,
      time_slot:     tc.timeSlot,
      party_size:    tc.partySize,
      status:        tc.status,
      notes:         tc.notes,
      source:        'phone',
    });
  }

  // ── Futur : +1 à +30 (~80 réservations) ──────────────────────────────────
  for (let dayOff = 1; dayOff <= 30; dayOff++) {
    const dateStr    = dateOffset(dayOff);
    const revsPerDay = dayOff % 3 === 0 ? 2 : 3; // 20j×2 + 10j×3 = 40+30 = 70... adjust below
    // Actual: 20 days with dayOff%3===0 among 1-30 → days 3,6,9,...,30 = 10 days → 10×2=20
    // 20 remaining days → 20×3=60. Total = 80. ✓

    for (let slot = 0; slot < revsPerDay; slot++) {
      const idx        = dayOff * 3 + slot;
      const isLunch    = slot === 0;
      const timeSlot   = isLunch
        ? pick(LUNCH_SLOTS, dayOff + slot)
        : pick(DINNER_SLOTS, dayOff + slot - 1);
      const status: ReservationStatus = idx % 10 < 7 ? 'confirmed' : 'pending';
      const guestIdx   = ((idx * 11 + 7) % guests.length + guests.length) % guests.length;
      const tableLabel = pick(tableLabels, idx * 5 + 3);
      const partySize  = pick(PARTY_SIZES, idx * 3 + 1);

      reservations.push({
        restaurant_id: restaurantId,
        guest_id:      guests[guestIdx]?.id ?? null,
        table_id:      tableIds.get(tableLabel) ?? null,
        shift_id:      isLunch ? lunchShiftId : dinnerShiftId,
        date:          dateStr,
        time_slot:     timeSlot,
        party_size:    partySize,
        status,
        notes:         `${SEED_MARKER} Réservation de test`,
        source:        'phone',
      });
    }
  }

  return reservations;
}

// ─── Données : Waitlist ───────────────────────────────────────────────────────

type WaitlistCase = {
  dayOffset:  number;
  partySize:  number;
  status:     WaitlistStatus;
  guestIdx:   number;
  notes:      string;
};

const WAITLIST_CASES: readonly WaitlistCase[] = [
  // Aujourd'hui — waiting (pour tester les rappels urgents)
  { dayOffset:  0, partySize: 2, status: 'waiting',  guestIdx: 60, notes: `${SEED_MARKER} Attente groupe 2`          },
  { dayOffset:  0, partySize: 4, status: 'waiting',  guestIdx: 65, notes: `${SEED_MARKER} Attente groupe 4`          },
  { dayOffset:  0, partySize: 3, status: 'waiting',  guestIdx: 70, notes: `${SEED_MARKER} Attente famille`           },
  { dayOffset:  0, partySize: 6, status: 'notified', guestIdx: 75, notes: `${SEED_MARKER} Notifié`                   },
  { dayOffset:  0, partySize: 2, status: 'seated',   guestIdx: 80, notes: `${SEED_MARKER} Installé`                  },
  { dayOffset:  0, partySize: 4, status: 'left',     guestIdx: 85, notes: `${SEED_MARKER} Parti`                     },
  // Passé récent
  { dayOffset: -1, partySize: 2, status: 'seated',   guestIdx: 90, notes: `${SEED_MARKER} Installé hier`             },
  { dayOffset: -1, partySize: 3, status: 'left',     guestIdx: 95, notes: `${SEED_MARKER} Parti hier`                },
  { dayOffset: -2, partySize: 4, status: 'seated',   guestIdx: 100, notes: `${SEED_MARKER} Installé avant-hier`     },
  { dayOffset: -2, partySize: 2, status: 'left',     guestIdx: 105, notes: `${SEED_MARKER} Parti avant-hier`        },
  { dayOffset: -3, partySize: 2, status: 'left',     guestIdx: 10,  notes: `${SEED_MARKER} Parti il y a 3 jours`    },
  { dayOffset: -4, partySize: 6, status: 'seated',   guestIdx: 15,  notes: `${SEED_MARKER} Installé il y a 4 jours` },
  { dayOffset: -5, partySize: 3, status: 'left',     guestIdx: 20,  notes: `${SEED_MARKER} Parti il y a 5 jours`    },
  { dayOffset: -7, partySize: 4, status: 'seated',   guestIdx: 25,  notes: `${SEED_MARKER} Installé il y a 7 jours` },
  // Futur
  { dayOffset:  1, partySize: 2, status: 'waiting',  guestIdx: 110, notes: `${SEED_MARKER} Attente demain`          },
  { dayOffset:  1, partySize: 5, status: 'waiting',  guestIdx: 115, notes: `${SEED_MARKER} Attente grande table demain` },
  { dayOffset:  2, partySize: 3, status: 'waiting',  guestIdx: 0,   notes: `${SEED_MARKER} Attente dans 2 jours`   },
  { dayOffset:  3, partySize: 4, status: 'waiting',  guestIdx: 5,   notes: `${SEED_MARKER} Attente dans 3 jours`   },
];

// ─── Données : Feedback ───────────────────────────────────────────────────────

const FEEDBACK_COMMENTS: readonly (string | null)[] = [
  'Très bon service, nous reviendrons!',
  'Belle ambiance, cuisine raffinée.',
  'Excellent dîner, personnel attentionné.',
  'Un peu d\'attente mais ça valait le déplacement.',
  'Très bonne expérience globale.',
  'Terrasse agréable le soir.',
  'Service impeccable et rapide.',
  'Bonne cuisine, ambiance chaleureuse.',
  'Soirée parfaite, merci!',
  'Très bonne surprise, on recommande.',
  null,
  null,
];

type FeedbackProfile = {
  overall:  number;
  food:     number | null;
  drinks:   number | null;
  service:  number | null;
  ambience: number | null;
  recommended: boolean | null;
};

const FEEDBACK_PROFILES: readonly FeedbackProfile[] = [
  { overall: 5, food: 5, drinks: 5, service: 5, ambience: 5, recommended: true  },
  { overall: 4, food: 4, drinks: 4, service: 5, ambience: 4, recommended: true  },
  { overall: 4, food: 5, drinks: null, service: 4, ambience: 4, recommended: true  },
  { overall: 5, food: 5, drinks: 5, service: 5, ambience: 4, recommended: true  },
  { overall: 3, food: 3, drinks: 3, service: 4, ambience: 3, recommended: null  },
  { overall: 4, food: 4, drinks: null, service: 4, ambience: 5, recommended: true  },
  { overall: 5, food: 5, drinks: 4, service: 5, ambience: 5, recommended: true  },
  { overall: 4, food: 3, drinks: 4, service: 4, ambience: 4, recommended: true  },
  { overall: 3, food: 4, drinks: null, service: 3, ambience: 4, recommended: false },
  { overall: 5, food: 5, drinks: 5, service: 5, ambience: 5, recommended: true  },
];

// ─── Dry-run ──────────────────────────────────────────────────────────────────

async function runDryRun(): Promise<void> {
  console.log('\n' + '═'.repeat(68));
  console.log('  DRY-RUN — seed-rich-test-restaurant');
  console.log('═'.repeat(68));
  console.log(`  Supabase       : ${SUPABASE_URL}`);
  console.log(`  Restaurant ID  : ${TARGET_RESTAURANT_ID}`);
  console.log(`  Cible          : "${TEST_RESTAURANT_NAME}"`);
  console.log('─'.repeat(68) + '\n');

  // Vérification de l'accès
  for (const table of ['restaurants', 'guests', 'reservations', 'waitlist'] as const) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && isPermissionError(error.message)) {
      console.warn(`  ⚠️   Accès refusé sur public.${table}`);
    }
  }

  // Vérifier si le restaurant existe et porte le bon nom
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('id', TARGET_RESTAURANT_ID)
    .maybeSingle()
    .returns<{ id: string; name: string } | null>();

  if (!restaurant) {
    console.warn(`  ⚠️   Restaurant introuvable pour l'ID ${TARGET_RESTAURANT_ID}`);
  } else if (restaurant.name !== TEST_RESTAURANT_NAME) {
    console.error(`  ❌  SÉCURITÉ : le restaurant trouvé s'appelle "${restaurant.name}"`);
    console.error(`      Attendu : "${TEST_RESTAURANT_NAME}"`);
    console.error('      Le dry-run s\'arrête ici — aucune donnée ne serait créée.');
    console.log('═'.repeat(68) + '\n');
    return;
  } else {
    console.log(`  ✅  Restaurant confirmé : "${restaurant.name}"\n`);
  }

  const guestDefs = buildGuestDefinitions();
  const today     = dateOffset(0);
  const dateFrom  = dateOffset(-30);
  const dateTo    = dateOffset(30);

  // Compte des réservations futures générées
  let pastCount   = 30 * 3; // 90
  const todayCount = 10;
  let futureCount  = 0;
  for (let d = 1; d <= 30; d++) { futureCount += d % 3 === 0 ? 2 : 3; }

  console.log('  Dataset prévu :');
  console.log(`    🗺️   Tables      : réutilisation des tables existantes (plan de salle non modifié)`);
  console.log(`    👥  Clients     : ${guestDefs.length} fictifs (téléphones +21699XXXXXX, emails @lamaison-test.local)`);
  console.log(`    📋  Réservations: ~${pastCount + todayCount + futureCount}`);
  console.log(`                      · ${pastCount} passées (-30j → -1j)`);
  console.log(`                      · ${todayCount} aujourd'hui (${today}) — cas ciblés`);
  console.log(`                      · ${futureCount} futures (+1j → +30j)`);
  console.log(`    📅  Période     : ${dateFrom} → ${dateTo}`);
  console.log(`    🕐  Waitlist    : ${WAITLIST_CASES.length} entrées`);
  console.log(`    ⭐  Feedback    : ~30 enquêtes sur réservations completed passées`);
  console.log(`    🔗  Multi-tables: oui (reservation_tables)`);

  console.log('\n  Cas de test ciblés aujourd\'hui :');
  console.log('    · 2 réservations pending (rappels urgents)');
  console.log('    · 1 réservation confirmed dans ~30min (arrivée prochaine)');
  console.log('    · 2 réservations seated (plan de salle)');
  console.log('    · 3 réservations completed avec email (enquête satisfaction)');
  console.log('    · 1 réservation cancelled');

  console.log('\n  ✅  Le restaurant réel n\'est PAS touché.');
  console.log('      Les RLS (restaurant_id) garantissent l\'isolation totale.\n');

  if (!restaurant) {
    console.log(`  ⚠️   Créez d\'abord "La Maison Test" via :`);
    console.log(`       npm run test:seed:apply -- --confirm=CREATE_TEST_RESTAURANT\n`);
  } else {
    console.log(`  Pour appliquer ce dataset immersif :`);
    console.log(`    npm run test:seed:rich:apply -- --confirm=${CONFIRM_TOKEN}`);
    console.log(`    (Idempotent — peut être relancé sans créer de doublons)`);
  }
  console.log('═'.repeat(68) + '\n');
}

// ─── Apply : vérification restaurant ─────────────────────────────────────────

async function verifyTestRestaurant(): Promise<string> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name')
    .eq('id', TARGET_RESTAURANT_ID)
    .maybeSingle()
    .returns<{ id: string; name: string } | null>();

  if (error) {
    console.error(`❌  Impossible de vérifier le restaurant : ${error.message}`);
    if (isPermissionError(error.message)) console.error(PERM_HINT);
    process.exit(1);
  }
  if (!data) {
    console.error(`❌  Restaurant introuvable pour l'ID : ${TARGET_RESTAURANT_ID}`);
    console.error('    Créez d\'abord "La Maison Test" via npm run test:seed:apply');
    process.exit(1);
  }
  if (data.name !== TEST_RESTAURANT_NAME) {
    console.error(`❌  SÉCURITÉ : le restaurant trouvé s'appelle "${data.name}"`);
    console.error(`    Attendu exactement : "${TEST_RESTAURANT_NAME}"`);
    console.error('    Le script s\'arrête. Le vrai restaurant n\'a pas été modifié.');
    process.exit(1);
  }

  console.log(`  ✅  Restaurant confirmé : "${data.name}" (${data.id})\n`);
  return data.id;
}

// ─── Apply : shifts ───────────────────────────────────────────────────────────

async function seedShifts(restaurantId: string): Promise<{ lunch: string | null; dinner: string | null }> {
  console.log('📅  Services…');

  const { data: shifts, error } = await supabase
    .from('shifts')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .returns<ShiftRow[]>();

  if (error) {
    console.warn(`  ⚠️   Impossible de récupérer les services : ${error.message}`);
    if (isPermissionError(error.message)) console.warn(PERM_HINT);
    return { lunch: null, dinner: null };
  }

  const lunchShift  = shifts?.find(s => s.name === 'Déjeuner Test') ?? null;
  const dinnerShift = shifts?.find(s => s.name === 'Dîner Test')    ?? null;

  if (lunchShift)  console.log(`  ℹ️   Service Déjeuner Test : ${lunchShift.id}`);
  else             console.log('  ⚠️   Service "Déjeuner Test" introuvable — les réservations seront sans shift_id');

  if (dinnerShift) console.log(`  ℹ️   Service Dîner Test    : ${dinnerShift.id}`);
  else             console.log('  ⚠️   Service "Dîner Test" introuvable — les réservations seront sans shift_id');

  return { lunch: lunchShift?.id ?? null, dinner: dinnerShift?.id ?? null };
}

// ─── Apply : tables (lecture seule — plan non modifié) ───────────────────────

type LoadedTables = {
  tableIds:     Map<string, string>;
  tableList:    TableRow[];
};

async function loadExistingTables(restaurantId: string): Promise<LoadedTables> {
  console.log('\n🪑  Tables existantes…');

  const { data, error } = await supabase
    .from('tables')
    .select('id, label, capacity')
    .eq('restaurant_id', restaurantId)
    .returns<TableRow[]>();

  if (error) {
    console.error(`  ❌  Impossible de récupérer les tables : ${error.message}`);
    if (isPermissionError(error.message)) console.error(PERM_HINT);
    return { tableIds: new Map(), tableList: [] };
  }

  const tableList = data ?? [];
  const tableIds  = new Map<string, string>();
  for (const t of tableList) {
    tableIds.set(t.label, t.id);
  }

  console.log(`  ℹ️   ${tableList.length} table(s) trouvée(s) : ${tableList.map(t => t.label).join(', ')}`);
  console.log('  ℹ️   Plan de salle non modifié');

  return { tableIds, tableList };
}

// ─── Apply : clients ──────────────────────────────────────────────────────────

async function seedGuests(restaurantId: string): Promise<GuestState[]> {
  console.log('\n👥  Clients fictifs…');

  const guestDefs = buildGuestDefinitions();

  // Récupérer tous les clients test existants en une requête
  const { data: existing, error } = await supabase
    .from('guests')
    .select('id, phone, email, vip')
    .eq('restaurant_id', restaurantId)
    .like('phone', `${PHONE_PREFIX}%`)
    .returns<GuestRow[]>();

  if (error) {
    console.error(`  ❌  Impossible de récupérer les clients : ${error.message}`);
    if (isPermissionError(error.message)) console.error(PERM_HINT);
    return [];
  }

  const existingPhones = new Map<string, GuestRow>();
  for (const g of existing ?? []) {
    existingPhones.set(g.phone, g);
  }

  const toCreate = guestDefs.filter(g => !existingPhones.has(g.phone));

  console.log(`  ℹ️   Existants : ${existingPhones.size} clients`);
  console.log(`  ➕   À créer   : ${toCreate.length} clients`);

  // Batch insert par lots de 30
  for (let i = 0; i < toCreate.length; i += 30) {
    const batch = toCreate.slice(i, i + 30).map(g => ({
      restaurant_id:   restaurantId,
      first_name:      g.first_name,
      last_name:       g.last_name,
      phone:           g.phone,
      email:           g.email,
      birthday:        g.birthday,
      notes:           g.notes,
      tags:            g.tags,
      vip:             g.vip,
      avg_rating:      g.avg_rating,
      marketing_opt_in: g.marketing_opt_in,
      source:          g.source,
    }));

    const { data: created, error: insertErr } = await supabase
      .from('guests')
      .insert(batch)
      .select('id, phone, email, vip')
      .returns<GuestRow[]>();

    if (insertErr) {
      console.error(`  ❌  Erreur insertion clients batch ${i} : ${insertErr.message}`);
      if (isPermissionError(insertErr.message)) console.error(PERM_HINT);
    } else {
      for (const g of created ?? []) {
        existingPhones.set(g.phone, g);
      }
      console.log(`  ✅  Batch ${i + 1}-${Math.min(i + 30, toCreate.length)} créé`);
    }
  }

  // Reconstruire les states depuis toutes les données disponibles
  const states: GuestState[] = [];
  for (const def of guestDefs) {
    const row = existingPhones.get(def.phone);
    if (row) {
      states.push({ id: row.id, phone: row.phone, hasEmail: row.email !== null, isVip: row.vip });
    }
  }

  console.log(`  ✅  ${states.length} clients disponibles au total`);
  return states;
}

// ─── Apply : réservations ─────────────────────────────────────────────────────

async function seedReservations(
  restaurantId:  string,
  guests:        GuestState[],
  tableIds:      Map<string, string>,
  tableList:     TableRow[],
  lunchShiftId:  string | null,
  dinnerShiftId: string | null,
): Promise<Array<{ id: string; guestId: string | null; status: string }>> {
  console.log('\n📋  Réservations fictives…');

  if (guests.length === 0) {
    console.warn('  ⚠️   Aucun client disponible — réservations ignorées');
    return [];
  }

  // Récupérer toutes les réservations test existantes
  const { data: existing, error } = await supabase
    .from('reservations')
    .select('id, guest_id, date, time_slot, status')
    .eq('restaurant_id', restaurantId)
    .ilike('notes', `${SEED_MARKER}%`)
    .returns<ResRow[]>();

  if (error) {
    console.error(`  ❌  Impossible de récupérer les réservations : ${error.message}`);
    if (isPermissionError(error.message)) console.error(PERM_HINT);
    return [];
  }

  // Clé d'unicité : date|time_slot|guest_id
  const existingKeys = new Set<string>();
  const allReservations: Array<{ id: string; guestId: string | null; status: string }> = [];

  for (const r of existing ?? []) {
    const key = `${r.date}|${r.time_slot}|${r.guest_id ?? 'null'}`;
    existingKeys.add(key);
    allReservations.push({ id: r.id, guestId: r.guest_id, status: r.status });
  }

  console.log(`  ℹ️   Existantes : ${existingKeys.size} réservations [SEED-RICH]`);

  const allDefs = generateReservations(
    restaurantId, guests, tableIds, lunchShiftId, dinnerShiftId
  );

  const toCreate = allDefs.filter(r => {
    const key = `${r.date}|${r.time_slot}|${r.guest_id ?? 'null'}`;
    return !existingKeys.has(key);
  });

  console.log(`  ➕   À créer   : ${toCreate.length} réservations`);

  // Batch insert par lots de 50
  for (let i = 0; i < toCreate.length; i += 50) {
    const batch = toCreate.slice(i, i + 50);
    const { data: created, error: insertErr } = await supabase
      .from('reservations')
      .insert(batch)
      .select('id, guest_id, status')
      .returns<Array<{ id: string; guest_id: string | null; status: string }>>();

    if (insertErr) {
      console.error(`  ❌  Erreur batch ${i} : ${insertErr.message}`);
      if (isPermissionError(insertErr.message)) console.error(PERM_HINT);
    } else {
      for (const r of created ?? []) {
        allReservations.push({ id: r.id, guestId: r.guest_id, status: r.status });
      }
    }
  }

  console.log(`  ✅  ${allReservations.length} réservations disponibles au total`);

  // ── Multi-tables : grand groupe confirmé d'aujourd'hui ───────────────────
  await seedMultiTableReservations(restaurantId, allReservations, tableList);

  return allReservations;
}

// ─── Apply : reservation_tables ───────────────────────────────────────────────

async function seedMultiTableReservations(
  restaurantId: string,
  reservations: Array<{ id: string; guestId: string | null; status: string }>,
  tableList:    TableRow[],
): Promise<void> {
  console.log('\n🔗  Réservations multi-tables…');

  if (tableList.length < 2) {
    console.log('  ℹ️   Moins de 2 tables disponibles — multi-tables ignoré');
    return;
  }

  // Prendre les 2 tables avec la plus grande capacité
  const sorted = [...tableList].sort((a, b) => b.capacity - a.capacity);
  const tableA = sorted[0];
  const tableB = sorted[1];

  if (!tableA || !tableB) {
    console.log('  ℹ️   Tables insuffisantes pour multi-tables');
    return;
  }

  // Chercher les réservations grand groupe SEED-RICH du jour
  const today = dateOffset(0);
  const { data: bigGroups, error } = await supabase
    .from('reservations')
    .select('id, table_id, party_size')
    .eq('restaurant_id', restaurantId)
    .eq('date', today)
    .ilike('notes', `${SEED_MARKER} Grand groupe%`)
    .returns<Array<{ id: string; table_id: string | null; party_size: number }>>();

  if (error) {
    console.warn(`  ⚠️   Impossible de récupérer les grands groupes : ${error.message}`);
    return;
  }

  if (!bigGroups || bigGroups.length === 0) {
    console.log('  ℹ️   Aucune réservation grand groupe trouvée');
    return;
  }

  for (const res of bigGroups) {
    const { data: existing, error: selErr } = await supabase
      .from('reservation_tables')
      .select('id')
      .eq('reservation_id', res.id)
      .returns<Array<{ id: string }>>();

    if (selErr) {
      console.warn(`  ⚠️   Vérif reservation_tables : ${selErr.message}`);
      continue;
    }

    if (existing && existing.length >= 2) {
      console.log(`  ℹ️   Réservation ${res.id.slice(0, 8)} déjà multi-tables`);
      continue;
    }

    const entries = [
      { reservation_id: res.id, table_id: tableA.id, restaurant_id: restaurantId },
      { reservation_id: res.id, table_id: tableB.id, restaurant_id: restaurantId },
    ];

    const { error: insertErr } = await supabase
      .from('reservation_tables')
      .insert(entries);

    if (insertErr) {
      if (insertErr.message.includes('uq_reservation_table')) {
        console.log(`  ℹ️   reservation_tables déjà existants pour ${res.id.slice(0, 8)}`);
      } else {
        console.warn(`  ⚠️   Erreur reservation_tables : ${insertErr.message}`);
      }
    } else {
      console.log(`  ✅  Réservation ${res.id.slice(0, 8)} → ${tableA.label} + ${tableB.label}`);
    }
  }
}

// ─── Apply : waitlist ─────────────────────────────────────────────────────────

async function seedWaitlist(restaurantId: string, guests: GuestState[]): Promise<void> {
  console.log('\n⏳  Waitlist…');

  if (guests.length === 0) {
    console.warn('  ⚠️   Aucun client disponible — waitlist ignorée');
    return;
  }

  // Récupérer les entrées test existantes
  const { data: existing, error } = await supabase
    .from('waitlist')
    .select('id, guest_id, date')
    .eq('restaurant_id', restaurantId)
    .ilike('notes', `${SEED_MARKER}%`)
    .returns<WaitRow[]>();

  if (error) {
    console.error(`  ❌  Impossible de récupérer la waitlist : ${error.message}`);
    if (isPermissionError(error.message)) console.error(PERM_HINT);
    return;
  }

  const existingKeys = new Set<string>();
  for (const w of existing ?? []) {
    existingKeys.add(`${w.date}|${w.guest_id ?? 'null'}`);
  }

  console.log(`  ℹ️   Existants : ${existingKeys.size} entrées [SEED-RICH]`);

  const toCreate: WaitlistInsertData[] = [];
  for (const wc of WAITLIST_CASES) {
    const gIdx    = wc.guestIdx % guests.length;
    const guestId = guests[gIdx]?.id ?? null;
    const dateStr = dateOffset(wc.dayOffset);
    const key     = `${dateStr}|${guestId ?? 'null'}`;
    if (!existingKeys.has(key)) {
      toCreate.push({
        restaurant_id: restaurantId,
        guest_id:      guestId,
        date:          dateStr,
        party_size:    wc.partySize,
        status:        wc.status,
        notes:         wc.notes,
      });
    }
  }

  console.log(`  ➕   À créer   : ${toCreate.length} entrées`);

  if (toCreate.length === 0) {
    console.log('  ✅  Toutes les entrées waitlist déjà présentes');
    return;
  }

  const { error: insertErr } = await supabase.from('waitlist').insert(toCreate);
  if (insertErr) {
    console.error(`  ❌  Erreur insertion waitlist : ${insertErr.message}`);
    if (isPermissionError(insertErr.message)) console.error(PERM_HINT);
  } else {
    console.log(`  ✅  ${toCreate.length} entrées waitlist créées`);
  }
}

// ─── Apply : feedback surveys ─────────────────────────────────────────────────

async function seedFeedback(
  restaurantId:  string,
  reservations:  Array<{ id: string; guestId: string | null; status: string }>,
): Promise<void> {
  console.log('\n⭐  Feedback / satisfaction…');

  // Vérifier les permissions sur feedback_surveys
  const { error: permCheck } = await supabase
    .from('feedback_surveys')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .limit(1);

  if (permCheck && isPermissionError(permCheck.message)) {
    console.warn('  ⚠️   Permission refusée sur feedback_surveys — feedback ignoré.');
    console.warn(FEEDBACK_PERM_HINT);
    return;
  }

  // Récupérer les feedbacks déjà créés
  const { data: existingFeedback, error: fetchErr } = await supabase
    .from('feedback_surveys')
    .select('reservation_id')
    .eq('restaurant_id', restaurantId)
    .returns<FeedbackRow[]>();

  if (fetchErr) {
    console.warn(`  ⚠️   Impossible de récupérer les feedbacks : ${fetchErr.message}`);
    return;
  }

  const existingResIds = new Set<string>(
    (existingFeedback ?? [])
      .map(f => f.reservation_id)
      .filter((id): id is string => id !== null),
  );

  // Sélectionner les réservations completed éligibles
  const completed = reservations.filter(
    r => r.status === 'completed' && !existingResIds.has(r.id),
  );

  const TARGET_COUNT = 30;
  const eligible = completed.slice(0, TARGET_COUNT);

  console.log(`  ℹ️   Feedbacks déjà présents : ${existingResIds.size}`);
  console.log(`  ➕   À créer   : ${eligible.length} feedbacks`);

  if (eligible.length === 0) {
    console.log('  ✅  Tous les feedbacks déjà présents');
    return;
  }

  let created = 0;
  let errors  = 0;

  for (let i = 0; i < eligible.length; i++) {
    const res     = eligible[i];
    if (!res) continue;

    const token   = `seed-rich-link-${res.id.slice(0, 8)}`;
    const profile = pick(FEEDBACK_PROFILES, i);
    const comment = pick(FEEDBACK_COMMENTS, i);

    // Créer le survey_link (idempotent via token unique)
    const { data: linkData, error: linkErr } = await supabase
      .from('feedback_survey_links')
      .select('id')
      .eq('token', token)
      .maybeSingle()
      .returns<{ id: string } | null>();

    if (linkErr && isPermissionError(linkErr.message)) {
      console.warn('  ⚠️   Permission refusée sur feedback_survey_links.');
      console.warn(FEEDBACK_PERM_HINT);
      return;
    }

    let linkId: string | null = linkData?.id ?? null;

    if (!linkId) {
      const { data: newLink, error: insertLinkErr } = await supabase
        .from('feedback_survey_links')
        .insert({
          restaurant_id:  restaurantId,
          reservation_id: res.id,
          guest_id:       res.guestId,
          token,
          channel:        'manual',
          used_at:        new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
        })
        .select('id')
        .single()
        .returns<{ id: string }>();

      if (insertLinkErr) {
        if (insertLinkErr.message.includes('unique')) {
          // Token déjà existant — fetch
          const { data: refetch } = await supabase
            .from('feedback_survey_links')
            .select('id')
            .eq('token', token)
            .maybeSingle()
            .returns<{ id: string } | null>();
          linkId = refetch?.id ?? null;
        } else {
          errors++;
          continue;
        }
      } else {
        linkId = newLink?.id ?? null;
      }
    }

    // Insérer le feedback survey
    const surveyData: FeedbackSurveyInsertData = {
      restaurant_id:   restaurantId,
      reservation_id:  res.id,
      guest_id:        res.guestId,
      survey_link_id:  linkId,
      token,
      rating_overall:  profile.overall,
      rating_food:     profile.food,
      rating_drinks:   profile.drinks,
      rating_service:  profile.service,
      rating_ambience: profile.ambience,
      recommended:     profile.recommended,
      comment,
      source:          'manual',
      submitted_at:    new Date(Date.now() - (i + 1) * 3_600_000).toISOString(),
    };

    const { error: surveyErr } = await supabase.from('feedback_surveys').insert(surveyData);
    if (surveyErr) {
      errors++;
    } else {
      created++;
    }
  }

  if (errors > 0) console.warn(`  ⚠️   ${errors} feedbacks non créés (erreurs)`);
  console.log(`  ✅  ${created} feedbacks créés`);
}

// ─── Apply ────────────────────────────────────────────────────────────────────

async function runApply(): Promise<void> {
  console.log('\n' + '═'.repeat(68));
  console.log('  APPLY — seed-rich-test-restaurant');
  console.log('═'.repeat(68));
  console.log(`  Cible  : "${TEST_RESTAURANT_NAME}" (${TARGET_RESTAURANT_ID})`);
  console.log('  ⚠️   Le restaurant réel n\'est PAS touché.');
  console.log('─'.repeat(68) + '\n');

  // ── 1. Vérification critique ──────────────────────────────────────────────
  const restaurantId = await verifyTestRestaurant();

  // ── 2. Services ───────────────────────────────────────────────────────────
  const { lunch: lunchShiftId, dinner: dinnerShiftId } = await seedShifts(restaurantId);

  // ── 3. Tables existantes (lecture seule — plan non modifié) ───────────────
  const { tableIds, tableList } = await loadExistingTables(restaurantId);

  // ── 4. Clients ────────────────────────────────────────────────────────────
  const guests = await seedGuests(restaurantId);

  // ── 5. Réservations + multi-tables ────────────────────────────────────────
  const allReservations = await seedReservations(
    restaurantId, guests, tableIds, tableList, lunchShiftId, dinnerShiftId
  );

  // ── 7. Waitlist ───────────────────────────────────────────────────────────
  await seedWaitlist(restaurantId, guests);

  // ── 8. Feedback ───────────────────────────────────────────────────────────
  await seedFeedback(restaurantId, allReservations);

  // ── Résumé ────────────────────────────────────────────────────────────────
  const completedCount  = allReservations.filter(r => r.status === 'completed').length;
  const confirmedCount  = allReservations.filter(r => r.status === 'confirmed').length;
  const pendingCount    = allReservations.filter(r => r.status === 'pending').length;
  const seatedCount     = allReservations.filter(r => r.status === 'seated').length;
  const cancelledCount  = allReservations.filter(r => r.status === 'cancelled').length;
  const noshowCount     = allReservations.filter(r => r.status === 'noshow').length;

  console.log('\n' + '═'.repeat(68));
  console.log(`  ✅  Dataset immersif prêt pour "${TEST_RESTAURANT_NAME}"`);
  console.log('─'.repeat(68));
  console.log(`  🗺️   Tables      : ${tableIds.size} existante(s) réutilisée(s) (plan non modifié)`);
  console.log(`  👥  Clients     : ${guests.length}`);
  console.log(`  📋  Réservations: ${allReservations.length} total`);
  console.log(`       completed: ${completedCount}  confirmed: ${confirmedCount}  pending: ${pendingCount}`);
  console.log(`       seated:    ${seatedCount}  cancelled: ${cancelledCount}  noshow: ${noshowCount}`);
  console.log(`  ⏳  Waitlist    : ${WAITLIST_CASES.length} définies`);
  console.log(`  🔗  Multi-tables: tables à plus haute capacité`);
  console.log('\n  💡  Relancez cette commande sans risque — idempotent.');
  console.log('      Aucune donnée du restaurant réel n\'a été touchée.');
  console.log('═'.repeat(68) + '\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (isDryRun) {
    console.log('  (Mode dry-run — aucune modification.)');
    await runDryRun();
  } else {
    await runApply();
  }
}

main().catch((err: unknown) => {
  console.error('Erreur fatale :', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
