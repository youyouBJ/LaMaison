# La Maison

Application mobile de gestion des réservations pour le restaurant La Maison.
Conçue pour remplacer SelenRooms et évoluer vers un SaaS multi-restaurants.

## Stack

- **React Native** + **Expo** (SDK 54)
- **TypeScript** strict
- **Supabase** — Auth + Base de données
- **React Navigation** — AuthStack + Bottom Tabs
- **react-native-reanimated** + **react-native-gesture-handler**
- Polices : Playfair Display (titres) + Inter (corps)

## Installation

```bash
npm install
```

## Lancer l'app

```bash
npx expo start
```

Scanne ensuite le QR code avec **Expo Go** (iOS ou Android).

Pour cibler directement un simulateur :

```bash
npx expo start --ios
npx expo start --android
```

## Variables d'environnement

Copie `.env.example` en `.env` à la racine du projet et renseigne tes valeurs :

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL de ton projet Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé publique (anon/publishable) Supabase |

> **Important** : ne commite jamais le fichier `.env`. Il est déjà ajouté au `.gitignore`.
> Seul `.env.example` doit être versionné.
