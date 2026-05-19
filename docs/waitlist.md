# Waitlist — La Maison

Module de liste d'attente. Entièrement livré et fonctionnel.

---

## Fonctionnalités

- Liste des entrées d'attente par date
- Filtre Déjeuner / Dîner / Tous (basé sur le shift ou l'heure)
- Sélecteur de date
- Ajout d'une entrée (client existant, nouveau client, ou walk-in)
- Statuts : `waiting` → `notified` → `seated` / `left`
- Conversion d'une entrée waitlist en réservation
- Recherche de client existant lors de l'ajout
- Synchronisation Realtime (channel `waitlist-list`)

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/screens/reservations/WaitlistScreen.tsx` | Écran principal |
| `src/hooks/useWaitlist.ts` | Logique : fetch, actions, realtime, conversion |
| `src/components/CreateWaitlistEntryForm.tsx` | Formulaire d'ajout d'entrée |
| `src/utils/waitlistStatus.ts` | Labels et couleurs des statuts |
| `src/types/waitlist.ts` | Types TypeScript du module |
| `supabase/migrations/003_waitlist_shift_time.sql` | Colonnes `shift_id` et `time_slot` |

---

## Table `waitlist`

Voir [docs/database.md](database.md) pour le schéma complet.

Colonnes clés :
- `guest_id` : nullable — `null` si walk-in
- `shift_id` : nullable — lié au service (Déjeuner/Dîner)
- `time_slot` : nullable — créneau souhaité
- `status` : `waiting` | `notified` | `seated` | `left`

---

## Flux d'utilisation

### Ajouter une entrée

1. Bouton "+" → `CreateWaitlistEntryForm`
2. Rechercher un client existant (min 2 caractères) ou créer un nouveau ou cocher "Walk-in"
3. Saisir le nombre de couverts, le service, un créneau optionnel, des notes
4. Valider → INSERT dans `waitlist`

### Actions sur une entrée

| Action | Résultat |
|---|---|
| Notifier | `status = 'notified'` |
| Installer | `status = 'seated'` |
| Parti | `status = 'left'` |
| Convertir en réservation confirmée | INSERT dans `reservations` (`status = 'confirmed'`), waitlist `status = 'seated'` |
| Convertir en réservation installée | INSERT dans `reservations` (`status = 'seated'`), waitlist `status = 'seated'` |

### Correction de statut

Le changement de statut est possible à tout moment, y compris depuis les états terminaux (`seated`, `left`). Cela permet de corriger une erreur sans supprimer l'entrée.

### Conversion en réservation

Le hook `convertToReservation` :
1. Récupère l'entrée waitlist (date, party_size, guest_id, shift_id, time_slot)
2. Détermine le `time_slot` (depuis l'entrée, ou depuis le shift, ou fallback `19:00`)
3. Crée la réservation avec `status = 'seated'`
4. Met à jour l'entrée waitlist : `status = 'seated'`
5. Retourne l'ID de la nouvelle réservation (pour navigation future vers le détail)

---

## Filtre service

Côté client (pas de requête SQL supplémentaire) :

- Si le shift a un nom → chercher "déjeuner/lunch/midi" ou "dîner/dinner/soir"
- Sinon → utiliser le `time_slot` : `12h–16h` = déjeuner, `≥17h` = dîner

---

## Walk-in

- `guest_id = null` dans `waitlist`
- À la conversion en réservation : `source = 'walkin'`
- Affiché comme "Client de passage" dans les listes

---

## Realtime

Channel `waitlist-list` écoute tous les events sur `waitlist` filtrés par `restaurant_id`. Tout changement (depuis un autre device ou depuis le Dashboard) est reflété instantanément.

---

## Badge de notification (Planning)

Le bouton Attente dans l'onglet Réservations affiche un badge avec le nombre d'entrées dont le statut est `waiting` pour la date sélectionnée. Ce compteur est mis à jour en temps réel via le hook `useWaitlist`.

---

## Navigation

La Waitlist est accessible depuis l'onglet **Réservations** → bouton dédié ou via `ReservationsNavigator` (route `Waitlist`).

Prochaine étape (P0) : après conversion en réservation, naviguer directement vers le `ReservationDetailScreen` de la réservation créée.
