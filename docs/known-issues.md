# Points de vigilance et problèmes connus — La Maison

---

## Types TypeScript

**Symptôme** : erreurs `Property X does not exist on type Y` après une migration SQL.

**Cause** : `src/types/database.ts` est un snapshot du schéma au moment de la dernière génération. Toute nouvelle migration le rend obsolète.

**Solution** :
```bash
npx supabase gen types typescript \
  --project-id nosflczsevtrxnyienyn \
  --schema public \
  > src/types/database.ts
npx tsc --noEmit
```

---

## Service role key exposée

**Risque** : si la `service_role` key se retrouve dans un commit ou un fichier public, elle donne un accès total à la base en contournant toutes les règles RLS.

**À faire immédiatement si cela arrive** :
1. Aller dans Supabase → **Project Settings** → **API**
2. Régénérer la `service_role` key (bouton "Reveal" → "Rotate")
3. Mettre à jour `.env.import` avec la nouvelle clé
4. Vérifier l'historique Git avec `git log -p` pour identifier le commit concerné

---

## Plan de salle — ajustements terrain

Les coordonnées des tables dans `floorPlanLayout.ts` ont été définies sans mesures réelles du restaurant. Après les premiers usages en service, il sera probablement nécessaire d'ajuster certaines positions.

**Procédure** : modifier `x`, `y`, `w`, `h` dans `floorPlanLayout.ts`, tester sur Expo Go, commiter.

Aucun impact en base — c'est purement visuel.

---

## iPad / grands écrans

Le layout n'a pas encore été testé sur iPad. Sur grand écran, certains composants peuvent déborder ou être mal proportionnés (le canvas du plan en particulier).

À tester et corriger avant le go-live si l'équipe utilise un iPad.

---

## Recherche clients — performance

La recherche dans le CRM utilise `ilike` côté Supabase sur 22 000+ clients. Pour l'instant la latence est acceptable. Si elle devient perceptible, envisager :
- Un index `GIN` sur les colonnes de recherche
- Un index trigram (`pg_trgm`) pour les recherches partielles

Ne pas optimiser prématurément.

---

## SMS Twilio — non encore branché

Les confirmations et rappels SMS sont dans le backlog P1. La table `notifications_log` est déjà créée. L'intégration se fera via une Supabase Edge Function — aucune modification de l'app mobile ne sera nécessaire.

---

## Navigation plan → détail réservation

Actuellement, tapper une table réservée depuis le plan ouvre le modal d'actions (confirmer, no-show, annuler). Il n'y a pas encore de navigation vers le `ReservationDetailScreen` complet.

C'est un item P0 à implémenter avant le go-live.

---

## Waitlist → navigation post-conversion

Après la conversion d'une entrée waitlist en réservation, `convertToReservation` retourne l'ID de la nouvelle réservation mais la navigation vers `ReservationDetailScreen` n'est pas encore câblée.

À implémenter en même temps que la navigation plan → détail.

---

## Expo Go — limitations

Expo Go ne supporte pas les modules natifs non inclus dans le build Expo. Les fonctionnalités futures (notifications push natives, biométrie, etc.) nécessiteront un build custom (`expo prebuild`).

Pour l'instant, toutes les fonctionnalités utilisent des APIs supportées par Expo Go.
