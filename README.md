# La Maison

Application mobile de gestion de restaurant — conçue pour remplacer SevenRooms au restaurant La Maison (Tunis), avec une architecture pensée pour évoluer vers un SaaS multi-restaurants.

---

## Objectif produit

Donner à l'équipe de La Maison un outil souverain, rapide et sur mesure pour :
- gérer les réservations et le plan de salle en temps réel
- accéder à la base clients importée depuis SevenRooms
- gérer la liste d'attente (waitlist)
- préparer le service au quotidien

À terme : ouvrir la plateforme à d'autres restaurants (multi-tenant) avec abonnement Stripe, widget web de réservation, et notifications SMS/email.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Mobile | React Native 0.81 + Expo SDK 54 |
| Langage | TypeScript strict |
| Backend | Supabase (PostgreSQL + Auth + RLS + Realtime) |
| Navigation | React Navigation (Stack + Bottom Tabs) |
| Gestes | react-native-gesture-handler + Reanimated 4 |
| Polices | Playfair Display (titres) + Inter (corps) |
| Tests device | Expo Go (iOS / Android) |

Stack à ne jamais changer sauf décision explicite.

---

## Fonctionnalités livrées

### Auth
- Connexion email/mot de passe via Supabase Auth
- Session persistante (AsyncStorage)
- Redirection automatique auth ↔ app

### Accueil (Dashboard)
- Vue opérationnelle du jour uniquement — realtime via `useTodayDashboard`
- KPIs : total réservations, couverts actifs, confirmées, à table, en attente, terminées
- Waitlist en attente du jour (via `useDashboardExtended`)
- KPI "À appeler" : réservations du jour avec téléphone disponible, statut pending/confirmed
- Liste "Prochaines arrivées" avec statut, VIP, table assignée
- Actions rapides : Nouvelle réservation, Plan, Attente, Clients

### Admin (pilotage avancé)
- Sélecteur de période : Aujourd'hui / 7 jours / 30 jours / Mois / Année
- KPIs réservations par période : total, couverts, confirmées, terminées, annulées, no-show, walk-ins, occasions
- Répartition services : déjeuner / dîner avec couverts
- Répartition statuts : grille visuelle avec taux d'annulation et no-show
- Satisfaction client unifiée : note globale SevenRooms (clients notés avec `avg_rating > 0`) + enquêtes in-app par période
- Configuration : restaurant, compte staff, services (shifts), plan de salle, données clients

### Réservations
- Liste par date avec sélecteur calendrier
- Filtre Déjeuner / Dîner / Tous
- Recherche par nom ou téléphone
- Création de réservation (client existant, nouveau client, VIP, walk-in)
- Sélecteur d'heure par créneaux
- Multi-tables via `reservation_tables`
- Détail réservation
- Changement de statut (confirmé, installé, terminé, no-show, annulé)
- Correction de statut même après terminé / annulé / no-show
- Badge "À appeler" sur les réservations du jour en attente de confirmation téléphonique
- Bouton "Appeler" : ouvre l'app téléphone directement depuis la liste (`tel:` link natif)
- Bouton "Confirmé par téléphone" dans le détail : passe en `confirmed` si pending, ajoute une trace horodatée dans les notes

### CRM Clients
- 22 000+ clients importés depuis SevenRooms
- Recherche multi-critères (nom, téléphone, email)
- Filtres et tris
- Fiche client : notes, VIP, tags, historique réservations
- Tags nettoyés à l'import

### Import SevenRooms
- Script local Node/TypeScript (`npm run import:sevenrooms`)
- CSV/XLSX ou CSV avec séparateur `;`
- Mode dry-run par défaut, `--apply` pour importer réellement
- Dédoublonnage téléphone / email
- Idempotent : relancer ne duplique pas les données
- Utilise la `service_role` key via `.env.import`

### Plan de salle
- Plan interactif à l'échelle, coordonnées issues de Claude Design
- Style sombre premium (fond brun `#201B17`, or `#D4AA40`)
- 6 zones : Bar Central, Bar Salon Cigare, Restaurant Intérieur, Balcon, Terrasse, Lounge
- ~65 tables cliquables avec statut coloré (libre / réservé / installé / indisponible)
- Shapes : ronde, rectangulaire, carrée, losange
- Création de réservation directement depuis une table
- Walk-in depuis le plan (statut `seated` d'emblée)
- Multi-tables depuis le plan
- Mode service : confirmer, mettre à table, terminer, no-show, annuler
- Synchronisation Realtime des statuts de table

### Waitlist
- Liste d'attente par date
- Filtre Déjeuner / Dîner / Tous
- Ajout d'entrée (client existant, nouveau, ou walk-in)
- Statuts : en attente, notifié, installé, parti
- Correction de statut possible à tout moment
- Conversion d'une entrée waitlist en réservation confirmée ou installée
- Badge de notification sur le bouton Attente (compteur d'entrées en attente)
- Recherche de client pour l'ajout
- Synchronisation Realtime

### Contact direct (V1 manuel)
- WhatsApp : ouvre l'app WhatsApp native avec un message pré-rempli (lien `wa.me`)
- Email : ouvre l'app email native avec sujet et corps pré-remplis (`mailto:`)
- Messages disponibles : confirmation réservation, rappel du jour, notification waitlist, envoi d'enquête
- Aucun envoi automatique — le staff déclenche depuis la fiche réservation ou la fiche client

### Occasions
- Tags `[Occasion] Anniversaire` et `[Occasion] Événement` stockés dans le champ `notes` de la réservation
- Affichés comme badges visuels dans le détail de réservation
- Filtrés lors de l'affichage des notes libres (non inclus dans le texte brut affiché)

### Enquête satisfaction
- Génération d'un token public de 32 caractères par réservation, sans données client exposées
- Idempotent : une même réservation reçoit toujours le même lien
- Envoi via WhatsApp ou email (manuel V1)
- Formulaire hébergé sur Vercel : `https://lamaison-feedback.vercel.app/feedback?token=<token>`
- Notes 1–5 sur 5 dimensions (global, cuisine, boissons, service, ambiance), recommandation Oui/Non, commentaire libre
- Réponses stockées dans `feedback_surveys`, agrégées dans Admin par période
- Sources de satisfaction affichées séparément :
  - **SevenRooms** : `guests.avg_rating > 0` (historique importé, toutes périodes)
  - **In-app** : `feedback_surveys` filtré par période sélectionnée

### Suppression client
- Vérification des données liées (réservations, entrées waitlist) avant toute suppression
- Dialog de confirmation avec décompte des données concernées
- Action irréversible — le guard affiche clairement les risques avant validation

---

## Fonctionnalités à venir

### P0 — avant go-live
- Navigation plan → détail réservation (tap sur table réservée)
- Paramètres admin : shifts, tables, staff
- Tests manuels end-to-end complets
- Polish iPad
- Guide utilisateur PDF (formation équipe La Maison)
- Comptes staff de test + environnement de recette isolé
- Build TestFlight / distribution interne iOS
- Stabilisation post go-live (premiers services réels, retours terrain)

### P1 — post go-live
- SMS Twilio : confirmations et rappels automatiques
- Email Resend : confirmations
- Notifications push : rappels pour le staff (table prête, retard…)
- Statistiques avancées : taux de remplissage par service, no-shows, revenus
- Export réservations : CSV pour comptabilité
- Import historique feedbacks SevenRooms (script `import-sevenrooms-feedback.ts`)
- Audit qualité base de données (doublons, normalisation téléphone/email)
- Nettoyage contrôlé du CRM sous validation humaine
- Dashboard satisfaction (notes moyennes, taux de recommandation par service)

### P2 — SaaS
- Multi-restaurants (déjà multi-tenant en base)
- Abonnements Stripe
- Widget réservation web embed
- Marketing SMS/email
- Analytics
- Éditeur drag/drop du plan dans l'app

---

## Structure du projet

```
LaMaison/
├── src/
│   ├── components/        # Composants réutilisables
│   ├── hooks/             # Logique métier (useReservations, useFloorPlan, …)
│   ├── navigation/        # Navigateurs (Auth, Root, Tabs, Stacks)
│   ├── screens/           # Écrans par module (auth, dashboard, reservations, guests, floor, settings)
│   ├── theme/             # Design system (colors, typography, spacing, radius)
│   ├── types/             # Types TypeScript (database.ts généré, métier)
│   └── utils/             # Helpers (date, format, floorPlanLayout, reservationTables, …)
├── scripts/               # Scripts locaux (import SevenRooms, seed floor plan)
├── supabase/
│   ├── migrations/        # SQL migrations (001, 002, 003)
│   └── README.md          # Setup Supabase détaillé
├── docs/                  # Documentation technique
├── data/                  # Fichiers clients (ignorés par Git)
├── .env.example           # Variables d'environnement de l'app
└── .env.import.example    # Variables pour les scripts d'import
```

---

## Installation locale

```bash
# Cloner le repo
git clone <repo-url>
cd LaMaison

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec les valeurs Supabase
```

Appliquer ensuite les migrations SQL dans le Dashboard Supabase — voir [docs/supabase-setup.md](docs/supabase-setup.md).

---

## Variables d'environnement

### `.env` — application mobile

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé anon/publishable Supabase |

### `.env.import` — scripts locaux uniquement

| Variable | Description |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role (accès total, jamais dans l'app) |
| `RESTAURANT_ID` | UUID du restaurant dans la table `restaurants` |
| `SEVENROOMS_CSV_PATH` | Chemin vers le fichier CSV exporté depuis SevenRooms |

---

## Commandes utiles

```bash
# Lancer l'app (Expo Go)
npx expo start -c

# Vérification TypeScript
npx tsc --noEmit

# Import clients SevenRooms (dry-run)
npm run import:sevenrooms

# Import clients SevenRooms (réel)
npm run import:sevenrooms -- --apply

# Seed du plan de salle
npm run seed:floor

# Vérification TypeScript des scripts
npm run typecheck:scripts

# Vérification TypeScript des scripts (commande directe)
npx tsc -p tsconfig.scripts.json --noEmit
```

---

## Supabase

### Auth
Connexion email/mot de passe via `supabase.auth`. Session persistante avec AsyncStorage. Les profils staff sont dans `public.users`, liés à `auth.users` par UUID.

### Tables principales

| Table | Rôle |
|---|---|
| `restaurants` | Cœur du multi-tenant — un enregistrement = un restaurant isolé |
| `users` | Profils staff (FK → `auth.users.id`) |
| `guests` | Base clients (22 000+ importés depuis SevenRooms) |
| `reservations` | Réservations : statut, créneau, couverts, table principale |
| `reservation_tables` | Jointure N:N réservation ↔ tables (multi-tables, migration 002) |
| `tables` | Tables du restaurant : zone, capacité, statut physique |
| `shifts` | Services (Déjeuner, Dîner) : horaires, créneaux, capacité max par créneau |
| `waitlist` | Entrées de liste d'attente avec statut |
| `feedback_survey_links` | Tokens publics d'enquête satisfaction, 1 par réservation |
| `feedback_surveys` | Réponses aux enquêtes (usage futur + import historique SevenRooms) |

### RLS (Row Level Security)
Toutes les tables ont des policies RLS basées sur `restaurant_id`. Un utilisateur authentifié n'accède qu'aux données de son propre restaurant.

### Realtime
Activé sur `reservations`, `tables`, et `waitlist`. Les hooks utilisent `supabase.channel()` avec `postgres_changes` pour maintenir l'UI synchronisée sans polling.

---

## Fonctionnement métier

### Réservations multi-tables
Chaque réservation a une **table principale** (`reservations.table_id`, toujours renseignée) et optionnellement des **tables secondaires** via la jointure `reservation_tables`. `formatReservationTables()` dans `src/utils/reservationTables.ts` combine les deux pour l'affichage.

### Walk-ins
Un walk-in peut n'avoir aucune fiche client : `guest_id = null` est un cas normal. La source est `'walkin'` et le statut initial est `'seated'` (client déjà installé à la création).

### Statuts de réservation

| Statut | Signification |
|---|---|
| `pending` | Créée, en attente de confirmation téléphonique |
| `confirmed` | Confirmée par le staff |
| `seated` | Client installé à table |
| `completed` | Service terminé |
| `cancelled` | Annulée |
| `noshow` | No-show |

Les changements de statut sont possibles dans tous les sens — pas de blocage depuis `completed` ou `cancelled`.

### Occasions (Anniversaire / Événement)
Stockées comme marqueurs dans le champ `notes` (`[Occasion] Anniversaire`, `[Occasion] Événement`). Ce choix évite une migration de schéma prématurée. Ils sont filtrés de l'affichage texte libre et rendus visuellement comme badges.

### VIP
`vip` est un booléen sur la fiche client (`guests.vip`), visible sur les réservations et dans le CRM, avec priorité d'affichage dans la liste clients.

### Waitlist
Statuts : `waiting` → `notified` → `seated` / `left`. La conversion en réservation met à jour le statut waitlist automatiquement : `confirmed` → `notified`, `seated` → `seated`.

---

## Notes sécurité

- Ne jamais commiter `.env` ni `.env.import`
- Ne jamais commiter la `service_role` key
- Ne jamais commiter les fichiers clients CSV/XLSX (dossier `data/` ignoré par Git)
- La `service_role` key n'est utilisée que dans les scripts locaux, jamais dans l'app mobile
- Si la `service_role` key est exposée accidentellement, la régénérer immédiatement dans le Dashboard Supabase → Project Settings → API
- WhatsApp et email sont **manuels en V1** : l'app ouvre l'application externe du staff, elle n'envoie rien automatiquement et ne garantit pas la remise
- Ne jamais implémenter d'envoi automatique sans consentement client explicite et logs d'envoi côté serveur

---

## Workflow de développement avec Claude Code

Voir [docs/development-workflow.md](docs/development-workflow.md) pour le détail.

Règle principale : **un module à la fois**. Finir, tester, commiter avant de passer au suivant.

```bash
# Avant tout push
npx tsc --noEmit
# Tester sur Expo Go
# Commiter si tout est stable
git add <fichiers>
git commit -m "feat: description du module"
```

---

## Documentation

| Fichier | Contenu |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Architecture générale et flows |
| [docs/database.md](docs/database.md) | Schéma de base de données et RLS |
| [docs/supabase-setup.md](docs/supabase-setup.md) | Setup Supabase complet |
| [docs/floor-plan.md](docs/floor-plan.md) | Plan de salle : zones, tables, style |
| [docs/waitlist.md](docs/waitlist.md) | Module Waitlist |
| [docs/import-sevenrooms.md](docs/import-sevenrooms.md) | Import clients SevenRooms |
| [docs/reservations.md](docs/reservations.md) | Architecture réservations multi-tables |
| [docs/development-workflow.md](docs/development-workflow.md) | Workflow de développement |
| [docs/known-issues.md](docs/known-issues.md) | Problèmes connus et points de vigilance |
| [docs/dashboard.md](docs/dashboard.md) | Architecture Accueil / Admin — KPIs, hooks, satisfaction |
| [docs/feedback-surveys.md](docs/feedback-surveys.md) | Module enquête satisfaction (tokens, formulaire, agrégation) |
| [supabase/README.md](supabase/README.md) | Setup Supabase détaillé (migrations, RLS, shifts) |
| [BACKLOG.md](BACKLOG.md) | Backlog priorisé |
