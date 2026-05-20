# Backlog — La Maison

Dernière mise à jour : 2026-05-20

---

## P0 — Livré (stable en production)

### Infrastructure
- [x] Supabase schema complet (001_initial_schema.sql)
- [x] RLS multi-tenant par `restaurant_id`
- [x] Realtime activé : `reservations`, `tables`, `waitlist`
- [x] Types TypeScript générés depuis Supabase (`src/types/database.ts`)
- [x] Design system (`src/theme/index.ts`)

### Auth
- [x] Connexion email/mot de passe
- [x] Session persistante (AsyncStorage)
- [x] Redirection automatique auth ↔ app

### Accueil (Dashboard — service du jour)
- [x] Vue du jour : couverts actifs, confirmées, à table, en attente, terminées
- [x] Hook `useTodayDashboard` avec realtime subscription
- [x] KPI "À appeler aujourd'hui" (réservations du jour avec téléphone, statut pending/confirmed, non encore contactées)
- [x] Waitlist en attente du jour via `useDashboardExtended`
- [x] Liste "Prochaines arrivées" (max 8, triées par créneau)
- [x] Actions rapides (Réservations, Plan, Attente, Clients)

### Admin (pilotage avancé)
- [x] Sélecteur de période : Aujourd'hui / 7 jours / 30 jours / Mois / Année
- [x] KPIs réservations par période via `usePeriodStats`
- [x] Répartition services (déjeuner / dîner) par période
- [x] Répartition statuts par période avec taux annulation / no-show
- [x] Satisfaction client unifiée : SevenRooms (`avg_rating > 0`) + enquêtes in-app par période
- [x] Bug `avg_rating = 0` corrigé : les valeurs nulles et zéro sont exclues de la moyenne

### Enquête satisfaction
- [x] Token public 32 char par réservation (`feedback_survey_links`)
- [x] Idempotent (même réservation = même lien)
- [x] Envoi WhatsApp / email (manuel V1)
- [x] Formulaire Vercel (`https://lamaison-feedback.vercel.app/feedback`)
- [x] Table `feedback_surveys` : notes 5 dimensions + recommandation + commentaire
- [x] Types TypeScript `feedback_surveys` dans `src/types/database.ts`

### Réservations
- [x] Liste par date
- [x] Filtre Déjeuner / Dîner / Tous
- [x] Recherche
- [x] Sélecteur calendrier interactif
- [x] Sélecteur d'heure par créneaux
- [x] Création réservation (client existant ou nouveau)
- [x] Client VIP à la création
- [x] Walk-in / client de passage (sans fiche client)
- [x] Multi-tables (`reservation_tables`, migration 002)
- [x] Détail réservation
- [x] Changement de statut
- [x] Correction de statut flexible (y compris depuis terminé / annulé / no-show)
- [x] Badge "À appeler" sur les réservations du jour en attente de confirmation téléphonique
- [x] Bouton "Appeler" : `tel:` link natif depuis la card de liste
- [x] Bouton "Confirmé par téléphone" : confirme le statut + trace horodatée dans `notes`

### CRM Clients
- [x] Liste 22 000+ clients
- [x] Recherche multi-critères (nom, téléphone, email)
- [x] Filtres et tris
- [x] Fiche client (notes, VIP, tags, historique)
- [x] Tags nettoyés

### Import SevenRooms
- [x] Script local `npm run import:sevenrooms`
- [x] Dry-run par défaut
- [x] Détection auto séparateur CSV (`,` ou `;`)
- [x] Dédoublonnage téléphone/email
- [x] Idempotent (relancer = mise à jour propre)
- [x] Import de 22 671 clients

### Plan de salle
- [x] Plan interactif coordonnées % canvas
- [x] Style sombre premium (fond `#201B17`)
- [x] 6 zones visuelles (Bar Central, Salon Cigare, Intérieur, Balcon, Terrasse, Lounge)
- [x] ~65 tables cliquables
- [x] Statuts colorés (libre / réservé / installé / indisponible)
- [x] Création réservation depuis table
- [x] Walk-in depuis le plan
- [x] Multi-tables depuis le plan
- [x] Mode service : confirmer, installer, terminer, no-show, annuler
- [x] Realtime des statuts de table
- [x] Seed plan (`npm run seed:floor`)

### Waitlist
- [x] Liste d'attente par date
- [x] Filtre Déjeuner / Dîner / Tous
- [x] Ajout d'entrée (client ou walk-in)
- [x] Statuts : en attente → notifié → installé / parti
- [x] Correction de statut flexible (y compris depuis installé / parti)
- [x] Conversion waitlist → réservation confirmée ou installée (au choix)
- [x] Badge de compteur sur le bouton Attente dans le Planning
- [x] Recherche client à l'ajout
- [x] Realtime
- [x] Migration 003 (shift_id + time_slot)

---

## P0 — À faire avant go-live

- [ ] **Navigation plan → détail réservation** : tapper une table réservée ouvre le détail de la réservation associée
- [x] **Paramètres admin V1** : restaurant (nom, adresse, tél, email, timezone), services (horaires, jours, slot, couverts max), tables (label, zone, capacité), réservations en lecture seule — voir `docs/settings.md`
- [ ] **Tests end-to-end manuels** : parcours complet création/service/clôture d'une réservation
- [ ] **Créer checklist interactive de test TestFlight** : document structuré pour testeurs non-techniques (cases à cocher, résultat attendu, statut OK/Bug/À revoir, champ commentaire, champ screenshot) — couvrir : prérequis, comptes de test, connexion, création réservation, modification statut, sélection table depuis liste et depuis plan, multi-tables, plan de salle, waitlist, CRM client, VIP, WhatsApp confirmation + enquête satisfaction, email confirmation + enquête, formulaire satisfaction web, admin analytics, paramètres restaurant/services/tables, responsive iPhone/iPad, section bugs bloquants, section améliorations souhaitées — base : `docs/manual-test-checklist.md`
- [ ] **Polish iPad** : vérifier les layouts sur grand écran (si iPad disponible)
- [ ] **Go-live restaurant La Maison** : formation équipe, données réelles en prod

### Comptes staff et environnement de test

- [ ] **Fournir les emails staff** : renseigner les emails de Youssef, Anis, Nabil, iPad Resto et Testeur dans `scripts/staff-accounts.config.ts` — voir `docs/staff-accounts.md`
- [ ] **Créer les comptes réels** : `npm run staff:prepare:apply -- --confirm=CREATE_STAFF_ACCOUNTS` après renseignement des emails — transmettre les liens de configuration (24h) à chaque personne
- [ ] **Créer l'environnement test** : `npm run test:seed:apply -- --confirm=CREATE_TEST_RESTAURANT` — noter le restaurant_id test affiché

---

## P1 — Post go-live (comptes / équipe)

- [x] **Section Équipe dans l'app** : liste des membres du restaurant (admins/managers), bouton "Renvoyer invitation" — `AdminSettingsScreen` + `useTeamMembers` + `useStaffInvite`
- [x] **Edge Function `send-staff-invite`** : envoi sécurisé d'email d'invitation depuis l'app — service_role uniquement côté serveur, vérification rôle + restaurant
- [ ] **Déployer `send-staff-invite`** : `supabase functions deploy send-staff-invite` + `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` — voir `docs/staff-accounts.md`
- [ ] **Ajout/suppression de membres** : depuis l'app (section Équipe actuellement en lecture seule)
- [ ] **Permissions fines `waiter`** : accès lectures uniquement, sans insert réservation
- [ ] **Indicateur d'environnement** : badge "Environnement test" si `restaurantName === "La Maison Test"`

---

## P1 — Post go-live

- [ ] **SMS Twilio** : confirmation automatique à la création, rappel J-1
- [ ] **Email Resend** : confirmation par email
- [ ] **Notifications push** : rappels pour le staff (table prête, retard…)
- [ ] **Statistiques avancées** : taux de remplissage par service, no-shows, revenus
- [ ] **Export réservations** : CSV pour comptabilité

---

## P2 — SaaS multi-restaurants

- [ ] **Multi-restaurants** : onboarding restaurant, isolation RLS déjà en place
- [ ] **Abonnements Stripe** : facturation mensuelle par restaurant
- [ ] **Widget réservation web** : embed iframe ou SDK JS pour le site du restaurant
- [ ] **Marketing SMS/email** : campagnes ciblées depuis le CRM
- [ ] **Analytics** : tableau de bord business (revenus, fréquence, rétention clients)
- [ ] **Éditeur drag/drop du plan** : ajuster les tables dans l'app sans modifier le code
- [ ] **Multi-langue** : FR + EN + AR

---

## Notes de priorisation

- L'architecture multi-tenant (RLS par `restaurant_id`) est déjà en place — le passage SaaS ne nécessite pas de refonte base.
- Les SMS Twilio et emails Resend sont prévus via Supabase Edge Functions (pas de nouveau backend nécessaire).
- La `service_role` key ne doit jamais quitter les scripts locaux — les Edge Functions utiliseront un token signé côté serveur.
