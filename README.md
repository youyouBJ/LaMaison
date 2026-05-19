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

### Dashboard
- Vue du jour : couverts confirmés, taux d'occupation, réservations du soir
- Statistiques via `useTodayDashboard`
- KPI "À appeler aujourd'hui" : nombre de réservations du jour avec téléphone disponible, statut pending/confirmed, pas encore contactées

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

---

## Fonctionnalités à venir

### P0 — avant go-live
- Navigation plan → détail réservation (tap sur table réservée)
- Paramètres admin : shifts, tables, staff
- Tests manuels end-to-end complets
- Polish iPad

### P1 — post go-live
- SMS Twilio : confirmations et rappels automatiques
- Email Resend : confirmations

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
```

---

## Notes sécurité

- Ne jamais commiter `.env` ni `.env.import`
- Ne jamais commiter la `service_role` key
- Ne jamais commiter les fichiers clients CSV/XLSX (dossier `data/` ignoré par Git)
- La `service_role` key n'est utilisée que dans les scripts locaux, jamais dans l'app mobile
- Si la `service_role` key est exposée accidentellement, la régénérer immédiatement dans le Dashboard Supabase → Project Settings → API

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
| [supabase/README.md](supabase/README.md) | Setup Supabase détaillé (migrations, RLS, shifts) |
| [BACKLOG.md](BACKLOG.md) | Backlog priorisé |
