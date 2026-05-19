# Réservations — Architecture

## Modèle de données

### Table principale `reservations`

Chaque réservation appartient à un restaurant, un shift, une table principale, et optionnellement un guest.

| Colonne | Type | Notes |
|---|---|---|
| `table_id` | uuid nullable | Table principale (toujours renseignée sauf walk-in sans table) |
| `guest_id` | uuid nullable | `null` si walk-in |
| `shift_id` | uuid nullable | Lié au service (Déjeuner/Dîner) |
| `status` | text | `confirmed`, `seated`, `completed`, `no_show`, `cancelled` |
| `source` | text | `walkin`, `phone`, `manual`, `online` |

### Multi-tables

Une réservation peut couvrir plusieurs tables :

- `reservations.table_id` — table principale (toujours renseignée, conservée pour compatibilité)
- `reservation_tables` — table de jointure N:N — toutes les tables liées (migration 002)

Les deux champs sont écrits simultanément à la création.

`formatReservationTables(primaryTable, reservationTables?)` dans `src/utils/reservationTables.ts` :
- Si `reservationTables` contient des entrées → "Tables T1, T2"
- Si uniquement la table principale → "Table T1"
- Sinon → "Table non assignée"

---

## Statuts de réservation

| Statut | Signification |
|---|---|
| `pending` | Réservation créée, non encore confirmée |
| `confirmed` | Réservation confirmée (par staff ou par téléphone) |
| `seated` | Client installé à table |
| `completed` | Service terminé |
| `noshow` | Client ne s'est pas présenté |
| `cancelled` | Réservation annulée |

### Correction de statut

Le changement de statut est possible **à tout moment**, y compris depuis les états terminaux (`completed`, `noshow`, `cancelled`). Cela permet de corriger une erreur de saisie sans avoir à supprimer et recréer la réservation.

---

## Points d'entrée de création

| Point d'entrée | Fichier | Statut par défaut | Walk-in possible |
|---|---|---|---|
| Onglet Réservations | `NewReservationScreen.tsx` | `confirmed` | Oui |
| Tap sur table (plan) | `CreateReservationForTableForm.tsx` | `confirmed` | Oui (→ `seated`) |

### Walk-in

Un walk-in est une réservation sans fiche client :
- `guest_id = null`
- `source = 'walkin'`
- Affiché comme "Client de passage" dans toutes les listes
- Depuis l'onglet réservations : statut initial `confirmed`
- Depuis le plan de salle : statut initial `seated`

Pour créer un walk-in : `isWalkIn: true` dans `CreateReservationInput` — la création de guest est ignorée.

---

## Confirmation téléphonique

Rappel visuel pour que le staff pense à appeler les clients le jour de leur réservation. Aucune table ni migration : la trace est stockée dans `reservations.notes`.

### Helper `reservationNeedsPhoneConfirmation(r)`

Fichier : `src/utils/reservationConfirmation.ts`

Retourne `true` si toutes ces conditions sont réunies :
- `r.date` = aujourd'hui (timezone Africa/Tunis)
- `r.status` = `pending` ou `confirmed`
- `r.guests.phone` existe
- `r.notes` ne contient pas la balise `[Appel confirmation]`

### Badge "À appeler"

Affiché dans `ReservationCard` (bordeaux `ctaLight`/`cta`) lorsque `reservationNeedsPhoneConfirmation` est vrai. Disparaît dès qu'un appel a été tracé dans les notes.

### Bouton "Appeler"

Visible dans `ReservationCard` si le guest a un téléphone. Ouvre `Linking.openURL('tel:…')` — aucune librairie externe.

### Bouton "Confirmé par téléphone"

Section dédiée dans `ReservationDetailScreen`, visible si `reservationNeedsPhoneConfirmation` est vrai.

Comportement (`confirmByPhone` dans `useReservationDetail`) :
- Si `status === 'pending'` → passe à `confirmed`
- Sinon → statut inchangé
- Ajoute en fin de notes : `[Appel confirmation] Client confirmé par téléphone le DD/MM à HH:MM.`
- Timestamp en heure de Tunis (Africa/Tunis)
- Les notes existantes ne sont pas écrasées

### KPI Dashboard

`DashboardScreen` calcule `toCallCount` depuis `reservations` (déjà chargées) et affiche un `StatCard` "À appeler aujourd'hui" lorsque ce compteur est supérieur à zéro.

---

## Hooks

| Hook | Responsabilité |
|---|---|
| `useCreateReservation` | Création réservation + insertion dans `reservation_tables` |
| `useReservations` | Liste + enrichissement via `reservation_tables` |
| `useReservationDetail` | Détail + enrichissement + changement statut + `confirmByPhone` |
| `useFloorPlan` | Vue plan + mapping tables secondaires via `reservation_tables` |
| `useTodayDashboard` | Stats du jour + enrichissement via `reservation_tables` |

---

## Migration

Appliquer dans l'ordre dans le SQL Editor Supabase :

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_reservation_tables.sql` — ajoute `reservation_tables`
3. `supabase/migrations/003_waitlist_shift_time.sql` — `shift_id` + `time_slot` sur `waitlist`

Après migration, régénérer les types TypeScript :

```bash
npx supabase gen types typescript \
  --project-id nosflczsevtrxnyienyn \
  --schema public \
  > src/types/database.ts
npx tsc --noEmit
```

---

## Realtime

Le hook `useReservations` écoute le channel `reservations-list` sur la table `reservations` (filtré par `restaurant_id`). Tout INSERT/UPDATE/DELETE déclenche un refetch complet — cela garantit la cohérence avec les joins (`guests`, `shifts`, `reservation_tables`).
