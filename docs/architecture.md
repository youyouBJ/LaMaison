# Architecture — La Maison

## Vue d'ensemble

```
┌─────────────────────────────────────────────┐
│              Expo (React Native)            │
│                                             │
│  AuthStack          MainTabs                │
│  └─ LoginScreen     ├─ DashboardScreen      │
│                     ├─ ReservationsStack    │
│                     │  ├─ ReservationList   │
│                     │  ├─ NewReservation    │
│                     │  ├─ ReservationDetail │
│                     │  └─ Waitlist          │
│                     ├─ GuestsStack          │
│                     │  ├─ GuestList         │
│                     │  └─ GuestDetail       │
│                     ├─ FloorPlanScreen      │
│                     └─ SettingsScreen       │
└────────────────────┬────────────────────────┘
                     │ supabase-js
┌────────────────────▼────────────────────────┐
│                  Supabase                   │
│  Auth + PostgreSQL + RLS + Realtime         │
└─────────────────────────────────────────────┘
```

---

## Navigation

| Navigateur | Fichier | Rôle |
|---|---|---|
| `RootNavigator` | `navigation/RootNavigator.tsx` | Bascule AuthStack ↔ MainTabs selon session |
| `AuthNavigator` | `navigation/AuthNavigator.tsx` | Stack : LoginScreen |
| `MainTabs` | `navigation/MainTabs.tsx` | Bottom tabs : Dashboard, Reservations, Guests, Floor, Settings |
| `ReservationsNavigator` | `navigation/ReservationsNavigator.tsx` | Stack : List, New, Detail, Waitlist |
| `GuestsNavigator` | `navigation/GuestsNavigator.tsx` | Stack : List, Detail |

---

## Flow Auth

1. L'app démarre → `RootNavigator` vérifie `supabase.auth.getSession()`
2. Si session valide → `MainTabs`
3. Sinon → `AuthStack` (LoginScreen)
4. Login réussi → Supabase émet un événement `SIGNED_IN` → navigation automatique vers `MainTabs`
5. Logout → événement `SIGNED_OUT` → retour `AuthStack`

Toutes les données sont filtrées par `restaurant_id` via RLS — un utilisateur ne peut voir que son restaurant.

---

## Flow Réservations

1. `ReservationListScreen` → `useReservations` → fetch `reservations` + enrichissement `reservation_tables`
2. Création → `NewReservationScreen` → `useCreateReservation`
   - Optionnel : recherche/création guest
   - Sélection table(s)
   - Sélection créneau
   - INSERT `reservations` + INSERT `reservation_tables` (si multi-tables)
3. Détail → `ReservationDetailScreen` → `useReservationDetail`
   - Changement statut → UPDATE `reservations.status`
4. Realtime : channel `reservations-list` → refetch automatique sur INSERT/UPDATE/DELETE

### Multi-tables

- `reservations.table_id` = table principale (toujours renseignée)
- `reservation_tables` = table de jointure N:N (migration 002)
- Les deux sont écrits à la création
- `formatReservationTables()` dans `src/utils/reservationTables.ts` agrège l'affichage

### Walk-in

- `guest_id = null`, `source = 'walkin'`
- Depuis l'onglet réservations : statut initial `confirmed`
- Depuis le plan de salle : statut initial `seated`

---

## Flow CRM Clients

1. `GuestListScreen` → `useGuests` → fetch `guests` avec pagination et filtres
2. Recherche : `ilike` sur `phone`, `first_name`, `last_name`, `email`
3. `GuestDetailScreen` → `useGuestDetail` → fetch guest + historique réservations
4. Modification : UPDATE `guests` (notes, VIP, tags)

Import initial : script local `scripts/import-sevenrooms-guests.ts` avec `service_role` key.

---

## Flow Plan de salle

1. `FloorPlanScreen` → `useFloorPlan`
   - Fetch `tables` (statuts live)
   - Fetch `reservations` du jour (pour afficher nom + tables liées)
   - Realtime : channel `floor-plan` sur `tables` et `reservations`
2. Layout statique dans `src/utils/floorPlanLayout.ts` (coordonnées % canvas)
3. `FloorCanvas` → rendu SVG-like avec zones, séparateurs, comptoirs
4. `FloorTable` → table cliquable avec statut coloré
5. Tap sur table → modal d'action (selon statut)
   - Libre → créer réservation / walk-in
   - Réservée → confirmer / no-show / annuler
   - Installée → terminer / no-show
6. Seed : `npm run seed:floor` (script `scripts/seed-floor-plan.ts`)

---

## Flow Import SevenRooms

Script local uniquement. Ne jamais déclencher depuis l'app mobile.

1. Lire `data/sevenrooms-guests.csv`
2. Détecter le séparateur (`,` ou `;`)
3. Parser chaque ligne → mapping vers schema `guests`
4. Charger les guests existants (par téléphone et email normalisés)
5. Dry-run : afficher résumé sans écrire
6. `--apply` : INSERT (nouveau) ou UPDATE (existant via téléphone/email)

---

## Flow Waitlist

1. `WaitlistScreen` → `useWaitlist`
   - Fetch `waitlist` + `guests` + `shifts` pour la date sélectionnée
   - Filtre côté client par service (déjeuner/dîner)
   - Realtime : channel `waitlist-list`
2. Ajout d'entrée : `CreateWaitlistEntryForm`
   - Recherche client existant ou création à la volée ou walk-in
   - INSERT `waitlist`
3. Actions :
   - Notifier → `status = 'notified'`
   - Installer → `status = 'seated'`
   - Parti → `status = 'left'`
   - Convertir en réservation → INSERT `reservations` + UPDATE `waitlist.status = 'seated'`

---

## Responsabilités des hooks

| Hook | Écran(s) | Responsabilité principale |
|---|---|---|
| `useReservations` | ReservationListScreen | Liste + filtres + realtime |
| `useCreateReservation` | NewReservationScreen | Création reservation + reservation_tables |
| `useReservationDetail` | ReservationDetailScreen | Détail + changement statut |
| `useGuests` | GuestListScreen | Liste + recherche + filtres |
| `useGuestDetail` | GuestDetailScreen | Fiche client + historique |
| `useFloorPlan` | FloorPlanScreen | Tables live + reservations du jour + actions service |
| `useTodayDashboard` | DashboardScreen | Stats du jour |
| `useWaitlist` | WaitlistScreen | Waitlist + actions + conversion |

Chaque hook gère : fetch initial, realtime (si applicable), état de chargement/erreur, et actions métier.

---

## Gestion Realtime

Supabase Realtime via `postgres_changes` :

| Channel | Table surveillée | Filtre | Utilisé dans |
|---|---|---|---|
| `reservations-list` | `reservations` | `restaurant_id=eq.{id}` | `useReservations` |
| `reservation-detail-{id}` | `reservations` | `id=eq.{id}` | `useReservationDetail` |
| `floor-plan` | `tables`, `reservations` | `restaurant_id=eq.{id}` | `useFloorPlan` |
| `waitlist-list` | `waitlist` | `restaurant_id=eq.{id}` | `useWaitlist` |

Pattern : le callback ne reçoit pas les nouvelles données — il déclenche un refetch complet. Cela garantit la cohérence avec les joins (guests, shifts, reservation_tables).

Les channels sont nettoyés au démontage du composant (`supabase.removeChannel`).
