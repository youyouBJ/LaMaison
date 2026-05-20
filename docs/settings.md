# Paramètres admin — V1

Dernière mise à jour : 2026-05-20

---

## Structure de l'écran Paramètres

L'écran `AdminSettingsScreen` (`src/screens/admin/AdminSettingsScreen.tsx`) est accessible depuis l'onglet Admin → bouton Paramètres.

Sections dans l'ordre :

1. **Restaurant** — informations modifiables
2. **Compte** — lecture seule (profil utilisateur connecté)
3. **Services** — shifts modifiables
4. **Tables** — capacité / zone / nom modifiables
5. **Réservations** — règles en lecture seule + badge "À venir"
6. **Canaux et intégrations** — lecture seule (état des canaux)
7. **Session** — déconnexion

---

## Ce qui est modifiable en V1

### Restaurant (`table: restaurants`)

| Champ       | Modifiable | Notes                                |
|-------------|-----------|--------------------------------------|
| `name`      | Oui       | Requis                               |
| `address`   | Oui       | Optionnel                            |
| `phone`     | Oui       | Optionnel                            |
| `email`     | Oui       | Optionnel, validation format email   |
| `timezone`  | Oui       | Texte libre, ex : `Africa/Tunis`     |
| `logo_url`  | Non       | V2                                   |
| `settings`  | Non       | JSON générique — V2                  |

Requête : `UPDATE restaurants SET ... WHERE id = $restaurantId`
Hook : `src/hooks/useRestaurantSettings.ts`

### Services (`table: shifts`)

| Champ                | Modifiable | Notes                         |
|----------------------|-----------|-------------------------------|
| `name`               | Oui       | Requis                        |
| `days_of_week`       | Oui       | Array number[], au moins 1 jour. Convention : 0=Dim … 6=Sam |
| `start_time`         | Oui       | Format HH:mm                  |
| `end_time`           | Oui       | Format HH:mm, doit être > start_time |
| `slot_duration`      | Oui       | Entier > 0, en minutes        |
| `max_covers_per_slot`| Oui       | Entier > 0                    |
| `duration_rules`     | Non       | JSON complexe — V2            |

Requête : `UPDATE shifts SET ... WHERE id = $shiftId AND restaurant_id = $restaurantId`
Hook : `src/hooks/useShiftSettings.ts`

### Tables (`table: tables`)

| Champ          | Modifiable | Notes                                                    |
|----------------|-----------|-----------------------------------------------------------|
| `label`        | Oui       | Requis — numéro ou nom de table                           |
| `zone`         | Oui       | Requis — **choix parmi les zones existantes** (chip picker, pas de saisie libre) |
| `capacity`     | Oui       | >= 1                                                      |
| `position_x`   | Non       | Coordonnée % canvas — plan de salle                       |
| `position_y`   | Non       | Coordonnée % canvas — plan de salle                       |
| `shape`        | Non       | Forme géométrique — plan de salle                         |
| `floor_plan_id`| Non       | Relation plan de salle                                    |
| `status`       | Non       | Statut opérationnel (libre/occupé/réservé)                |

Requête : `UPDATE tables SET ... WHERE id = $tableId AND restaurant_id = $restaurantId`
Hook : `src/hooks/useTableSettings.ts`

**Zone — sélecteur parmi zones existantes :**
La zone d'une table se choisit parmi les zones déjà présentes dans le restaurant (chips). La saisie libre est désactivée pour éviter les incohérences. La création d'une nouvelle zone est prévue dans l'éditeur visuel du plan (P2 SaaS).

**Affichage :**
Les tables sont affichées en liste compacte, groupées par zone. Chaque ligne affiche `label · X pax` + bouton "Modifier". Le formulaire d'édition s'ouvre uniquement pour la table sélectionnée (une seule à la fois).

**Pourquoi le plan visuel n'est pas modifiable ici :**
Les coordonnées `position_x`, `position_y`, `shape` et les relations floor_plan sont gérées par le plan de salle interactif. Modifier ces valeurs sans recalculer la mise en page relative casserait l'affichage. Un éditeur drag & drop dédié est prévu en P2 (backlog SaaS).

**Mise à jour des capacités par défaut (script) :**
Pour mettre à jour les capacités de plusieurs tables en masse, utiliser le script :
```
npm run tables:update-capacities
```
Le script (`scripts/update-table-capacities.ts`) :
- lit `.env.import` (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESTAURANT_ID)
- normalise les labels ("15", "Table 15", "La 15", "T15" → "15")
- met à jour uniquement les tables trouvées en base
- n'crée ni ne supprime aucune table
- ne modifie pas zone, x/y, shape, floor_plan
- affiche un résumé : tables mises à jour / non trouvées / non concernées
- utilise la service_role key (uniquement dans ce script, jamais dans l'app)

---

## Ce qui est en lecture seule en V1

### Réservations (règles affichées avec badges)

| Règle                    | Valeur actuelle              | Badge   |
|--------------------------|------------------------------|---------|
| Statut à la création     | En attente de confirmation   | Fixe    |
| Intervalle de créneaux   | 15 min (selon le service)    | Fixe    |
| Walk-ins                 | Autorisés                    | Fixe    |
| Durée par couvert        | Règles par service           | À venir |
| Capacité max             | Couverts max par service     | À venir |

Ces règles sont codées dans la logique de réservation (`src/utils/reservationSlots.ts`, `slot_duration` dans `shifts`). Elles ne sont pas stockées dans une table de settings séparée.

### Compte

Profil de l'utilisateur connecté (nom, rôle, email). Non modifiable dans cette V1 — la modification du mot de passe et du nom se ferait via l'interface Supabase Auth (V2).

### Canaux et intégrations

Statut des canaux de communication (WhatsApp manuel, email, SMS, etc.). Configuration manuelle en V2 (stockage dans `restaurants.settings`).

---

## Validations

### Restaurant
- `name` : non vide
- `email` : format `x@x.x` si renseigné

### Shift
- `name` : non vide
- `days_of_week` : au moins 1 jour
- `start_time` / `end_time` : format `HH:mm`, `end > start`
- `slot_duration` : entier > 0
- `max_covers_per_slot` : entier > 0

### Table
- `label` : non vide
- `zone` : non vide, doit appartenir à la liste des zones existantes (garantie par le chip picker)
- `capacity` : entier >= 1

---

## Sécurité

- Toutes les requêtes filtrent sur `restaurant_id` de l'utilisateur connecté → respecte les RLS.
- La `service_role` key n'est jamais utilisée côté app.
- `restaurant_id` n'est jamais modifiable via ces formulaires.
- Si une requête échoue (RLS, réseau), le message d'erreur exact est affiché.

---

## Architecture des hooks

```
src/hooks/
├── useSettingsOverview.ts   — chargement initial (restaurant, shifts, tableRows, guests, floor)
├── useRestaurantSettings.ts — update restaurant (saving, saveError, saveSuccess)
├── useShiftSettings.ts      — update shift par ID (savingId, saveError, savedId)
└── useTableSettings.ts      — update table par ID (savingId, saveError, savedId)
```

Les hooks d'update ne refetchent pas de données elles-mêmes. Ils appellent `onSuccess(updatedRow)` pour permettre une mise à jour locale optimiste dans l'écran.

---

## Champs absents / V2

Colonnes qui n'existent pas encore dans le schéma actuel (pas de migration créée en V1) :

- `shifts.is_active` — activer/désactiver un service
- `tables.is_active` / `tables.is_bookable` — désactiver une table sans la supprimer
- `restaurants.settings` — configuration avancée (mode réservation, règles durée, walk-in toggle)

Avant d'ajouter ces champs en V2 : créer une migration `005_settings_v2.sql`, mettre à jour `src/types/database.ts`, puis exposer les champs dans les hooks.

---

## Tests manuels (parcours V1)

1. Admin > Paramètres > Restaurant > Modifier → changer le nom → Enregistrer
2. Vérifier que le nom est persisté après fermeture/réouverture
3. Tenter d'enregistrer un email invalide → vérifier message d'erreur
4. Modifier un shift (horaires, jours, slot) → Enregistrer
5. Vérifier que les disponibilités de réservation reflètent le nouveau slot
6. Modifier la capacité d'une table → vérifier que le plan de salle s'affiche correctement
7. Tenter de sauvegarder une table avec capacité 0 → vérifier erreur
8. Tenter de sauvegarder un service sans jour sélectionné → vérifier erreur
9. Déconnecter → vérifier redirection vers la page de connexion
