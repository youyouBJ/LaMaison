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

Le fichier `.env` doit contenir les deux variables suivantes (ne jamais les committer) :

```
EXPO_PUBLIC_SUPABASE_URL=https://nosflczsevtrxnyienyn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<clé anon publique>
```

Pour les builds EAS, configurer les mêmes variables dans le dashboard EAS :
- Aller sur [expo.dev](https://expo.dev) → projet → **Environment Variables**
- Ajouter `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Profils concernés : `production`, `preview`

> **Important :** Ne jamais mettre la `service_role` key dans les variables EAS. Elle n'appartient qu'à `.env.import` côté scripts locaux.

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

## Assets requis pour App Store

L'app utilise les assets suivants (présents dans `assets/`) :
- `icon.png` — 1024×1024 px requis pour App Store
- `splash-icon.png` — utilisé comme splash screen

> **Note :** Les assets actuels sont les assets Expo par défaut. Remplacer par les assets La Maison (logo, couleurs) avant soumission en production.

---

## Problèmes fréquents

### Build échoue : "No bundle identifier"
→ Vérifier que `ios.bundleIdentifier` est présent dans `app.json`

### Build échoue : "Missing credentials"
→ Lancer `eas credentials` pour configurer les certificats iOS

### Build échoue : "EXPO_PUBLIC_* not found"
→ Configurer les variables sur expo.dev → Environment Variables

### App crash au démarrage : Supabase unreachable
→ Vérifier les variables d'env dans EAS Dashboard  
→ Vérifier que l'URL Supabase pointe vers `nosflczsevtrxnyienyn`

### Lien invitation ne fonctionne pas sur device
→ Configurer les Redirect URLs dans Supabase Auth Dashboard  
→ Vérifier que `scheme` est configuré dans `app.json` si deep links utilisés

---

*Document créé le 2026-05-21*
