# CRM Data Quality — Audit V1

## Pourquoi la base SevenRooms peut être sale

SevenRooms est un outil de réservation saisi en temps réel par le staff en salle. Les erreurs de saisie sont fréquentes et structurelles :

- **Civilités dans les noms** : le champ "Prénom" peut contenir "M. Jean" ou "Mme Marie".
- **Noms/prénoms inversés** : SevenRooms ne valide pas l'ordre des champs.
- **Téléphones absents ou invalides** : le staff saisit parfois le numéro du restaurant ou laisse le champ vide.
- **Emails invalides** : fautes de frappe classiques (`@gmial.com`, `.con`, etc.).
- **Doublons** : un même client peut être saisi plusieurs fois lors de réservations différentes, avec des variations légères du nom ou un numéro de téléphone différent.
- **Nom complet dans le prénom** : certaines intégrations ou imports mettent "Prénom Nom" dans le champ prénom et laissent le nom vide.
- **Tags dupliqués** : SevenRooms permet d'ajouter le même tag plusieurs fois.

---

## Règles de détection

### Doublons haute confiance

| Règle | Confiance | Déclencheur |
|-------|-----------|-------------|
| `duplicate_phone_high_confidence` | 0.95 | Même téléphone normalisé (sans espaces/tirets/points) |
| `duplicate_email_high_confidence` | 0.90 | Même email normalisé (lowercase, trim) |

### Doublons probables

| Règle | Confiance | Déclencheur |
|-------|-----------|-------------|
| `possible_name_duplicate` | 0.75 | Même nom complet normalisé (sans accents, sans civilités) |
| `possible_name_duplicate` | 0.60 | Noms proches via Levenshtein ≤ 2 sur prénom ET nom |
| `reversed_name_possible_duplicate` | 0.70 | Prénom/nom inversés entre deux fiches |

### Fiches suspectes

| Règle | Confiance | Déclencheur |
|-------|-----------|-------------|
| `empty_name` | 0.99 | Prénom ET nom vides |
| `dirty_name` | 0.85 | Civilité détectée (M., Mme, Monsieur, etc.) |
| `dirty_name` | 0.80 | Nom complet dans le champ prénom, nom vide |
| `dirty_name` | 0.70 | Tags en doublon |
| `missing_phone` | 0.99 | Téléphone absent |
| `invalid_phone` | 0.90 | Téléphone présent mais format invalide |
| `invalid_email` | 0.90 | Email présent mais format invalide |

### Normalisation appliquée

- **Téléphones** : suppression des espaces, points, tirets, parenthèses. Conservation du `+` international.
- **Emails** : lowercase + trim. Validation : doit contenir `@` et un domaine avec au moins 2 caractères après le dernier point.
- **Noms** : trim → lowercase → suppression des accents (NFD) → suppression des civilités → nettoyage des doubles espaces et de la ponctuation.

---

## Ce qui est sûr à fusionner (automatiquement ou avec confirmation minimale)

- **Même téléphone normalisé + même nom** : très probablement le même client.
- **Même email normalisé + même nom** : très probablement le même client.
- **Civilité dans le nom** : retrait de la civilité sans ambiguïté.

---

## Ce qui nécessite une validation humaine

- **Doublons téléphone/email sans correspondance de nom** : peut être un membre de famille partageant un contact.
- **Noms proches (fuzzy)** : Jean Dupont ≠ Jean Dupond si c'est réellement un homonyme.
- **Noms/prénoms inversés** : SevenRooms les a peut-être saisis dans le bon ordre intentionnellement.
- **Téléphone invalide** : le champ peut contenir une note ou un numéro étranger non standard.
- **Clients sans téléphone** : certains clients refusent de donner leur numéro.

---

## Pourquoi on ne fusionne pas automatiquement

La fusion de fiches clients est irréversible dans l'état actuel du schéma : elle implique de choisir quelle fiche conserver, de rerouter toutes les réservations liées (`reservations.guest_id`), les tags, les notes et les ratings. Une fusion automatique mal calibrée risque de :

1. Perdre des données de réservation d'un client homonyme.
2. Attribuer à tort des visites ou dépenses à une mauvaise fiche.
3. Créer des incohérences difficiles à détecter a posteriori.

L'audit V1 est donc **strictement en lecture seule** et sert à prioriser le travail de nettoyage manuel.

---

## Prochaine étape : écran de validation/fusion CRM (V2)

Un écran dédié dans l'interface admin permettrait de :

1. Afficher les groupes suspects côte à côte.
2. Permettre au staff de confirmer ou rejeter chaque fusion.
3. Déclencher la fusion côté Supabase de manière contrôlée (merge + redirect des foreign keys).
4. Logger chaque action de fusion pour auditabilité.

---

## Limites de l'audit V1

- **Pas de détection cross-champs avancée** : un client avec deux téléphones différents mais le même nom ne sera détecté que par le fuzzy name matching.
- **Levenshtein sur noms courts (< 4 chars)** désactivé pour éviter les faux positifs (ex : "Aya" ≈ "Ana").
- **Pas d'analyse des réservations** : la fréquence de réservation n'est pas utilisée comme signal de duplication.
- **Pas de phonétique** : les variantes phonétiques (ex : "Khaled" / "Khalled") ne sont détectées que si Levenshtein ≤ 2.
- **Perf** : la comparaison fuzzy est O(n²) — sur 22k clients filtrés elle peut prendre plusieurs minutes. Les clients sans nom suffisamment long sont exclus.

---

## Résultats de l'audit V1 (mai 2026 — 22 431 clients)

| Métrique | Valeur |
|----------|--------|
| Clients analysés | 22 431 |
| Clients avec téléphone | 22 418 (99.9 %) |
| Clients avec email | 5 843 (26 %) |
| Groupes doublons téléphone | 2 994 |
| Groupes doublons email | 443 |
| Doublons probables (nom) | 15 753 |
| Fiches suspectes | 4 673 |
| Total issues | 23 863 |

### Pourquoi les 15 753 doublons de nom sont ignorés en priorité

Le matching fuzzy par nom seul génère un taux de faux positifs très élevé :

- **Homonymes réels** : "Mohamed Ben Ali" est un nom commun en Tunisie.
- **Levenshtein trop large** : "Jean Dupont" ≈ "Jean Dupond" détecte des personnes différentes.
- **Noms courts** : le filtre < 4 chars réduit les faux positifs mais pas suffisamment à grande échelle.
- **Absence de signal complémentaire** : sans téléphone ou email commun, on ne peut pas distinguer un doublon d'un homonyme.

→ **Les 13 968 cas fuzzy (score 0.60) sont classés "low_confidence — ignorer pour l'instant".**

### Priorité réelle : téléphone > email > nom

| Niveau | Groupes | Raison |
|--------|---------|--------|
| Haute confiance | 3 437 (2 994 tel + 443 email) | Identifiant unique par nature |
| Confiance moyenne | ~1 784 | Noms inversés ou nom exact + contact |
| Faible confiance | ~18 642 | Fuzzy nom seul, dirty_name, missing_phone |

### Cas particuliers détectés

L'audit a révélé des groupes de grande taille qui ne sont **pas** des doublons d'une même personne :
- **Numéro d'hôtel partagé** : 69 fiches distinctes partagent le numéro de l'Hôtel The Residence Gammarth.
- **Numéro placeholder** : 59 fiches partagent `+216000` (numéro invalide saisi par le staff).
- **Numéro de concierge** : certains groupes de 15-30 fiches partagent le numéro d'un concierge ou d'une entreprise.

→ Ces groupes sont identifiables grâce au score d'action bas (noms très différents, grande taille de groupe) et sont classés "validation humaine nécessaire".

---

## Synthèse de priorisation (crm:audit:summary)

Le script `crm:audit:summary` lit `reports/crm-quality-audit.json` et produit une synthèse en 3 niveaux :

### high_confidence_cleanup
- `duplicate_phone_high_confidence` (score 0.95)
- `duplicate_email_high_confidence` (score 0.90)

**Score d'action** = `confidence × (noms_similaires ? 2 : 1) × (1 / taille_groupe)`

Les paires de 2 avec noms identiques remontent en tête (score ~0.95).
Les groupes hôtel/concierge tombent en bas (score < 0.05).

**Recommandation calculée automatiquement :**
- `fusion contrôlée recommandée` → même téléphone/email + noms similaires
- `validation humaine nécessaire` → même téléphone/email mais noms très différents

### medium_confidence_review
- `reversed_name_possible_duplicate` (101 groupes — tous ont un téléphone)
- `possible_name_duplicate` score 0.75 + au moins un téléphone ou email présent

### low_confidence_ignore_for_now
- `possible_name_duplicate` score 0.60 (fuzzy nom seul)
- `possible_name_duplicate` score 0.75 sans aucun contact
- `dirty_name`, `missing_phone`, `invalid_email`, `invalid_phone`, `empty_name`

---

## Ce qui est sûr à fusionner (automatiquement ou avec confirmation minimale)

- **Même téléphone normalisé + même nom** : très probablement le même client.
- **Même email normalisé + même nom** : très probablement le même client.
- **Civilité dans le nom** : retrait de la civilité sans ambiguïté.

---

## Ce qui nécessite une validation humaine

- **Doublons téléphone/email sans correspondance de nom** : peut être un membre de famille partageant un contact, ou un numéro d'hôtel/entreprise.
- **Noms proches (fuzzy)** : Jean Dupont ≠ Jean Dupond si c'est réellement un homonyme.
- **Noms/prénoms inversés** : SevenRooms les a peut-être saisis dans le bon ordre intentionnellement.
- **Téléphone invalide** : le champ peut contenir une note ou un numéro étranger non standard.
- **Clients sans téléphone** : certains clients refusent de donner leur numéro.

---

## Pourquoi on ne fusionne pas automatiquement

La fusion de fiches clients est irréversible dans l'état actuel du schéma : elle implique de choisir quelle fiche conserver, de rerouter toutes les réservations liées (`reservations.guest_id`), les tags, les notes et les ratings. Une fusion automatique mal calibrée risque de :

1. Perdre des données de réservation d'un client homonyme.
2. Attribuer à tort des visites ou dépenses à une mauvaise fiche.
3. Créer des incohérences difficiles à détecter a posteriori.

L'audit V1 est **strictement en lecture seule** et sert à prioriser le travail de nettoyage manuel.

---

## Étape 3 : prévisualisation de fusion (crm:merge:preview)

Le script `prepare-crm-merge-preview.ts` lit `crm-quality-audit.json` et génère une prévisualisation complète des fusions potentielles, sans aucune écriture Supabase.

### Périmètre inclus

- `duplicate_phone_high_confidence` ou `duplicate_email_high_confidence`
- Noms similaires (même prénom OU même nom sur toutes les fiches du groupe)
- Groupe ≤ 5 fiches

**Exclus** : possible_name_duplicate seul, dirty_name, groupes hôtel/conciergerie (noms très différents), groupes > 5 fiches.

### Règles de choix du master

Le master (fiche de référence à conserver) est sélectionné selon ce barème de priorité :

| Critère | Poids |
|---------|-------|
| VIP = true | +100 |
| avg_rating (par point) | +10 |
| Email présent | +5 |
| Nombre de visites (×0.1) | variable |
| Complétude des données | +1 par champ non nul |
| Tiebreaker : created_at le plus ancien | — |

La raison de sélection est écrite en clair dans chaque ligne du rapport (`master_selection_reason`).

L'enrichissement est robuste : batches de 100 IDs, 2 retries par batch avec délai, logs de progression toutes les 10 batches. Si un batch échoue définitivement, les IDs concernés sont tracés et les groupes affectés sont automatiquement reclassés.

Si Supabase n'est pas disponible (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants), le script utilise uniquement email, phone et complétude de données pour sélectionner le master.

**Note** : un `avg_rating` de 0 est ignoré dans le scoring — SevenRooms peut importer 0 pour signifier "pas de note", une fiche avec rating 0 n'est pas meilleure qu'une sans rating.

### Comportement si enrichissement incomplet

Si certains clients d'un groupe n'ont pas pu être enrichis (réseau défaillant, timeout) :
- `enrichment_partial: true` dans le rapport JSON/CSV
- Le master est marqué `"données enrichies partielles — validation humaine recommandée"`
- Le groupe est automatiquement reclassé en **risque medium**
- `recommended_action` passe à `human_validation_required`
- On ne fusionne jamais sur un master choisi par défaut faute de données

Le champ `enrichment.complete` dans le JSON indique si l'enrichissement a couvert 100% des IDs.

### Niveaux de risque

| Risque | Critère | Action |
|--------|---------|--------|
| `low` | Taille 2, prénom ET nom identiques | `ready_for_review` |
| `medium` | Taille 2 (nom partiel), ou taille 3-4 | `human_validation_required` |
| `high` | Taille 5 | `human_validation_required` |

### Données fusionnées prévisualisées (non appliquées)

Pour chaque groupe, le rapport inclut `merged_data_preview` :
- `first_name` / `last_name` : du master
- `phone` : téléphone partagé
- `email` : meilleur email disponible dans le groupe
- `vip` : `true` si **au moins une** fiche est VIP
- `avg_rating` : **meilleur** rating non nul du groupe
- `notes_merge_required` : `true` si plusieurs notes distinctes à concaténer manuellement
- `tags_merge_required` : `true` si plusieurs jeux de tags à fusionner

### Résultats (mai 2026 — enrichissement complet 2 691/2 691 clients)

| Métrique | Valeur |
|----------|--------|
| Groupes analysés | 1 366 |
| ready_for_review | 242 |
| human_validation_required | 1 124 |
| Groupes déclassés (enrichissement partiel) | 0 |
| Match téléphone exact | 1 032 |
| Match email exact | 228 |
| Match téléphone + email exact | 106 |

---

## Étape 4 : application contrôlée des fusions (crm:merge:dry-run / crm:merge:apply)

Le script `apply-crm-merge-plan.ts` lit `crm-merge-plan-preview.json` et applique les fusions pour les groupes low risk dont le master a été sélectionné sur des données réelles.

### Filtres d'éligibilité (V1)

Un groupe est traité uniquement si **tous** ces critères sont remplis :

| Critère | Valeur requise |
|---------|----------------|
| `recommended_action` | `ready_for_review` |
| `risk_level` | `low` |
| Taille du groupe | 2 fiches exactement |
| `enrichment_partial` | `false` |
| `master_selection_reason` | ne contient pas "défaut", "default" ou "partiel" |

Sur les 242 groupes `ready_for_review` de la prévisualisation, **183 sont éligibles** (59 exclus car master choisi par défaut).

### Modes d'exécution

```bash
# Simulation — lecture seule, aucune écriture
npm run crm:merge:dry-run

# Application réelle — confirmation explicite requise
npm run crm:merge:apply -- --confirm=MERGE_LOW_RISK_CRM
```

Le token `--confirm=MERGE_LOW_RISK_CRM` est requis en mode `--apply`. Sans lui, le script s'arrête avec une erreur.

### Ce que fait chaque fusion (mode APPLY)

1. **Réassignation des foreign keys** : `reservations.guest_id`, `waitlist.guest_id`, `feedback_survey_links.guest_id`, `feedback_surveys.guest_id` → tous pointés vers le master.
2. **Mise à jour du master** : téléphone, email, prénom, nom (si manquants sur le master), vip (union), avg_rating (meilleur non nul), birthday, last_visit (la plus récente), notes (concaténées avec `---`), tags (union lowercase dédupliquée triée).
3. **Le doublon n'est pas supprimé (V1)** : la fiche reste dans la base mais n'a plus de réservations associées. Stratégie : `kept_as_is_v1`.

### Niveaux de risque et guard-rails

- Seuls les groupes `risk_level = low` sont traités.
- Le script lit les données fraîches depuis Supabase avant chaque fusion (non basé sur le cache de la prévisualisation).
- Si le master ou le doublon est introuvable en base, le groupe est marqué `skipped`.
- Si une erreur survient sur une table FK, elle est loggée mais n'annule pas les autres étapes.

### Limitation V1 : permissions Supabase

La clé `service_role` a accès en lecture/écriture sur `guests`, mais les tables `reservations`, `waitlist`, `feedback_survey_links` et `feedback_surveys` peuvent être protégées par des politiques RLS. Si les GRANTs ne sont pas configurés :

- En **DRY RUN** : les colonnes `res / wait / fb` affichent `?` — la simulation reste valide, seuls les comptes de rattachement sont inconnus.
- En **APPLY** : les UPDATE sur ces tables échoueront avec `permission denied`. Le script les log et marque le groupe `failed`.

Pour débloquer :
```sql
GRANT SELECT, UPDATE ON reservations TO service_role;
GRANT SELECT, UPDATE ON waitlist TO service_role;
GRANT SELECT, UPDATE ON feedback_survey_links TO service_role;
GRANT SELECT, UPDATE ON feedback_surveys TO service_role;
```

### Rapports générés

| Fichier | Contenu |
|---------|---------|
| `reports/crm-merge-dry-run.json` | Simulation complète avec prévisualisation des updates |
| `reports/crm-merge-dry-run.csv` | Version CSV pour revue dans un tableur |
| `reports/crm-merge-apply-result.json` | Résultats réels après application |
| `reports/crm-merge-apply-result.csv` | Version CSV du résultat appliqué |

---

## Prochaine étape : outil de validation humaine (V2)

Un écran dédié dans l'interface admin permettrait de :

1. Charger les groupes `human_validation_required` depuis `crm-merge-plan-preview.json`.
2. Pour chaque groupe, afficher les fiches côte à côte avec leurs réservations.
3. Permettre à l'admin de **confirmer** (fusionner) ou **rejeter** (marquer comme homonymes distincts).
4. Déclencher la fusion Supabase de manière contrôlée.
5. Logger chaque action de fusion pour auditabilité et rollback.

---

## Limites de l'audit V1

- **Pas de champs VIP/rating/notes/tags dans les rapports** : non sélectionnés dans la requête Supabase de l'audit. À ajouter dans V2 pour enrichir la prise de décision.
- **Pas de détection cross-champs avancée** : un client avec deux téléphones différents mais le même nom ne sera détecté que par le fuzzy name matching.
- **Levenshtein sur noms courts (< 4 chars)** désactivé pour éviter les faux positifs (ex : "Aya" ≈ "Ana").
- **Pas d'analyse des réservations** : la fréquence de réservation n'est pas utilisée comme signal de duplication.
- **Pas de phonétique** : les variantes phonétiques (ex : "Khaled" / "Khalled") ne sont détectées que si Levenshtein ≤ 2.
- **Perf** : la comparaison fuzzy est O(n²) — sur 22k clients filtrés elle peut prendre plusieurs minutes. Les clients sans nom suffisamment long sont exclus.

---

## Commandes

```bash
# Étape 1 — Audit complet (lecture seule, ~5 min)
npm run crm:audit

# Étape 2 — Synthèse priorisée (lecture seule, instantané)
npm run crm:audit:summary

# Étape 3 — Prévisualisation des fusions (lecture seule, enrichissement Supabase)
npm run crm:merge:preview

# Étape 4a — Simulation des fusions low risk (lecture seule)
npm run crm:merge:dry-run

# Étape 4b — Application réelle des fusions low risk (écriture Supabase)
npm run crm:merge:apply -- --confirm=MERGE_LOW_RISK_CRM

# Vérifier les types TypeScript
npm run typecheck:scripts
```

Rapports générés :
- `reports/crm-quality-audit.json` / `.csv` — toutes les issues brutes
- `reports/crm-quality-summary.json` / `.csv` — synthèse priorisée + top 100
- `reports/crm-merge-plan-preview.json` / `.csv` — prévisualisation des fusions avec master recommandé
- `reports/crm-merge-dry-run.json` / `.csv` — simulation des fusions éligibles
- `reports/crm-merge-apply-result.json` / `.csv` — résultats après application réelle
