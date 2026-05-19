# Backlog — La Maison

Dernière mise à jour : 2026-05-19

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

### Dashboard
- [x] Vue du jour : couverts, taux occupation, réservations soir
- [x] Hook `useTodayDashboard`

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
- [x] Conversion waitlist → réservation
- [x] Recherche client à l'ajout
- [x] Realtime
- [x] Migration 003 (shift_id + time_slot)

---

## P0 — À faire avant go-live

- [ ] **Navigation plan → détail réservation** : tapper une table réservée ouvre le détail de la réservation associée
- [ ] **Paramètres admin** : shifts (horaires, créneaux), tables (capacité, zone), gestion staff
- [ ] **Tests end-to-end manuels** : parcours complet création/service/clôture d'une réservation
- [ ] **Polish iPad** : vérifier les layouts sur grand écran (si iPad disponible)
- [ ] **Go-live restaurant La Maison** : formation équipe, données réelles en prod

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
