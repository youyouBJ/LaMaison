# Dashboard — Architecture et KPIs

L'onglet **Accueil** et l'onglet **Admin** servent des rôles distincts. Ceux-ci ne doivent pas être fusionnés.

---

## Accueil (`DashboardScreen`)

**Rôle :** Vue opérationnelle du service en cours. Données du jour uniquement, mise à jour en temps réel.

**Hooks :**

| Hook | Données |
|---|---|
| `useTodayDashboard` | Réservations du jour avec guest/table/shift, statistiques `DashboardStats`, `restaurantId` |
| `useDashboardExtended` | Waitlist en attente du jour, compteurs clients globaux (SevenRooms) |

**KPIs affichés :**

| KPI | Source |
|---|---|
| Total réservations | `stats.total` (toutes statuts) |
| Couverts actifs | `stats.totalCovers` (hors cancelled/noshow) |
| Confirmées | `stats.confirmed` |
| À table | `stats.seated` |
| En attente | `stats.byStatus.pending` |
| Terminées | `stats.byStatus.completed` |
| Waitlist | `ext.waitlistPending` |
| À appeler | `reservations.filter(reservationNeedsPhoneConfirmation).length` |

**Sections :**
1. Vue d'ensemble — KPIs du jour
2. Prochaines arrivées — liste triée par créneau (max 8)
3. Actions rapides — navigation vers Réservations, Plan, Attente, Clients

**Realtime :** `useTodayDashboard` souscrit aux changements `postgres_changes` sur la table `reservations` pour le restaurant. L'UI est mise à jour instantanément dès qu'une réservation est créée, modifiée ou supprimée.

---

## Admin (`SettingsScreen`)

**Rôle :** Pilotage avancé avec analyse par période + configuration du restaurant.

**Hooks :**

| Hook | Données |
|---|---|
| `useSettingsOverview` | Restaurant, profil staff, shifts, plan de salle, compteurs guests |
| `usePeriodStats` | KPIs réservations + feedback_surveys pour la période sélectionnée |
| `useDashboardExtended` | Données SevenRooms (`avg_rating`) + waitlist |

**Sélecteur de période :**

| Option | Plage |
|---|---|
| Aujourd'hui | date du jour |
| 7 jours | J-6 → J |
| 30 jours | J-29 → J |
| Mois | 1er du mois → J |
| Année | 1er janvier → J |

La plage est calculée par `getPeriodDateRange()` dans `src/hooks/usePeriodStats.ts`, en heure locale Tunis (Africa/Tunis, UTC+1 sans DST).

**Sections Pilotage :**

1. **Réservations** — total, couverts, confirmées, terminées, en attente, à table, annulées (+taux), no-show (+taux), walk-ins, clients uniques, anniversaires, événements
2. **Services** — réservations déjeuner / dîner avec couverts (classement par `time_slot` : 12:00–16:45 = déjeuner, 17:00–23:45 = dîner)
3. **Répartition statuts** — grille 2 colonnes avec pilules colorées
4. **Satisfaction client** — voir section dédiée ci-dessous

**Sections Configuration :**
- Restaurant (nom, adresse, fuseau horaire…)
- Compte staff (nom, rôle)
- Services (shifts : horaires, créneaux, couverts max)
- Plan de salle (tables par zone)
- Données clients (totaux depuis `useSettingsOverview`)

---

## Satisfaction client

La section satisfaction est **unifiée** dans Admin. Elle combine deux sources indépendantes.

### Source 1 — Import SevenRooms

**Champ :** `guests.avg_rating`  
**Filtre :** `NOT NULL AND > 0` (les valeurs `0` signifient "non noté" dans l'export SevenRooms — elles sont exclues pour éviter de fausser la moyenne)  
**Période :** Toutes périodes confondues — le champ ne porte pas de date par client.  
**Hook :** `useDashboardExtended` → `ext.sevenRooms.count` et `ext.sevenRooms.avgRating`

Affiche : nombre de clients notés + note moyenne globale + disclaimer "toutes périodes confondues".

### Source 2 — Enquêtes in-app (`feedback_surveys`)

**Table :** `feedback_surveys`  
**Filtre période :** `created_at.substring(0, 10) >= start && <= end` (UTC, précision ±1h autour de minuit heure Tunis)  
**Hook :** `usePeriodStats` → `period.feedback`

Affiche : nombre d'avis, note globale (1–5), cuisine, boissons, service, ambiance, taux de recommandation, dernier commentaire.

### Règles importantes

- Ne jamais inclure `avg_rating = 0` dans la moyenne SevenRooms — cela produirait un score faussement bas (~0,9/5 au lieu de ~4,4/5).
- Les deux sources ne sont **pas comparables** : SevenRooms agrège l'historique, les enquêtes in-app reflètent la période récente.
- Ne pas filtrer les enquêtes in-app par période côté Supabase — le volume attendu (< 5 000 lignes) permet le filtrage client-side sans problème de performance.

---

## Hooks — résumé

### `useTodayDashboard`

```typescript
return { loading, error, reservations, stats, refresh, restaurantId }
```

- Souscription realtime (postgres_changes)
- `stats: DashboardStats` pré-calculé (total, covers, byStatus, lunchCount…)
- Source de vérité pour les KPIs du jour dans Accueil

### `useDashboardExtended`

```typescript
return { loading, stats: { waitlistPending, clients, sevenRooms }, refresh }
```

- `waitlistPending` : count Supabase (head:true) — pas de données chargées
- `clients` : 6 counts légers (total, VIP, withPhone, withEmail, withoutPhone, withoutEmail)
- `sevenRooms.count` et `sevenRooms.avgRating` : calculés depuis `guests.avg_rating > 0`

### `usePeriodStats`

```typescript
return { loading, stats: { reservations, feedback }, refresh }
```

- Protection race condition via `fetchIdRef` counter
- `reservations: PeriodReservationStats` — calculé client-side depuis les lignes brutes
- `feedback: PeriodFeedbackStats | null` — null si erreur DB, sinon calculé client-side

---

## Limites connues

- `usePeriodStats` charge toutes les `feedback_surveys` du restaurant puis filtre en mémoire. Si le volume dépasse 5 000 lignes, envisager un filtre côté Supabase (`gte('created_at', start)`, `lte('created_at', end)`).
- Le filtre période sur `feedback_surveys` utilise `created_at` UTC. Pour un restaurant en UTC+1, les avis de minuit à 1h du matin peuvent apparaître sur le mauvais jour.
- `guests.avg_rating` est global (pas de date). Pour une analyse temporelle des notes SevenRooms, il faudra importer l'historique détaillé avec dates.
- La limite Supabase par défaut est 1 000 lignes par requête. Si `guests` avec `avg_rating > 0` dépasse 1 000, la requête de `useDashboardExtended` retournera une moyenne tronquée. Ajouter `.range(0, 9999)` ou une pagination si nécessaire.
