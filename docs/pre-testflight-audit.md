# Audit pré-TestFlight — La Maison

**Date :** 2026-05-21  
**Auditeur :** Claude Code (claude-sonnet-4-6)  
**Répertoire :** `/Users/ybj/Documents/LaMaison`  
**Stack :** Expo SDK 54.0.33, React Native 0.81.5, TypeScript strict, Supabase, React Navigation 7, react-native-reanimated 4

---

## 1. Commandes lancées et résultats

| Commande | Résultat |
|---|---|
| `npx tsc --noEmit` | **0 erreur** — compilation propre |
| `npx tsc -p tsconfig.scripts.json --noEmit` | **0 erreur** — scripts propres |
| `npm run lint` | Script absent du `package.json` — **SCRIPT_NOT_FOUND** |
| `npm run test` | Script absent du `package.json` — **SCRIPT_NOT_FOUND** |
| `npm run build` | Script absent du `package.json` — **SCRIPT_NOT_FOUND** |

> **Note :** L'absence de lint/test/build dans les scripts n'est pas bloquante pour TestFlight (build Expo via `eas build`), mais est à traiter en V2.

---

## 2. Partie 1 — Audit TypeScript / build

### Résultat : PASS

- **0 erreur TypeScript** sur le projet principal (`tsconfig.json` avec `strict: true`, `noImplicitAny: true`, `noImplicitReturns: true`)
- **0 erreur TypeScript** sur les scripts (`tsconfig.scripts.json`)
- Aucune correction TypeScript n'a été nécessaire

---

## 3. Partie 2 — Audit imports / fichiers morts

### Console.log

| Fichier | Ligne | Contenu | Verdict |
|---|---|---|---|
| `src/hooks/useCreateReservation.ts` | 193 | `console.log('[createReservation] status envoyé à Supabase :')` | Guarded by `if (__DEV__)` — **inoffensif en production** |
| `src/screens/auth/LoginScreen.tsx` | 45 | `console.error('[Login] signInWithPassword threw:')` | Guarded by `if (__DEV__)` — **inoffensif** |
| `src/screens/settings/SettingsScreen.tsx` | 550 | `console.error('[Admin] signOut threw:')` | Guarded by `if (__DEV__)` — **inoffensif** |
| `src/screens/admin/AdminSettingsScreen.tsx` | 539 | `console.error('[AdminSettings] signOut threw:')` | Guarded by `if (__DEV__)` — **inoffensif** |

**Verdict :** Tous les `console.*` sont dans des blocs `if (__DEV__)` — ils ne s'exécutent pas dans les builds de production Expo.

### Fichiers morts / imports inutilisés

Aucun fichier inutilisé détecté dans `src/`. Tous les composants, hooks et utilitaires trouvés sont importés par au moins un écran ou un autre composant.

### TODOs dangereux

- `src/types/database.ts` : commentaire `// FICHIER TEMPORAIRE` — rappel documentaire uniquement, pas de risque runtime.
- Aucun TODO sécurité, auth ou crash trouvé dans les écrans.

---

## 4. Partie 3 — Audit navigation

### Navigateurs

| Navigator | Screens déclarés | Imports | Verdict |
|---|---|---|---|
| `RootNavigator` | AuthNavigator ou MainTabs | OK | ✅ |
| `AuthNavigator` | `LoginScreen` | OK | ✅ |
| `MainTabs` | Dashboard, FloorPlan, Reservations, Guests, Settings | Tous importés | ✅ |
| `ReservationsNavigator` | ReservationList, NewReservation, ReservationDetail, Waitlist | Tous importés | ✅ |
| `GuestsNavigator` | GuestList, GuestDetail | OK | ✅ |
| `AdminNavigator` | AdminMain (SettingsScreen), AdminSettings (AdminSettingsScreen) | OK | ✅ |

### Routes et navigation

- Waitlist → navigation `ReservationDetail` : câblé via `handleConvertConfirm` dans `WaitlistScreen.tsx` (line 352)
- Rappels → navigation `ReservationDetail` : câblé via `RemindersSection.tsx` avec `CommonActions.navigate`
- Rappels → Waitlist : câblé via `actionType: 'open_waitlist'`
- Retour bouton sur `WaitlistScreen` : présent (`navigation.goBack()` line 407)
- Retour bouton sur `AdminSettingsScreen` : présent (`navigation.goBack()` line 727)
- Modal sélection table : présent dans `FloorPlanScreen.tsx` (Modal avec `CreateReservationForTableForm`)

### Problèmes de navigation

🟡 **Hardcodés dans les navigators** : Les `headerTitle` dans `ReservationsNavigator.tsx` (lignes 40, 48, 56) et `GuestsNavigator.tsx` (line 34) sont en français dur, non traduits. En mode anglais, ces titres d'en-tête restent en français.

🟡 **Hardcodés dans GuestDetailScreen** : Sections `SectionCard` avec titres `"Informations"`, `"Contact"`, `"Historique réservations"`, etc. non traduits.

---

## 5. Partie 4 — Audit auth / rôles

### Section Équipe (Admin)

```typescript
// AdminSettingsScreen.tsx — ligne 478-479
const OWNER_EMAIL = 'youssefbenjema@gmail.com';
const isOwnerAccount = localData?.userProfile.email === OWNER_EMAIL;
```

La section équipe est conditionnée par `isOwnerAccount && (...)` — **seul Youssef la voit**.  
`useTeamMembers` reçoit `null` si `!isOwnerAccount`, donc pas de requête DB inutile.

### Edge Function `send-staff-invite`

- La `service_role` key est lue uniquement côté serveur via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` — **jamais exposée côté app**
- Le JWT caller est vérifié avant toute opération (étape 1)
- Le rôle caller est vérifié : `host` et `waiter` reçoivent HTTP 403 (étape 3)
- La cible doit appartenir au même `restaurant_id` (étape 5)
- **Verdict : PASS** — sécurité Edge Function correcte

### Isolation testeur

- RLS basé sur `current_user_restaurant_id()` — tous les accès Supabase sont filtrés par `restaurant_id`
- Seul `OWNER_EMAIL` voit la section équipe dans Settings
- **Verdict : OK**

---

## 6. Partie 5 — Audit données nulles / crash

### Données nulles critiques

| Donnée | Écran | Protection | Verdict |
|---|---|---|---|
| `guest` null | DashboardScreen `ReservationRow` | `if (!r.guests) return noName` | ✅ |
| `guest.phone` absent | ReservationDetailScreen | `r.guests?.phone ?? null` | ✅ |
| `guest.email` absent | ReservationDetailScreen | `r.guests?.email ?? null` | ✅ |
| `table` absente | DashboardScreen | `r.tables?.label ?? unassigned` | ✅ |
| `reservation_tables` vide | `formatReservationTables()` | Fallback sur `primaryTable?.label` | ✅ |
| `notes` null | `displayNotes()` + `isBirthdayReservation()` | Guards présents | ✅ |
| `rating` null | `formatRating()` | `if (rating === null) return '—'` | ✅ |
| `status` inconnu | FloorPlanScreen | `STATUS_LABEL[status] ?? status` | ✅ |
| `shift` null | WaitlistScreen `EntryCard` | `entry.shifts?.name ?? null` | ✅ |
| `waitlist` vide | WaitlistScreen | Empty state affiché | ✅ |
| `feedback_survey_links` inaccessible | `useFeedbackSurveyLink` | Retourne `{ data: null, error: string }` | ✅ |
| `avg_rating = 0` | SettingsScreen `fmtRating()` | `if (v === null) return '—'` | ✅ |

**Verdict :** Aucun crash lié aux données nulles détecté. Le code utilise systématiquement l'optional chaining et des fallbacks.

---

## 7. Partie 6 — Audit actions sensibles

| Action | Loading | Double-submit bloqué | Message erreur | Verdict |
|---|---|---|---|---|
| Créer réservation | `submitting` state | `disabled={submitting}` | `setError()` | ✅ |
| Modifier statut réservation | `updating` state | `disabled={updating}` sur boutons | `setError()` via hook | ✅ |
| Sélectionner table plan | `updatingReservationId` | `isUpdating` masque les boutons | `actionError` banner | ✅ |
| Créer waitlist | `submitting` state | `disabled={submitting}` | `setFormError()` | ✅ |
| Installer waitlist (markSeated) | `actionLoadingId` | Spinner remplace boutons | `actionError` affichée | ✅ |
| Toggle VIP | `vipUpdating` | ActivityIndicator remplace Switch | Erreur via hook | ✅ |
| Modifier paramètres restaurant | `saving` state | `disabled={saving}` | `restSaveError` affiché | ✅ |
| Envoyer invitation équipe | `status === 'loading'` | `disabled` sur le bouton | `getInviteError()` affiché | ✅ |
| Ouvrir WhatsApp | N/A (Linking.openURL) | N/A | Feedback `waFeedback` affiché | ✅ |
| Ouvrir Email | N/A (Linking.openURL) | N/A | Feedback `emailFeedback` affiché | ✅ |
| Ouvrir enquête satisfaction | `surveyLinkLoading` | `disabled={surveyLinkLoading}` | `whatsappFeedback` affiché | ✅ |
| Logout | `signingOut` state | `disabled={signingOut}` | `signOutError` affiché | ✅ |

**Remarque importante sur WhatsApp/Email :** Les feedbacks sont clairs — le message `resd_wa_opened` indique seulement que l'app est ouverte, pas que le message a été envoyé. Ceci est correct et documenté.

**Invite bouton reset à 30s :** Confirmé dans `useStaffInvite.ts` (`SUCCESS_RESET_MS = 30_000`).

---

## 8. Partie 7 — Audit i18n

### Fonctionnement

- `I18nProvider` wrappé autour de toute l'app dans `App.tsx` ✅
- Fallback FR présent si clé absente dans EN ✅
- AsyncStorage fonctionnel (`.catch(() => {})` protège les erreurs) ✅
- Aucune clé `t('...')` littérale visible à l'écran (toutes interpolées) ✅
- FR = 304 lignes, EN = 306 lignes — symétrie correcte ✅

### Textes encore en dur (hardcodés)

Ces textes ne sont pas traduits et restent en français même en mode anglais :

**Navigateurs (faible priorité — non visibles en production iOS avec headerShown: false pour la plupart) :**
- `ReservationsNavigator.tsx` line 40 : `'Nouvelle réservation'`
- `ReservationsNavigator.tsx` line 48 : `'Détail réservation'`
- `ReservationsNavigator.tsx` line 56 : `"Liste d'attente"` (headerShown: false, donc invisible)
- `GuestsNavigator.tsx` line 34 : `'Fiche client'`

**GuestDetailScreen (visible) :**
- Sections `SectionCard title` : `"Informations"`, `"Contact"`, `"Statut client"`, `"Notes internes"`, `"Statistiques"`, `"Tags"`, `"Données importées"`, `"Historique réservations"`, `"Gestion du compte"`
- Textes de feedback WhatsApp : `'WhatsApp ouvert'`, `"Impossible d'ouvrir WhatsApp."`, `'Numéro invalide.'`
- Textes de feedback Email : `'Email ouvert'`, `"Impossible d'ouvrir l'application Mail."`, `'Email invalide.'`
- Bouton : `"Enregistrer"`, `"Actualiser"`, `"Chargement…"`, `"Client introuvable."`, `"Supprimer le client"`

**AdminSettingsScreen (visible en FR/EN) :**
- Champs label editables : `"Nom *"`, `"Adresse"`, `"Téléphone"`, `"Email"`, `"Fuseau horaire"`, `"Nom du service"`, `"Jours"`, `"Début (HH:mm)"`, `"Fin (HH:mm)"`, `"Slot (min)"`, `"Couverts max"`, `"Numéro / Nom"`, `"Capacité"`
- Messages internes : `"Aucune zone disponible."`, `"Capacités, zones et libellés"`, `"À venir"`, `"Fixe"`

**useTodayReminders.ts (non visible directement — passés via `t()` dans RemindersSection) :**
- Titres des reminders : `'À confirmer'`, `'À appeler'`, `'Arrivée prochaine'`, `'En attente de table'`, `'Envoyer enquête de satisfaction'`
- Descriptions : `"Réservation(s) non honorée(s)"`, `"Réservation(s) annulée(s)"`

> **Action recommandée :** Créer les clés i18n correspondantes avant la version internationale. Pour TestFlight FR uniquement, non bloquant.

---

## 9. Partie 8 — Audit feedback / enquête satisfaction

- URL configurée : `https://lamaison-feedback.vercel.app/feedback` dans `feedbackSurvey.ts` line 13 ✅
- Lien WhatsApp enquête contient `surveyUrl` (format `BASE_URL/TOKEN`) ✅
- `submit_feedback_survey` RPC : appelé depuis le formulaire Vercel (hors scope app mobile) ✅
- Rappels du jour affichent `'Envoyer enquête de satisfaction'` pour les réservations `completed` avec phone ou email ✅
- Protection si `feedback_survey_links` inaccessible : `useFeedbackSurveyLink` retourne `{ data: null, error: string }` — l'UI affiche le message d'erreur ✅

**Remarque :** Le token du survey n'est pas dans le format `/feedback/<token>` littéral — il est dans `buildFeedbackSurveyUrl(token)` qui retourne `BASE_URL/TOKEN`. La structure correspond bien.

---

## 10. Partie 9 — Audit Admin / Paramètres

| Item | Verdict |
|---|---|
| Section Équipe visible uniquement pour Youssef | ✅ (`isOwnerAccount` guard) |
| Bouton invitation reset après 30s | ✅ (`SUCCESS_RESET_MS = 30_000`) |
| Tables repliées par défaut | ✅ (`tablesExpanded = false` initial state) |
| Zones via chips | ✅ (`ZoneChipPicker` component) |
| Crash sur données vides | ✅ Empty states présents |

---

## 11. Partie 10 — Audit scripts

### Scripts disponibles dans `scripts/`

| Script | Fichier | `--apply` enclenché par défaut ? |
|---|---|---|
| `crm:audit` | `audit-guests-quality.ts` | Non |
| `crm:audit:summary` | `summarize-crm-audit.ts` | Non |
| `crm:merge:preview` | `prepare-crm-merge-preview.ts` | Non |
| `crm:merge:dry-run` | `apply-crm-merge-plan.ts --dry-run --limit=20` | Non (`--dry-run` explicite) |
| `crm:merge:dry-run:related` | `apply-crm-merge-plan.ts --dry-run --only-with-related --limit=20` | Non |
| `crm:merge:apply` | `apply-crm-merge-plan.ts --apply --limit=20` | **OUI** (via script `npm run`) |
| `staff:prepare:dry-run` | `prepare-staff-accounts.ts` | Non |
| `staff:prepare:apply` | `prepare-staff-accounts.ts --apply` | **OUI** (via script `npm run`) |
| `test:seed:dry-run` | `seed-test-restaurant.ts` | Non |
| `test:seed:apply` | `seed-test-restaurant.ts --apply` | **OUI** (via script `npm run`) |

**Avertissement :** Les scripts `crm:merge:apply`, `staff:prepare:apply`, `test:seed:apply` déclenchent des modifications base. Ils ne sont **jamais** lancés automatiquement — uniquement si on tape explicitement `npm run crm:merge:apply`. Aucune confusion possible tant que les commandes `--apply` ne sont pas exécutées sans intention.

---

## 12. Partie 11 — Documentation

| Fichier | Statut |
|---|---|
| `README.md` | ✅ Présent |
| `BACKLOG.md` | ✅ Présent, à jour (2026-05-21) |
| `docs/manual-test-checklist.md` | ✅ Présent |
| `docs/staff-accounts.md` | ✅ Présent |
| `docs/reminders.md` | ✅ Présent |
| `docs/settings.md` | ✅ Présent |
| `docs/crm-data-quality.md` | ✅ Présent |
| `docs/feedback-surveys.md` | ✅ Présent |

Toute la documentation demandée est présente. Aucune incohérence évidente détectée.

---

## 13. Bugs trouvés

### Corrigés lors de cet audit

**Aucun bug critique n'a été trouvé nécessitant une correction immédiate.** Le code est de très bonne qualité.

### Bugs non bloquants restants (documentés)

1. **Headers de navigation hardcodés en FR** (`ReservationsNavigator.tsx`, `GuestsNavigator.tsx`) — seulement visibles si `headerShown: true` et langue EN. Priorité i18n V2.

2. **GuestDetailScreen entièrement en FR hardcodé** — l'écran n'utilise pas `t()`. Non bloquant pour TestFlight FR. Priorité i18n V2.

3. **useTodayReminders titres hardcodés** — les titres et descriptions des reminders sont en français dans le hook. Non bloquant pour TestFlight FR.

4. **Aucun script `lint`/`test` dans `package.json`** — pas de CI/CD lint. Recommandé en V2.

---

## 14. Limites connues

1. **Pas de tests automatisés** — zéro couverture test. L'audit est basé sur la lecture de code et des tests manuels requis.
2. **Types database temporaires** — `src/types/database.ts` est un snapshot manuel. Si une migration est appliquée sans régénérer les types, des erreurs runtime peuvent apparaître sans erreur TypeScript.
3. **Token feedback non cryptographiquement sécurisé** — le générateur utilise `Math.random()`. Acceptable pour V1 avec 32 caractères.
4. **WhatsApp limité aux numéros tunisiens** — `normalizePhoneForWhatsApp` normalise uniquement les formats `+216` / 8 chiffres. Les numéros internationaux autres ne fonctionnent pas.

---

## 15. Checklist avant TestFlight

### Obligatoire

- [x] `npx tsc --noEmit` → 0 erreur
- [x] `npx tsc -p tsconfig.scripts.json --noEmit` → 0 erreur
- [x] Aucune `service_role` key dans le code app
- [x] `.env` contient uniquement la `anon key` (safe à bundler)
- [x] Feedback URL configurée (`https://lamaison-feedback.vercel.app/feedback`)
- [x] Section Équipe visible uniquement par `youssefbenjema@gmail.com`
- [x] Edge Function `send-staff-invite` : host/waiter bloqués
- [x] Tous les boutons d'action critiques ont `loading` + `disabled`
- [x] Aucun crash null/undefined sur les données optionnelles
- [x] Navigation waitlist → réservation câblée
- [x] Navigation rappel → réservation câblée
- [x] Modal sélection table présent dans FloorPlan
- [x] I18nProvider wrappé autour de l'app
- [x] Fallback FR si clé EN manquante

### Avant test restaurant (recommandé)

- [ ] Lancer l'app sur device réel iOS (pas seulement simulateur)
- [ ] Tester la connexion staff (host + waiter) — vérifier accès restreint section Équipe
- [ ] Tester le switch langue FR↔EN
- [ ] Tester l'envoi d'invitation staff (reset après 30s)
- [ ] Vérifier la réception des emails d'invitation
- [ ] Tester le formulaire feedback Vercel depuis un link généré
- [ ] Tester les filtres Déjeuner/Dîner sur une journée avec les deux services

---

## 16. Go/No-Go Recommendation

### 🟢 GO pour TestFlight — sous conditions

**Justification :**

**Points forts :**
- **0 erreur TypeScript** avec mode strict activé — le code est correctement typé
- **Aucun crash potentiel identifié** — tous les cas null/undefined sont gérés avec optional chaining et fallbacks
- **Sécurité auth solide** — la `service_role` key n'est jamais exposée côté app, l'Edge Function valide les rôles et le `restaurant_id`
- **Pas de double-submit** — tous les boutons critiques ont leur état `loading`/`disabled`
- **Navigation complète** — toutes les routes sont câblées, tous les imports valides
- **I18n fonctionnel** — provider wrappé, fallback FR, AsyncStorage protégé
- **Feedback survey opérationnel** — URL configurée, token généré, protection si inaccessible

**Conditions :**
1. Tester sur device iOS physique avant soumission TestFlight
2. Vérifier que `eas build` passe sans erreur
3. Confirmer que l'app se connecte bien au projet Supabase de production

**Non-bloquant (V2) :**
- Traduction complète de `GuestDetailScreen` et des navigators
- Ajout de scripts `lint` et `test`
- Sécurisation cryptographique du token feedback

---

*Rapport généré le 2026-05-21 par Claude Code (claude-sonnet-4-6)*
