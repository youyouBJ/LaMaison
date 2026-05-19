# Plan de salle — La Maison

## Vue d'ensemble

Plan interactif affiché dans l'onglet **Floor** de l'app. Permet de visualiser et gérer les tables en temps réel pendant le service.

---

## Architecture

### Fichiers principaux

| Fichier | Rôle |
|---|---|
| `src/utils/floorPlanLayout.ts` | Coordonnées statiques de toutes les tables et zones |
| `src/components/FloorCanvas.tsx` | Rendu du canvas (fond, zones, séparateurs, comptoirs) |
| `src/components/FloorTable.tsx` | Composant table cliquable avec statut coloré |
| `src/components/FloorZoneLabel.tsx` | Labels de zones |
| `src/hooks/useFloorPlan.ts` | Logique : fetch tables, réservations du jour, actions service, realtime |
| `src/screens/floor/FloorPlanScreen.tsx` | Écran principal |
| `scripts/seed-floor-plan.ts` | Script de seed des tables en base |

### Seed

```bash
npm run seed:floor
```

Insère les tables physiques dans la table `tables` de Supabase. Idempotent : ne duplique pas les tables existantes.

---

## Coordonnées du plan

Toutes les positions sont exprimées en **pourcentage (%) de la largeur/hauteur du canvas**. Cela garantit un rendu correct sur toutes les tailles d'écran.

Les coordonnées ont été définies avec Claude Design à partir d'un relevé du restaurant.

---

## Zones

6 zones visuelles, chacune avec une couleur de fond et un label :

| Clé | Nom affiché | Description |
|---|---|---|
| `bar_central` | Bar Central | Tabourets le long du comptoir principal (tables 1–12) |
| `bar_cigare` | Bar Salon Cigare | Espace bar fumeur / salon (tables 15, 31, 32) |
| `interieur` | Restaurant Intérieur | Salle principale (tables 21–46, 61–62) |
| `balcon` | Restaurant Balcon | Terrasse couverte (tables 51–54, 63–68, 111–112) |
| `terrasse` | Restaurant Terrasse | Terrasse extérieure (tables 71–86) |
| `lounge` | Lounge / Lounge Bar | Espace lounge (tables 101–106, 114–116) |

---

## Tables

Environ 65 tables au total. Chaque table a :
- `id` : numéro affiché sur le plan (correspondant au numéro réel du restaurant)
- `zone` : une des 6 clés de zone
- `shape` : `round`, `rect`, `square`, ou `diamond`
- `x`, `y` : position en % depuis le coin supérieur gauche du canvas
- `w`, `h` : dimensions en %
- `capacity` : nombre de couverts

---

## Style visuel

Style sombre premium, inspiré de l'identité La Maison.

| Élément | Couleur |
|---|---|
| Fond canvas | `#201B17` (brun très foncé chaud) |
| Bordure canvas | `rgba(184, 151, 58, 0.20)` (or discret) |
| Table libre | Fond `#172D22`, bordure `#3D8B68`, texte `#7DCCA8` |
| Table réservée | Fond `#2A2208`, bordure `#C4A838`, texte `#E8CA50` |
| Table installée | Fond `#2A1010`, bordure `#C03535`, texte `#E88080` |
| Table indisponible | Fond `#202020`, bordure `#555555`, texte `#888888` |
| Sélection | Bordure `#D4AA40`, halo `rgba(212, 170, 64, 0.85)` |

---

## Statuts de table

| Statut en base | Affiché | Couleur |
|---|---|---|
| `free` | Libre | Vert |
| `reserved` | Réservé | Or |
| `occupied` | Installé | Rouge |
| `unavailable` | Indispo | Gris |

Le statut est mis à jour dans la table `tables` de Supabase. Le Realtime propage les changements instantanément.

---

## Actions disponibles selon le statut

| Statut actuel | Actions |
|---|---|
| `free` | Créer réservation, Walk-in |
| `reserved` | Confirmer (→ occupied), No-show (→ free), Annuler (→ free) |
| `occupied` | Terminer (→ free), No-show (→ free) |
| `unavailable` | (pas d'action depuis le plan) |

---

## Multi-tables

On peut lier plusieurs tables à une réservation depuis le plan :
1. Tapper la première table → sélection
2. Tapper d'autres tables → ajout à la sélection
3. Valider → `reservation_tables` est alimenté avec toutes les tables sélectionnées

---

## Realtime

Le hook `useFloorPlan` écoute deux channels :
- `tables` : statuts live des tables
- `reservations` : réservations du jour (pour afficher le nom du client sur la table)

Tout changement de statut (via actions service ou depuis l'onglet réservations) est reflété instantanément sur le plan.

---

## Modifier une table

Pour ajuster la position ou la taille d'une table :

1. Ouvrir `src/utils/floorPlanLayout.ts`
2. Trouver la table par son `id`
3. Modifier `x`, `y`, `w`, `h` (valeurs en % du canvas)
4. Tester dans Expo Go
5. Commiter

Les coordonnées sont validées visuellement — il n'y a pas de test automatique du layout.

---

## Ajouter une nouvelle table

1. Dans `floorPlanLayout.ts` → ajouter un objet dans `LA_MAISON_FLOOR_TABLES`
2. Dans le seed (`scripts/seed-floor-plan.ts`) → s'assurer que la table est bien insérée en base
3. Relancer `npm run seed:floor`
4. Régénérer les types si le schéma a changé : `npx tsc --noEmit`
