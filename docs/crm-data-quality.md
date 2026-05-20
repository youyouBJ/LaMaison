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

## Commandes

```bash
# Lancer l'audit (lecture seule)
npm run crm:audit

# Vérifier les types TypeScript du script
npm run typecheck:scripts
```

Les rapports sont générés dans `reports/crm-quality-audit.json` et `reports/crm-quality-audit.csv`.
