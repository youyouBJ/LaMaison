# Rappels du jour — V1

## Vue d'ensemble

Section "Rappels du jour" affichée sur l'écran d'Accueil (Dashboard), entre "Vue d'ensemble" et "Prochaines arrivées". Permet au staff de ne rien manquer pendant le service sans notifications push iOS.

**Pas de push notifications en V1.** Les rappels sont calculés localement à partir des données déjà chargées (réservations du jour) + une requête légère sur la waitlist. Cette implémentation est intentionnellement "in-app only" : aucune configuration APNs, aucun token de notification, aucun package natif supplémentaire.

---

## Types de rappels

| Type | Priorité | Déclencheur |
|---|---|---|
| `pending_confirmation` | **Urgent** | Réservation `status = pending` aujourd'hui |
| `to_call` | À faire | Réservation `confirmed` + téléphone non appelé (tag `[Appel confirmation]` absent) |
| `arriving_soon` | Info | Réservation `confirmed` arrivant dans les 60 prochaines minutes |
| `waitlist_waiting` | **Urgent** | Entrée waitlist `status = waiting` aujourd'hui |
| `survey_to_send` | À faire | Réservation `completed` avec téléphone ou email |
| `noshow_today` | Info | Groupe : total no-shows du jour |
| `cancelled_today` | Info | Groupe : total annulations du jour |

### Priorités visuelles

- **Urgent** : fond rouge clair, label "Urgent" — rouge `#8B1A1A`
- **À faire** : fond doré clair, label "À faire" — or `#B8973A`
- **Info** : fond beige, label "Info" — muted `#C4A882`

---

## Architecture

### Hook : `src/hooks/useTodayReminders.ts`

```ts
useTodayReminders(
  reservations: DashboardReservation[],  // depuis useTodayDashboard
  restaurantId: string | null,
) → { loading, error, reminders, urgentCount, refresh }
```

- **Réservations** : reçues en prop depuis le Dashboard (évite un double fetch).
- **Waitlist** : chargée indépendamment (requête filtrée `status = waiting`, aujourd'hui uniquement).
- **Calcul** : `useMemo` sur `[reservations, waitlistEntries]` → `Reminder[]` triés par priorité.

### Composant : `src/components/RemindersSection.tsx`

- Accepte `reminders`, `urgentCount`, `loading`, `error`, `onRefresh`.
- Chaque carte : chip heure + titre + badge priorité + description + action rapide.
- Action **WhatsApp** visible sur les rappels `pending_confirmation` et `to_call` si `guestPhone` présent.
- Navigation via `CommonActions.navigate` (tab → stack imbriqué, sans modification des types de navigation).

### Intégration : `src/screens/dashboard/DashboardScreen.tsx`

- `useTodayReminders` appelé avec `reservations` et `restaurantId` issus de `useTodayDashboard`.
- `handleRefresh` déclenche aussi `remindersRefresh`.
- Section insérée entre "Vue d'ensemble" et "Prochaines arrivées".

---

## Actions rapides disponibles

| Action | Comportement |
|---|---|
| `open_reservation` | Navigue vers `ReservationDetail` dans le stack Réservations |
| `open_waitlist` | Navigue vers `Waitlist` dans le stack Réservations |
| `whatsapp_confirmation` | Ouvre WhatsApp natif avec un message de confirmation générique |

---

## Rappel enquête satisfaction (`survey_to_send`)

**Déclencheur** : réservation `completed` du jour, avec téléphone **ou** email.  
**Titre** : `"Envoyer enquête de satisfaction"`  
**Description** : `"Nom Prénom — X couvert(s) à HH:MM"`  
**Action** : `"Ouvrir pour envoyer"` → navigue vers `ReservationDetail`, où les boutons WhatsApp enquête et email enquête sont déjà disponibles.

**Pourquoi pas de bouton WhatsApp direct dans la carte rappel ?**  
Le lien d'enquête satisfaction est unique par réservation (token 32 chars dans `feedback_survey_links`). Construire l'URL nécessite un appel asynchrone à Supabase pour obtenir ou générer le token — incompatible avec un calcul synchrone dans `useMemo`. En V1, le staff ouvre le détail réservation pour envoyer l'enquête.

**Limite V1 — doublons** : le rappel s'affiche pour toutes les réservations `completed` avec contact, sans vérifier si un lien d'enquête a déjà été envoyé. Cela peut générer des rappels redondants si l'enquête a déjà été envoyée dans la session. La vérification via `feedback_survey_links` est planifiée en V2.

---

## Limites V1

- **In-app uniquement** : les rappels n'apparaissent que si le staff est sur l'écran d'Accueil. Aucune notification visible quand l'app est en arrière-plan ou fermée.
- **Pas de Realtime** sur la waitlist dans ce hook (le Dashboard réagit via son propre Realtime sur `reservations` ; la waitlist se met à jour au refresh manuel).
- **`survey_to_send`** : ne vérifie pas si un lien d'enquête a déjà été généré (`feedback_survey_links`). Le staff peut envoyer depuis la fiche réservation.
- **Temps "arrivée prochaine"** calculé au moment du chargement, pas en temps réel.
- Les rappels disparaissent dès que le staff actualise et que les statuts ont changé.

---

## V2 — Notifications push iOS/iPad

> **Ne pas implémenter avant le go-live.** Prérequis : app TestFlight ou App Store, compte Apple Developer, certificat APNs.

### Ce qui est prévu

**Package natif**  
- `expo-notifications` (Bare workflow) ou solution équivalente  
- Demande de permission iOS au premier lancement (`requestPermissionsAsync`)

**Infrastructure base de données**  
- Table `device_tokens` : `user_id`, `device_token`, `platform` (ios/android), `created_at`, `revoked_at`  
- RLS : chaque utilisateur accède uniquement à ses propres tokens

**Stockage du token**  
- À la connexion : enregistrement du push token Expo dans `device_tokens`  
- À la déconnexion : révocation du token (soft delete)

**Notifications à envoyer**

| Événement | Timing | Destinataire |
|---|---|---|
| Nouvelle réservation créée | Immédiat | Staff (rôle `admin` ou `staff`) |
| Réservation à confirmer | Immédiat (status `pending`) | Staff |
| Réservation modifiée / annulée | Immédiat | Staff |
| Client en liste d'attente | Immédiat | Staff |
| Arrivée prochaine (< 30 min) | Envoi programmé | Staff |
| Enquête satisfaction à envoyer | T+30 min après `completed` | Staff |
| Rappel client J-1 | Scheduled la veille | Optionnel (V3) |

**Envoi depuis Supabase**  
- Edge Function `send-push-notification` : reçoit `{ type, reservationId? }`, récupère les tokens, envoie via l'API Expo Push (`https://exp.host/--/api/v2/push/send`)  
- Triggered via Supabase Database Webhooks (`reservations` INSERT/UPDATE, `waitlist` INSERT)  
- Ou Scheduled job (pg_cron) pour les rappels programmés

**Préférences par rôle**  
- Table `notification_preferences` : `user_id`, `type`, `enabled`  
- Permet à chaque staff de désactiver certains types de notification  
- Désactivation par appareil possible (révocation du token)

**Anti-spam**  
- Déduplications : pas deux push pour la même réservation dans la même minute  
- Silence nocturne : aucune notification entre 23h et 7h (timezone restaurant)

### Limites connues à anticiper

- APNs requiert un certificat valide → build Expo EAS obligatoire (pas Expo Go)
- Les tokens Expo expirent — prévoir un refresh périodique
- L'API Expo Push est gratuite jusqu'à un certain volume ; au-delà, envisager APNs direct
- Ne pas envoyer de données sensibles dans le payload push (afficher seulement le type d'alerte)
