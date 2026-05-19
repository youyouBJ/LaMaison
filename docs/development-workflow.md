# Workflow de développement — La Maison

## Principe fondamental : un module à la fois

Finir un module, le tester, le commiter, **puis** passer au suivant. Ne jamais travailler sur deux modules en parallèle dans la même session. Cela évite les conflits TypeScript, les régressions silencieuses et les commits inutilisables.

---

## Cycle de développement d'un module

```
1. Définir le module (screen, hook, composants, types)
2. Implémenter (code applicatif uniquement)
3. npx tsc --noEmit  ← obligatoire avant de continuer
4. Tester sur Expo Go (device réel ou simulateur)
5. Corriger les erreurs trouvées
6. git add <fichiers spécifiques>
7. git commit -m "feat: description du module"
```

---

## Commandes de référence

```bash
# Lancer l'app (vider le cache Metro)
npx expo start -c

# Vérification TypeScript (obligatoire avant tout commit)
npx tsc --noEmit

# Vérification TypeScript des scripts
npm run typecheck:scripts

# Import SevenRooms (dry-run)
npm run import:sevenrooms

# Import SevenRooms (réel)
npm run import:sevenrooms -- --apply

# Seed plan de salle
npm run seed:floor
```

---

## Travailler avec Claude Code

### Avant de démarrer un module

Donner à Claude le contexte complet :
- Quel module on attaque
- Quels fichiers existants sont concernés
- Les contraintes (stack, ne pas toucher tel module, etc.)

### Règles à rappeler si besoin

- Ne pas modifier le code applicatif d'un module stable pour en développer un autre
- Ne pas modifier Supabase (migrations, RLS, seed) sans validation explicite
- Ne pas commiter automatiquement sans demander
- Toujours vérifier `npx tsc --noEmit` avant de valider

### Après chaque session de développement

- Vérifier `git status` pour ne pas oublier de fichiers
- Commiter les fichiers liés au module uniquement
- Mettre à jour `BACKLOG.md` si un item passe de "À faire" à "Livré"

---

## Gestion des types TypeScript

`src/types/database.ts` est généré automatiquement depuis Supabase. Ne jamais le modifier à la main.

Après une nouvelle migration :
```bash
npx supabase gen types typescript \
  --project-id nosflczsevtrxnyienyn \
  --schema public \
  > src/types/database.ts
npx tsc --noEmit
```

Les types métier (reservations, guests, floor, waitlist) sont dans `src/types/` et peuvent être modifiés manuellement.

---

## Gestion du plan de salle

Les coordonnées du plan sont dans `src/utils/floorPlanLayout.ts`. Ce fichier est du code statique — le modifier ne nécessite pas de migration SQL. Après modification, tester visuellement dans Expo Go et commiter.

---

## Gestion des secrets

| Secret | Fichier | Jamais dans |
|---|---|---|
| Anon key | `.env` | Code versionné |
| Service role key | `.env.import` | App mobile, code versionné |
| Fichiers clients CSV | `data/` | Git (ignoré) |

Si un secret est exposé accidentellement dans un commit :
1. Le régénérer immédiatement dans le Dashboard Supabase
2. Forcer la rotation de la clé
3. Vérifier l'historique Git et supprimer si nécessaire

---

## Migrations SQL

Ne jamais appliquer une migration sans l'avoir relue entièrement. Vérifier qu'elle est idempotente avant de la lancer en production. Toujours régénérer les types TypeScript après.

Ordre d'application obligatoire :
1. `001_initial_schema.sql`
2. `002_reservation_tables.sql`
3. `003_waitlist_shift_time.sql`

---

## Tests

Pas de tests automatisés pour l'instant. Checklist manuelle minimale avant chaque commit de module :

- [ ] `npx tsc --noEmit` passe sans erreur
- [ ] L'écran s'affiche sans crash sur Expo Go
- [ ] Le flux principal (création / modification / suppression) fonctionne
- [ ] Le Realtime se met à jour si le module en dépend
- [ ] Les erreurs réseau sont gérées (affichage d'un message, pas de crash)
