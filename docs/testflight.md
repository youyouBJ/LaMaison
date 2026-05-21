# TestFlight — Guide de build iOS

**Projet :** La Maison  
**Bundle ID :** `com.lamaison.restaurant`  
**Version :** 1.0.0 (build auto-incrémenté par EAS)  
**Supabase project :** `nosflczsevtrxnyienyn`

---

## Prérequis Apple Developer

- [ ] Compte Apple Developer actif (99 $/an) — [developer.apple.com](https://developer.apple.com)
- [ ] App créée dans App Store Connect avec le bundle ID `com.lamaison.restaurant`
- [ ] Apple Team ID disponible (visible dans Developer → Membership)
- [ ] Certificats de distribution gérés par EAS (recommandé : laisser EAS les créer)

---

## Prérequis Expo / EAS

- [ ] Compte Expo créé sur [expo.dev](https://expo.dev)
- [ ] EAS CLI installé : `npm install -g eas-cli`
- [ ] Connexion Expo : `eas login`
- [ ] Projet lié à Expo : `eas build:configure` (génère un `extra.eas.projectId` dans app.json)

---

## Variables d'environnement

### Développement local

Le fichier `.env` doit contenir les deux variables suivantes (ne jamais les committer) :

```
EXPO_PUBLIC_SUPABASE_URL=https://nosflczsevtrxnyienyn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé anon publique>
```

### Builds EAS (production / preview)

Les variables `EXPO_PUBLIC_*` sont baked-in dans le bundle natif au moment du build par Metro.
EAS les injecte uniquement si elles sont déclarées dans l'environnement correspondant **et** que
`eas.json` contient `"environment": "production"` (ou `"preview"`) dans le profil de build.

**Sans ce champ, les variables ne sont pas injectées** → `process.env.EXPO_PUBLIC_*` vaut
`undefined` dans le bundle → l'app crashe au démarrage avec un écran blanc.

#### Visibilité des variables

| Visibilité | Injectée dans le bundle natif | À utiliser pour |
|---|---|---|
| **Plain text** | Oui | Variables non sensibles |
| **Sensitive** | Oui (masquée dans les logs) | Clés publiques (anon key) |
| **Secret** | **Non** | Variables serveur uniquement (ex: service_role) |

> Utiliser **Sensitive** pour `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé publique mais à ne pas exposer
> dans les logs). Ne jamais mettre la `service_role` key ici — elle n'appartient qu'à
> `.env.import` côté scripts locaux.

#### Créer les variables via EAS CLI

```bash
# Profil production
npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL \
  --value "https://nosflczsevtrxnyienyn.supabase.co" --visibility plaintext

npx eas-cli env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value "..." --visibility sensitive

# Profil preview (mêmes valeurs si même projet Supabase)
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL \
  --value "https://nosflczsevtrxnyienyn.supabase.co" --visibility plaintext

npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value "..." --visibility sensitive
```

#### Créer les variables via le Dashboard

[expo.dev](https://expo.dev) → projet `lamaison` → **Environment variables** → sélectionner
l'environnement `production` → **Create variable** → renseigner nom, valeur, visibilité.

Variables à créer :

| Nom | Valeur | Visibilité |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://nosflczsevtrxnyienyn.supabase.co` | Plain text |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clé anon Supabase | Sensitive |

#### Vérifier que les variables sont bien lues

Après le build, vérifier dans les logs EAS que la ligne suivante **n'apparaît pas** :
```
No environment variables with visibility Plain text and Sensitive found for the production environment on EAS.
```

Si cette ligne apparaît → les variables ne sont pas créées dans EAS ou le profil `eas.json`
n'a pas `"environment": "production"`.

---

## Compléter eas.json avant la soumission App Store

Les champs `ascAppId` et `appleTeamId` **ne sont pas encore renseignés** dans `eas.json`.
EAS refuse les chaînes vides — ils seront ajoutés après création de l'app dans App Store Connect.

**Quand ajouter ces champs :**  
Après avoir créé l'app dans App Store Connect avec le bundle ID `com.lamaison.restaurant`.

**Comment les ajouter :**  
Ouvrir `eas.json` et ajouter dans `submit.production.ios` :

```json
"ascAppId": "VOTRE_APP_STORE_CONNECT_APP_ID",
"appleTeamId": "VOTRE_TEAM_ID"
```

- `ascAppId` : App Store Connect → App → App Information → Apple ID (numéro à 10 chiffres)
- `appleTeamId` : [developer.apple.com](https://developer.apple.com) → Account → Membership Details → Team ID

> Ces champs sont nécessaires uniquement pour `eas submit`. Le build EAS fonctionne sans eux.

---

## Commandes à lancer dans l'ordre

### 1. Installer EAS CLI (si pas encore fait)

```bash
npm install -g eas-cli
```

### 2. Se connecter à Expo

```bash
eas login
```

### 3. Lier le projet Expo (une seule fois)

```bash
eas build:configure
```

Cette commande ajoute un `extra.eas.projectId` dans `app.json`. Committer ce changement.

### 4. Vérification finale avant build

```bash
npx tsc --noEmit
npx expo-doctor
```

Les deux doivent passer sans erreur.

### 5. Build iOS pour TestFlight (profil production)

```bash
eas build --platform ios --profile production
```

Le build se fait dans le cloud EAS. Durée estimée : 10–20 minutes.  
Un lien vers le build est retourné dans le terminal.

### 6. Soumettre vers App Store Connect (optionnel, après build réussi)

```bash
eas submit --platform ios --profile production
```

Cela envoie l'`.ipa` directement vers App Store Connect pour TestFlight.

---

## Ajouter des testeurs TestFlight

Dans App Store Connect → TestFlight :
- **Test interne** : ajouter des membres de l'équipe Apple Developer (pas de review Apple)
- **Test externe** : ajouter par email (nécessite une Beta App Review, ~24h)

Testeurs à ajouter en priorité :
- Youssef (admin)
- Anis (manager)
- iPad Resto (host)

---

## Auth redirect URLs (liens invitation staff)

L'Edge Function `send-staff-invite` envoie un email Supabase Auth avec un lien de type :  
`https://nosflczsevtrxnyienyn.supabase.co/auth/v1/verify?token=...&redirect_to=REDIRECT_URL`

Pour TestFlight, la `REDIRECT_URL` doit pointer vers une page accessible (web ou deep link).

**Configuration actuelle :**
- Vérifier dans le Dashboard Supabase → Auth → URL Configuration :
  - **Site URL** : doit correspondre à l'URL de redirection attendue
  - **Redirect URLs** : ajouter les URLs nécessaires (app scheme ou URL web)

**Si deep links sont configurés :**
- Ajouter `com.lamaison.restaurant://` dans les Redirect URLs Supabase
- Configurer `scheme` dans `app.json` → `"scheme": "lamaison"`

Pour l'instant (V1), l'invitation ouvre une page web. Vérifier que cette page est accessible depuis un lien email avant TestFlight.

---

## Profils EAS

| Profil | Usage | Distribution | Auto-increment |
|---|---|---|---|
| `development` | Dev local + simulateur | Interne | Non |
| `preview` | Tests sur device physique | Interne (ad hoc) | Non |
| `production` | TestFlight + App Store | Store | **Oui** |

---

## Checklist avant build production

- [ ] `npx tsc --noEmit` → 0 erreur
- [ ] `npx expo-doctor` → 17/17 checks passed
- [ ] `app.json` : `bundleIdentifier`, `buildNumber`, `version` corrects
- [ ] Variables EAS configurées sur expo.dev
- [ ] `eas.json` : `ascAppId` et `appleTeamId` renseignés
- [ ] App créée dans App Store Connect avec le bon bundle ID
- [ ] `.env` avec les bonnes clés de production (jamais committé)
- [ ] Edge Function `send-staff-invite` déployée sur Supabase production
- [ ] Test sur simulateur iOS validé
- [ ] Test sur device physique iOS validé

---

## Assets TestFlight — La Maison

L'app utilise les assets suivants (présents dans `assets/`) :

| Fichier | Dimensions | Fond | Usage |
|---|---|---|---|
| `icon.png` | 1024×1024 | Crème `#F5F0E8` (opaque) | Icône iOS App Store / TestFlight |
| `adaptive-icon.png` | 1024×1024 | Transparent + `#F5F0E8` via app.json | Icône Android (adaptive) |
| `splash-icon.png` | 1024×1024 | Transparent + `#F5F0E8` via app.json | Splash screen au démarrage |

Logo source : `assets/logo-source.png` (1024×768 RGBA, logo doré sur fond transparent).

> **Statut :** Icône et splash La Maison configurés — l'icône Expo par défaut n'est plus utilisée.  
> **V2 / App Store final :** Si un logo vectoriel HD est disponible, remplacer les assets par une version haute résolution avant la soumission officielle App Store.

---

## Problèmes fréquents

### Build échoue : "No bundle identifier"
→ Vérifier que `ios.bundleIdentifier` est présent dans `app.json`

### Build échoue : "Missing credentials"
→ Lancer `eas credentials` pour configurer les certificats iOS

### Build échoue : "EXPO_PUBLIC_* not found"
→ Configurer les variables sur expo.dev → Environment Variables

### Écran blanc au démarrage (TestFlight)
→ Cause la plus probable : `EXPO_PUBLIC_SUPABASE_URL` ou `EXPO_PUBLIC_SUPABASE_ANON_KEY` absentes du bundle  
→ Vérifier que `eas.json` profil `production` contient `"environment": "production"`  
→ Vérifier que les variables sont créées dans EAS Dashboard avec visibilité **Plain text** ou **Sensitive** (pas **Secret**)  
→ Relancer `eas build --platform ios --profile production` après correction

### App crash au démarrage : Supabase unreachable
→ Vérifier les variables d'env dans EAS Dashboard  
→ Vérifier que l'URL Supabase pointe vers `nosflczsevtrxnyienyn`

### Lien invitation ne fonctionne pas sur device
→ Configurer les Redirect URLs dans Supabase Auth Dashboard  
→ Vérifier que `scheme` est configuré dans `app.json` si deep links utilisés

---

## Dataset test immersif

Le compte testeur TestFlight (`musicybj@gmail.com`, rôle `host`) est lié uniquement à **"La Maison Test"**.
Un dataset fictif riche est disponible pour tester toutes les fonctionnalités de l'app dans des conditions réalistes.

### Ce que le dataset contient

| Type               | Volume        | Détails |
|--------------------|---------------|---------|
| Tables             | ~20           | 5 zones : Salle, Terrasse, Balcon, Bar, Lounge |
| Clients fictifs    | ~120          | Noms tunisiens, téléphones `+21699XXXXXX`, emails `@lamaison-test.local` |
| Réservations       | ~180          | -30j → aujourd'hui → +30j, tous statuts |
| Waitlist           | ~18           | waiting / notified / seated / left |
| Feedback surveys   | ~30           | Liés à des réservations completed passées |
| Multi-tables       | oui           | `reservation_tables` (T12 + T19) |

### Cas de test ciblés aujourd'hui

- 2 réservations **pending** → rappels urgents
- 1 réservation **confirmed** dans ~30 min → "Arrivée prochaine"
- 2 réservations **seated** → plan de salle
- 3 réservations **completed** avec email → enquête de satisfaction
- 1 réservation **cancelled**
- 3 entrées waitlist **waiting** → liste d'attente du jour

### Isolation — le vrai restaurant n'est pas touché

Le script vérifie explicitement que `restaurant.name = "La Maison Test"` avant toute insertion.
Si ce n'est pas le cas, il s'arrête immédiatement. Les RLS Supabase (`restaurant_id`) garantissent
que le testeur ne voit que les données de "La Maison Test".

### Commandes

```bash
# Aperçu sans modification (obligatoire avant apply)
npm run test:seed:rich:dry-run

# Application du dataset (idempotent — relancer ne crée pas de doublons)
npm run test:seed:rich:apply -- --confirm=SEED_RICH_TEST_DATA
```

> ⚠️  Lancez toujours le dry-run avant l'apply pour confirmer la cible.

### Permissions requises

Le script utilise `service_role` (clé dans `.env.import`).
Assurez-vous que `supabase/manual/grant_service_role.sql` a été exécuté dans Supabase → SQL Editor.

Pour les feedbacks, ajoutez également :
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.feedback_survey_links TO service_role;
GRANT SELECT, INSERT ON TABLE public.feedback_surveys TO service_role;
```

---

*Document créé le 2026-05-21. Mis à jour le 2026-05-21 (dataset test immersif).*
