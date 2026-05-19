# Enquêtes de satisfaction — Architecture V1

## Contexte

La Maison collectait historiquement les avis clients via SevenRooms. L'objectif de cette V1 est de reproduire ce flux avec un formulaire propriétaire, compatible avec les dimensions SevenRooms, via un lien unique envoyé manuellement au client.

## Dimensions collectées (compatibles SevenRooms)

| Champ           | Type              | Obligatoire |
|----------------|-------------------|-------------|
| Overall        | Note 1–5          | Oui         |
| Food           | Note 1–5          | Non         |
| Drinks         | Note 1–5          | Non         |
| Service        | Note 1–5          | Non         |
| Ambience       | Note 1–5          | Non         |
| Recommended    | Oui / Non         | Non         |
| Comment        | Texte libre       | Non         |

## Architecture

### Tables Supabase (migration 004)

**`feedback_survey_links`** — lien unique généré par le staff pour une réservation :
- `token` : clé publique (32 caractères alphanumériques aléatoires)
- `channel` : toujours `'manual'` pour l'instant (envoi WhatsApp/email manuel)
- `used_at` : rempli lors de la soumission (bloque la double soumission)
- `expires_at` : optionnel, null par défaut

**`feedback_surveys`** — réponse complète :
- `source = 'web'` : formulaire web
- `source = 'sevenrooms_import'` : futur import historique
- Dimensions identiques aux exports SevenRooms

### Logique token public

1. Le staff clique "WhatsApp enquête" ou "Email enquête" sur une réservation.
2. `useFeedbackSurveyLink.getOrCreate(reservation)` est appelé :
   - Vérifie si `feedback_survey_links` contient déjà un lien pour cette `reservation_id`.
   - Si oui : réutilise le token existant (idempotent).
   - Si non : génère un nouveau token via `generateFeedbackToken()` et l'insère.
3. `buildFeedbackSurveyUrl(token)` construit l'URL publique.
4. L'URL est incluse dans le message WhatsApp / email.
5. Le client clique, arrive sur le formulaire `FeedbackSurveyForm`.
6. Le formulaire appelle la RPC `submit_feedback_survey(token, …)`.
7. La RPC insère dans `feedback_surveys` et pose `used_at` sur le lien.

### RPC `submit_feedback_survey`

- `SECURITY DEFINER` → accessible sans session (anon).
- `GRANT EXECUTE TO anon` → accessible depuis le formulaire web public.
- Vérifie : token valide → non expiré → pas encore utilisé.
- Retourne `{ id }` en succès ou `{ error: 'token_not_found' | 'token_expired' | 'already_submitted' }`.

### RLS

- Staff authentifié du même restaurant : lecture sur les deux tables.
- Staff authentifié du même restaurant : création de liens.
- Insertion dans `feedback_surveys` : uniquement via la RPC (pas de policy INSERT directe).

## Fichiers clés

| Fichier | Rôle |
|--------|------|
| `supabase/migrations/004_feedback_surveys.sql` | Tables, index, RLS, RPC |
| `src/types/feedback.ts` | `FeedbackRating`, `FeedbackSurveyFormState`, `FeedbackSurveySubmissionInput` |
| `src/utils/feedbackSurvey.ts` | `LA_MAISON_FEEDBACK_BASE_URL`, `generateFeedbackToken`, `buildFeedbackSurveyUrl` |
| `src/hooks/useFeedbackSurveyLink.ts` | `getOrCreate(reservation)` → token + URL |
| `src/components/FeedbackSurveyForm.tsx` | Formulaire esthétique (étoiles + Oui/Non + commentaire) |
| `src/utils/whatsapp.ts` | `buildSatisfactionMessage(surveyUrl)` |
| `src/utils/email.ts` | `buildSatisfactionEmail(surveyUrl)` |
| `src/screens/reservations/ReservationDetailScreen.tsx` | Boutons enquête avec flux getOrCreate |

## Configuration requise

### URL publique

La constante `LA_MAISON_FEEDBACK_BASE_URL` dans `src/utils/feedbackSurvey.ts` est actuellement vide.

Tant qu'elle est vide :
- `buildFeedbackSurveyUrl()` retourne `null`.
- `useFeedbackSurveyLink.getOrCreate()` retourne `null` avec `error = "URL d'enquête non configurée."`.
- Les boutons enquête affichent le message d'erreur — aucun message WhatsApp/email n'est ouvert.

Une fois l'URL disponible, renseigner la constante :
```typescript
// src/utils/feedbackSurvey.ts
export const LA_MAISON_FEEDBACK_BASE_URL = 'https://lamaison.app/feedback';
```

### Exposition publique du formulaire

`FeedbackSurveyForm` est un composant React Native autonome. Il est prêt à être intégré dans :

**Option A — Expo Web** : ajouter une route `app/feedback/[token].tsx` (si le projet est migré vers Expo Router).

**Option B — Mini app web dédiée** : créer un projet Next.js ou Vite séparé qui importe les mêmes types et appelle la même RPC Supabase avec le token en query param.

**Option C — Vercel / Netlify** : déployer Option B sur une URL propre (ex: `feedback.lamaison.app`).

Le composant ne dépend que de `supabase`, `theme`, et `types/feedback` — il peut être porté sans réécriture majeure.

## Limites V1

- Le formulaire n'est pas encore exposé publiquement (URL non configurée).
- `generateFeedbackToken()` utilise `Math.random` (suffisant pour un formulaire de satisfaction, pas cryptographiquement sécurisé).
- Pas de dashboard satisfaction dans l'app (futur P1).
- Pas d'envoi automatique (WhatsApp et email restent manuels).
- Import historique SevenRooms non encore réalisé (à faire quand l'export CSV sera disponible).

## Import historique SevenRooms

Quand l'export feedbacks SevenRooms sera disponible :
1. Vérifier les champs exacts et l'échelle des notes (1–5 ou 1–10).
2. Créer un script `scripts/import-sevenrooms-feedback.ts` (sur le modèle du script guests).
3. Insérer avec `source = 'sevenrooms_import'` et `survey_link_id = null`.

## Étapes manuelles Supabase

### Appliquer la migration

Copier-coller le contenu de `supabase/migrations/004_feedback_surveys.sql` dans :
**Supabase Dashboard → SQL Editor → New query → Run**

### Régénérer les types TypeScript (après migration)

```bash
npx supabase gen types typescript \
  --project-id nosflczsevtrxnyienyn \
  --schema public \
  > src/types/database.ts
```

Note : après régénération, les types `feedback_survey_links` et `feedback_surveys` seront disponibles dans `Database['public']['Tables']`. Le hook `useFeedbackSurveyLink` utilisera alors les colonnes typées automatiquement.

## Tests manuels post-migration

1. Appliquer la migration dans Supabase SQL Editor.
2. Régénérer les types si souhaité.
3. **Cas URL vide** : cliquer "WhatsApp enquête" → banner "URL d'enquête non configurée." → aucun WhatsApp ouvert.
4. Renseigner `LA_MAISON_FEEDBACK_BASE_URL` avec une URL test.
5. Cliquer "WhatsApp enquête" sur une réservation completed → lien créé → WhatsApp s'ouvre avec le lien.
6. Cliquer à nouveau → même lien réutilisé (idempotent).
7. Ouvrir l'URL du formulaire avec le token.
8. Remplir notes + recommandation + commentaire → soumettre.
9. Vérifier la ligne dans `feedback_surveys` (Supabase Dashboard → Table Editor).
10. Vérifier que `used_at` est posé sur le `feedback_survey_links`.
11. Tenter une deuxième soumission → message "Cette enquête a déjà été remplie."

## Future intégration dashboard satisfaction

Données disponibles pour un dashboard futur :
- Notes moyennes par dimension (overall, food, drinks, service, ambience).
- Taux de recommandation (recommended = true / total).
- Évolution dans le temps (submitted_at).
- Jointure avec réservations et guests pour segmenter par shift, date, table.
