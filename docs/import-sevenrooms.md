# Import SevenRooms → La Maison

Script Node/TypeScript local pour importer les clients exportés depuis SevenRooms
dans la table `guests` de Supabase. Fonctionne en dry-run par défaut — aucune
donnée n'est écrite sans le flag `--apply`.

---

## 1. Exporter le fichier depuis SevenRooms

1. Dans SevenRooms, aller dans **Clients**
2. Cliquer sur **Export** (en haut à droite)
3. Choisir le format **CSV (UTF-8)**
4. Télécharger le fichier

> Si l'export est en `.xlsx` (Excel), l'ouvrir et enregistrer sous → **CSV UTF-8**.
> Dans Excel : Fichier → Enregistrer sous → Format : CSV UTF-8 (avec BOM).
> Dans Numbers (Mac) : Fichier → Exporter → CSV.

> **Note sur le séparateur** : les exports en français (Numbers, Excel FR) utilisent souvent
> le point-virgule `;` comme séparateur au lieu de la virgule `,`. Le script détecte
> automatiquement le séparateur — aucune configuration manuelle nécessaire.

---

## 2. Placer le fichier CSV

```
data/sevenrooms-guests.csv
```

Ce dossier est ignoré par Git (`.gitignore`). Ne jamais commiter de données clients.

---

## 3. Configurer les variables d'environnement

```bash
cp .env.import.example .env.import
```

Editer `.env.import` :

```env
SUPABASE_URL=https://nosflczsevtrxnyienyn.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhb...  # voir ci-dessous

# Recommandé : identifiant exact du restaurant
RESTAURANT_ID=75ace9a5-97af-4588-87d9-d375c350f81b
# RESTAURANT_NAME=La Maison  # utilisé seulement si RESTAURANT_ID est vide

SEVENROOMS_CSV_PATH=./data/sevenrooms-guests.csv
```

### RESTAURANT_ID vs RESTAURANT_NAME

**`RESTAURANT_ID` est recommandé** : il pointe directement sur la bonne ligne en base,
sans risque d'ambiguïté sur la casse ou les accents.

- Récupérer l'UUID dans Supabase → Table Editor → `restaurants` → colonne `id`
- Si `RESTAURANT_ID` est renseigné, `RESTAURANT_NAME` est ignoré
- Si `RESTAURANT_ID` est vide, le script cherche par nom avec `RESTAURANT_NAME`

### Récupérer la Service Role Key

1. Aller sur [supabase.com](https://supabase.com) → votre projet
2. **Project Settings** → **API**
3. Copier la clé **service_role** (section "Project API Keys")

> ⚠️ Cette clé contourne toutes les règles RLS. Ne jamais la partager, ne jamais
> la commiter, ne jamais l'utiliser dans l'app mobile.

---

## 4. Tester en dry-run (lecture seule)

```bash
npm run import:sevenrooms
```

Affiche un résumé sans écrire quoi que ce soit :

```
=== Import SevenRooms → La Maison ===
Mode    : 🔍 DRY-RUN (aucune écriture)
Fichier : /chemin/vers/data/sevenrooms-guests.csv

22682 lignes dans le fichier
Restaurant trouvé : La Maison (uuid...)
Chargement des clients existants...
  → 0 clients existants (0 téléphones, 0 emails)

Analyse des lignes CSV...

─── Résumé ───────────────────────────────────────
Lignes lues          : 22682
Clients valides      : 22671
Avec téléphone       : 22660
Avec email           : 5867
VIP                  : 13
Avec rating          : 1224
À insérer            : 22671
À mettre à jour      : 0
Ignorés (vides)      : 11
Erreurs de parsing   : 0
──────────────────────────────────────────────────

🔍 DRY-RUN terminé — aucune donnée écrite.
→ Relancez avec --apply pour importer réellement.
```

---

## 5. Tester sur un échantillon (100 lignes)

```bash
npm run import:sevenrooms -- --limit 100
```

---

## 6. Importer réellement

```bash
npm run import:sevenrooms -- --apply
```

> L'import est **idempotent** : relancer n'importe pas en double.

> **Tags déjà importés** : si des clients ont été importés avec des tags bruts
> (ex : `GROUP ALL GUESTS:GROUP ALL GUESTS`), relancer l'import avec `--apply`
> les mettra à jour automatiquement — les clients sont reconnus par téléphone/email
> et leurs tags sont nettoyés au passage. Aucune migration SQL nécessaire.
> Si un client avec le même téléphone existe déjà, il est mis à jour.
> Si seulement l'email correspond, il est mis à jour.
> Sinon, il est inséré.

---

## 7. Vérifier dans l'app

Ouvrir l'onglet **Clients** dans l'app pour confirmer que les données sont bien importées.

---

## Mapping des colonnes

| Colonne SevenRooms             | Champ `guests`    | Notes                                              |
|-------------------------------|-------------------|----------------------------------------------------|
| Client First Name             | `first_name`      |                                                    |
| Client Last Name              | `last_name`       |                                                    |
| Email / Alt Email             | `email`           | Alt Email utilisé si Email vide                    |
| Phone / Work Phone            | `phone`           | Work Phone utilisé si Phone vide                   |
| Birthday                      | `birthday`        | `null` si invalide                                 |
| Notes                         | `notes`           | + Loyalty ID/Tier/Rank ajoutés si renseignés       |
| Tags                          | `tags`            | Découpés par virgule, dédupliqués                  |
| Visits                        | `visit_count`     |                                                    |
| Cancels                       | `cancels`         |                                                    |
| No Shows                      | `no_shows`        |                                                    |
| Spend/Visit                   | `avg_spend`       | Choix : Spend/Visit = revenu moyen par visite      |
| Avg. Rating                   | `avg_rating`      | `null` si hors [0–5]                               |
| VIP                           | `vip`             | `true` si oui/true/1/VIP/y/oui                     |
| La Maison Marketing Opt-In    | `marketing_opt_in`| Fallback : Venue Group Marketing Opt-In            |
| Last Visit                    | `last_visit`      | `null` si invalide                                 |
| —                             | `source`          | Toujours `'import'`                                |

Colonnes **non mappées** : Anniversary, Address, City, State, Postal Code, Country,
Orders, Total Spend, Spend/Cover, Loyalty Tier/Rank (conservés dans `notes` si renseignés).

---

## Stratégie de dédoublonnage

1. Téléphone normalisé (priorité 1)
2. Email normalisé (priorité 2)
3. Sinon → insertion

La normalisation du téléphone supprime espaces, tirets, points, parenthèses
et conserve le `+` international.

---

## Sécurité

- La clé `service_role` est dans `.env.import` → ignoré par Git
- Les fichiers CSV/XLSX sont dans `data/` → ignoré par Git
- Le script ne s'exécute qu'en local — jamais via l'app mobile
- Sans `--apply`, aucune donnée n'est écrite

---

## Dépannage

| Erreur | Solution |
|--------|----------|
| `Fichier CSV introuvable` | Vérifier `SEVENROOMS_CSV_PATH` dans `.env.import` |
| `SUPABASE_SERVICE_ROLE_KEY manquante` | Vérifier `.env.import` |
| `Restaurant "X" introuvable` | Vérifier `RESTAURANT_NAME` dans `.env.import` |
| `Colonnes SevenRooms manquantes` | Le CSV n'est pas un export SevenRooms, ou le séparateur n'a pas été détecté — vérifier l'encodage UTF-8 |
| `Invalid Opening Quote` | Mettre à jour le script (support `;` ajouté — relancer après `git pull`) |
| Erreurs de parsing en masse | Vérifier que le fichier est bien en CSV UTF-8 (pas ANSI, pas UTF-16) |

### Séparateurs CSV supportés

Le script détecte automatiquement le délimiteur à partir de la première ligne :
- `,` (virgule) — exports SevenRooms anglais, standard
- `;` (point-virgule) — exports Numbers/Excel en français

Le délimiteur détecté est affiché au démarrage :
```
Séparateur CSV : ";"
```

Si le fichier s'ouvre mal, vérifier dans un éditeur texte (VS Code, TextEdit) que les colonnes sont bien séparées par `;` ou `,` et non par des tabulations.
