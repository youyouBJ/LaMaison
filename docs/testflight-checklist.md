# Checklist TestFlight — La Maison

---

## Informations générales

| Champ | Valeur |
|---|---|
| **Build** | _(à compléter : numéro de build EAS)_ |
| **Date du test** | _(à compléter)_ |
| **Testeur** | _(à compléter : prénom + nom)_ |
| **Appareil** | _(iPhone / iPad — modèle exact, ex: iPhone 15 Pro)_ |
| **iOS version** | _(à compléter, ex: iOS 18.3)_ |
| **Compte utilisé** | `musicybj@gmail.com` (compte testeur) ou compte staff réel |
| **Environnement** | La Maison Test (compte testeur) ou La Maison réel (staff) |

> **Important pour les testeurs externes :**  
> Utiliser **uniquement** le compte `musicybj@gmail.com` et l'environnement **La Maison Test**.  
> Ne jamais utiliser les comptes réels du restaurant — les données clients et réservations réels sont confidentielles.

---

## Dataset de test disponible

Le compte testeur `musicybj@gmail.com` a accès à un dataset immersif préconstruit pour **La Maison Test** :

| Type | Volume | Détails |
|---|---|---|
| Tables | T1–T5 | Plan de salle non modifié |
| Clients fictifs | ~120 | Noms tunisiens, tél `+21699XXXXXX`, emails `@lamaison-test.local` |
| Réservations | ~180 | -30j → aujourd'hui → +30j, tous statuts représentés |
| Waitlist | ~18 | waiting / notified / seated / left |
| Enquêtes satisfaction | ~30 | Liées à des réservations completed passées |
| Multi-tables | oui | reservation_tables |

**Cas du jour préchargés :**
- 2 réservations `pending` → rappels urgents visibles sur le Dashboard
- 1 réservation `confirmed` dans ~30 min → "Arrivée prochaine"
- 2 réservations `seated` → visibles sur le plan
- 3 réservations `completed` avec email → enquête satisfaction à envoyer
- 1 réservation `cancelled`
- 3 entrées waitlist `waiting` → liste d'attente du jour

---

## Légende des statuts

| Case | Signification |
|---|---|
| `- [ ] À faire` | Pas encore testé |
| `- [x] OK` | Testé et fonctionnel |
| `- [ ] Bug` | Problème observé — noter dans la section Bugs |
| `- [ ] À revoir` | Comportement incertain ou à confirmer |

---

## Section 1 — Installation TestFlight

**Objectif :** Vérifier que l'app s'installe et se lance correctement depuis TestFlight.

**Prérequis :** Avoir reçu l'invitation TestFlight par email.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 1.1 | Installer TestFlight depuis l'App Store | TestFlight installé | - [ ] À faire | |
| 1.2 | Ouvrir l'email d'invitation TestFlight | Lien "Afficher dans TestFlight" visible | - [ ] À faire | |
| 1.3 | Accepter l'invitation dans TestFlight | App "La Maison" visible dans la liste | - [ ] À faire | |
| 1.4 | Installer La Maison via TestFlight | Téléchargement et installation sans erreur | - [ ] À faire | |
| 1.5 | Vérifier l'icône sur l'écran d'accueil | Icône La Maison (fond crème, logo doré) — pas l'icône Expo | - [ ] À faire | |
| 1.6 | Ouvrir l'app | Splash screen affiché, puis écran de connexion | - [ ] À faire | |
| 1.7 | Vérifier absence d'écran blanc | Aucun écran blanc, aucun crash au démarrage | - [ ] À faire | |

---

## Section 2 — Connexion

**Objectif :** Vérifier que le login fonctionne correctement, y compris les cas d'erreur.

**Prérequis :** App installée via TestFlight.  
**Compte testeur :** `musicybj@gmail.com`

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 2.1 | Saisir un email invalide (ex : `test`) | Message d'erreur clair, bouton non bloqué | - [ ] À faire | |
| 2.2 | Laisser le mot de passe vide | Message d'erreur de validation | - [ ] À faire | |
| 2.3 | Saisir le bon email, mauvais mot de passe | Message d'erreur Supabase affiché ("Invalid login credentials") | - [ ] À faire | |
| 2.4 | Se connecter avec `musicybj@gmail.com` + bon mot de passe | Redirection vers le Dashboard | - [ ] À faire | |
| 2.5 | Pendant la connexion : vérifier bouton | Bouton "Se connecter" désactivé (pas de double-envoi) | - [ ] À faire | |
| 2.6 | Se déconnecter (Paramètres) | Retour à l'écran de connexion | - [ ] À faire | |
| 2.7 | Se reconnecter | Dashboard affiché correctement | - [ ] À faire | |
| 2.8 | Fermer l'app complètement, rouvrir | Session restaurée automatiquement → Dashboard direct | - [ ] À faire | |

---

## Section 3 — Accueil / Dashboard

**Objectif :** Vérifier que le dashboard affiche les bonnes données du jour pour La Maison Test.

**Prérequis :** Connecté avec `musicybj@gmail.com`.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 3.1 | Ouvrir l'onglet Accueil | KPIs du jour affichés (couverts, confirmées, seated, en attente) | - [ ] À faire | |
| 3.2 | Vérifier KPIs numériques | Chiffres cohérents avec le dataset test (~180 réservations) | - [ ] À faire | |
| 3.3 | Vérifier section "Rappels du jour" | Au moins 2 rappels pending + 3 enquêtes satisfaction + 3 waitlist | - [ ] À faire | |
| 3.4 | Vérifier section "Prochaines arrivées" | Au moins 1 arrivée dans 30 min (réservation confirmed) | - [ ] À faire | |
| 3.5 | Tapper un rappel "À confirmer" | Navigation vers la réservation correspondante | - [ ] À faire | |
| 3.6 | Tapper une "Prochaine arrivée" | Navigation vers la réservation | - [ ] À faire | |
| 3.7 | Appuyer sur Actualiser (bouton ou pull-to-refresh) | Données rechargées sans crash | - [ ] À faire | |
| 3.8 | Tester les actions rapides (Réservations, Plan, Attente, Clients) | Navigation correcte vers chaque section | - [ ] À faire | |

---

## Section 4 — Liste des réservations

**Objectif :** Vérifier la navigation, les filtres et la recherche dans la liste des réservations.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 4.1 | Ouvrir l'onglet Réservations | Liste des réservations du jour affichée | - [ ] À faire | |
| 4.2 | Changer la date (sélecteur calendrier) | Réservations de la date choisie affichées | - [ ] À faire | |
| 4.3 | Naviguer vers une date avec réservations passées (-7j) | Réservations historiques visibles | - [ ] À faire | |
| 4.4 | Naviguer vers une date future (+7j) | Réservations futures visibles | - [ ] À faire | |
| 4.5 | Filtrer par "Déjeuner" | Seulement les réservations du service midi | - [ ] À faire | |
| 4.6 | Filtrer par "Dîner" | Seulement les réservations du service soir | - [ ] À faire | |
| 4.7 | Filtrer "Tous" | Toutes les réservations du jour | - [ ] À faire | |
| 4.8 | Filtrer par statut (ex: pending) | Seulement les réservations pending | - [ ] À faire | |
| 4.9 | Rechercher un client fictif par nom | Résultat trouvé dans la liste | - [ ] À faire | |
| 4.10 | Rechercher un client par téléphone partiel | Résultat trouvé | - [ ] À faire | |
| 4.11 | Rechercher un terme inexistant | Liste vide, pas de crash | - [ ] À faire | |
| 4.12 | Ouvrir le détail d'une réservation | Écran de détail affiché correctement | - [ ] À faire | |

---

## Section 5 — Création de réservation

**Objectif :** Vérifier la création complète d'une réservation depuis le formulaire.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 5.1 | Appuyer sur le bouton "+" (nouvelle réservation) | Formulaire de création ouvert | - [ ] À faire | |
| 5.2 | Soumettre sans remplir les champs | Messages de validation sur les champs obligatoires | - [ ] À faire | |
| 5.3 | Chercher un client existant (ex : nom fictif du dataset) | Client trouvé et sélectionnable | - [ ] À faire | |
| 5.4 | Créer avec client existant, date, heure, couverts | Réservation créée, visible dans la liste | - [ ] À faire | |
| 5.5 | Créer une réservation sans client (walk-in / de passage) | Réservation créée sans fiche client | - [ ] À faire | |
| 5.6 | Choisir une table depuis la liste déroulante | Table sélectionnée, visible dans le formulaire | - [ ] À faire | |
| 5.7 | Choisir une table depuis le plan de salle | Plan s'ouvre, table sélectionnable | - [ ] À faire | |
| 5.8 | Tester multi-tables (sélectionner T1 + T2) | Deux tables associées à la réservation | - [ ] À faire | |
| 5.9 | Vérifier que la réservation créée apparaît dans la liste | Réservation présente à la bonne date | - [ ] À faire | |
| 5.10 | Vérifier le badge "À appeler" sur une réservation pending | Badge visible sur la card | - [ ] À faire | |

---

## Section 6 — Détail réservation

**Objectif :** Vérifier l'affichage complet d'une réservation et les actions disponibles.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 6.1 | Ouvrir une réservation `pending` | Détail affiché : client, date, heure, couverts, table, statut | - [ ] À faire | |
| 6.2 | Changer statut → `confirmed` | Statut mis à jour, badge "confirmed" affiché | - [ ] À faire | |
| 6.3 | Changer statut → `seated` | Statut mis à jour | - [ ] À faire | |
| 6.4 | Changer statut → `completed` | Statut mis à jour, option enquête satisfaction visible | - [ ] À faire | |
| 6.5 | Changer statut → `noshow` | Statut mis à jour | - [ ] À faire | |
| 6.6 | Changer statut → `cancelled` | Statut mis à jour | - [ ] À faire | |
| 6.7 | Corriger un statut (ex: cancelled → confirmed) | Correction possible sans blocage | - [ ] À faire | |
| 6.8 | Vérifier les badges de statut visuels | Couleurs cohérentes (pending=jaune, confirmed=bleu, seated=vert, etc.) | - [ ] À faire | |
| 6.9 | Ouvrir WhatsApp depuis réservation avec téléphone | App WhatsApp ouvre avec le bon numéro | - [ ] À faire | |
| 6.10 | Ouvrir email depuis réservation avec email | App Mail ouvre avec le bon destinataire | - [ ] À faire | |
| 6.11 | Appuyer "Confirmé par téléphone" sur réservation pending | Statut → confirmed, note horodatée ajoutée | - [ ] À faire | |
| 6.12 | Enquête satisfaction après `completed` | Bouton d'envoi satisfaction visible sur réservation completed | - [ ] À faire | |
| 6.13 | Ouvrir réservation avec client VIP | Badge VIP visible | - [ ] À faire | |
| 6.14 | Ouvrir réservation avec tables multiples | Plusieurs tables listées | - [ ] À faire | |

---

## Section 7 — Plan de salle

**Objectif :** Vérifier l'affichage du plan interactif et les actions sur les tables.

**Note dataset :** Seules les tables T1–T5 sont utilisées par le dataset test. T6–T20 ne doivent pas apparaître.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 7.1 | Ouvrir l'onglet Plan | Plan de salle affiché (fond sombre, zones colorées) | - [ ] À faire | |
| 7.2 | Vérifier tables T1–T5 visibles | Tables présentes avec leurs labels | - [ ] À faire | |
| 7.3 | Vérifier que T6–T20 ne sont pas affichées | Pas de tables parasites hors dataset | - [ ] À faire | |
| 7.4 | Vérifier couleur/statut des tables | Libre=vert, réservé=jaune, seated=rouge, indisponible=gris | - [ ] À faire | |
| 7.5 | Tapper une table libre | Options : créer réservation ou walk-in | - [ ] À faire | |
| 7.6 | Tapper une table réservée | Statut visible (nom client si disponible) | - [ ] À faire | |
| 7.7 | Tapper une table `seated` | Options de service disponibles | - [ ] À faire | |
| 7.8 | Créer une réservation depuis une table | Formulaire pré-rempli avec la table | - [ ] À faire | |
| 7.9 | Confirmer une réservation depuis le plan | Statut mis à jour en temps réel | - [ ] À faire | |
| 7.10 | Vérifier scroll/zoom si le plan déborde | Navigation fluide, pas de boutons coupés | - [ ] À faire | |
| 7.11 | Vérifier le realtime | Changer un statut ailleurs → le plan se met à jour sans rechargement | - [ ] À faire | |

---

## Section 8 — Waitlist

**Objectif :** Vérifier la gestion de la liste d'attente.

**Note dataset :** 3 entrées `waiting` présentes pour aujourd'hui.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 8.1 | Ouvrir l'onglet Attente | Liste d'attente du jour affichée | - [ ] À faire | |
| 8.2 | Vérifier compteur sur le badge | Badge ≥ 3 (3 entrées waiting du dataset) | - [ ] À faire | |
| 8.3 | Filtrer par "Déjeuner" | Entrées du service midi | - [ ] À faire | |
| 8.4 | Filtrer par "Dîner" | Entrées du service soir | - [ ] À faire | |
| 8.5 | Ajouter une entrée waitlist (client existant) | Entrée créée, visible dans la liste | - [ ] À faire | |
| 8.6 | Ajouter une entrée waitlist (walk-in, sans client) | Entrée créée sans fiche client | - [ ] À faire | |
| 8.7 | Changer statut → `notified` | Statut mis à jour | - [ ] À faire | |
| 8.8 | Installer une entrée (→ `seated`) | Statut mis à jour | - [ ] À faire | |
| 8.9 | Annuler une entrée (→ `left`) | Statut mis à jour | - [ ] À faire | |
| 8.10 | Convertir une entrée waitlist en réservation | Réservation créée, visible dans la liste des réservations | - [ ] À faire | |
| 8.11 | Vérifier correction de statut flexible | Installer → left → seated possible sans blocage | - [ ] À faire | |

---

## Section 9 — Clients / CRM

**Objectif :** Vérifier la liste clients, la recherche, les fiches et le marquage VIP.

**Note dataset :** ~120 clients fictifs disponibles pour La Maison Test.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 9.1 | Ouvrir l'onglet Clients | Liste clients affichée, chargement fluide | - [ ] À faire | |
| 9.2 | Rechercher par nom (nom fictif du dataset) | Client trouvé dans les résultats | - [ ] À faire | |
| 9.3 | Rechercher par téléphone partiel (`+21699`) | Plusieurs clients affichés | - [ ] À faire | |
| 9.4 | Rechercher par email partiel (`lamaison-test`) | Clients avec emails fictifs affichés | - [ ] À faire | |
| 9.5 | Rechercher un terme inexistant | Liste vide, pas de crash | - [ ] À faire | |
| 9.6 | Ouvrir une fiche client | Nom, téléphone, email, notes, VIP, tags, historique | - [ ] À faire | |
| 9.7 | Vérifier l'historique des réservations du client | Liste des réservations passées/futures | - [ ] À faire | |
| 9.8 | Filtrer les clients VIP | Seulement les clients marqués VIP | - [ ] À faire | |
| 9.9 | Toggler VIP sur un client | Statut VIP modifié (si rôle autorisé) | - [ ] À faire | |
| 9.10 | Ouvrir fiche client avec téléphone `null` | Pas de crash, champ téléphone vide affiché correctement | - [ ] À faire | |
| 9.11 | Ouvrir fiche client avec email `null` | Pas de crash, champ email vide affiché correctement | - [ ] À faire | |
| 9.12 | Vérifier tags et notes sur fiche client | Tags visibles, notes lisibles | - [ ] À faire | |

---

## Section 10 — Rappels du jour

**Objectif :** Vérifier que les rappels du dashboard sont corrects et navigables.

**Note dataset :** 2 pending, 1 confirmed proche, 3 completed avec email, 3 waitlist waiting.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 10.1 | Voir rappels "À confirmer" sur le Dashboard | Au moins 2 rappels pending | - [ ] À faire | |
| 10.2 | Tapper un rappel "À confirmer" | Navigation vers la réservation pending | - [ ] À faire | |
| 10.3 | Voir rappels "Arrivée prochaine" | Réservation confirmed dans ~30 min | - [ ] À faire | |
| 10.4 | Tapper "Arrivée prochaine" | Navigation vers la réservation | - [ ] À faire | |
| 10.5 | Voir rappels "Liste d'attente" | 3 entrées waiting affichées | - [ ] À faire | |
| 10.6 | Tapper un rappel waitlist | Navigation vers la section Attente | - [ ] À faire | |
| 10.7 | Voir rappels "Enquête satisfaction" | 3 réservations completed avec email | - [ ] À faire | |
| 10.8 | Tapper un rappel enquête satisfaction | Navigation vers la réservation correspondante | - [ ] À faire | |

---

## Section 11 — Admin / Pilotage

**Objectif :** Vérifier les statistiques par période et leur cohérence avec les données test.

**Prérequis :** Section Pilotage accessible depuis l'onglet dédié.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 11.1 | Ouvrir l'écran Pilotage | Stats de la période affichées | - [ ] À faire | |
| 11.2 | Sélectionner période "Aujourd'hui" | KPIs du jour | - [ ] À faire | |
| 11.3 | Sélectionner période "7 jours" | KPIs des 7 derniers jours | - [ ] À faire | |
| 11.4 | Sélectionner période "30 jours" | KPIs des 30 derniers jours | - [ ] À faire | |
| 11.5 | Sélectionner période "Mois" | KPIs du mois en cours | - [ ] À faire | |
| 11.6 | Sélectionner période "Année" | KPIs de l'année en cours | - [ ] À faire | |
| 11.7 | Tester période personnalisée (date début / fin) | KPIs de la plage sélectionnée | - [ ] À faire | |
| 11.8 | Vérifier répartition Déjeuner / Dîner | Barres ou pourcentages affichés | - [ ] À faire | |
| 11.9 | Vérifier taux annulation / no-show | Valeurs numériques cohérentes | - [ ] À faire | |
| 11.10 | Vérifier satisfaction client | Score moyen affiché (enquêtes test) | - [ ] À faire | |
| 11.11 | Vérifier "Données clients" | Nombre de clients distincts sur la période | - [ ] À faire | |
| 11.12 | Changer de période et vérifier la cohérence | Les chiffres changent logiquement entre les périodes | - [ ] À faire | |

---

## Section 12 — Paramètres

**Objectif :** Vérifier les écrans de configuration et la déconnexion.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 12.1 | Ouvrir l'écran Paramètres | Sections visibles : Restaurant, Compte, Langue, Tables | - [ ] À faire | |
| 12.2 | Voir les infos restaurant | Nom "La Maison Test", adresse, timezone | - [ ] À faire | |
| 12.3 | Voir les infos du compte connecté | Email `musicybj@gmail.com` visible | - [ ] À faire | |
| 12.4 | Vérifier tables repliées par défaut | Section Tables fermée par défaut | - [ ] À faire | |
| 12.5 | Déplier la section Tables | Liste des tables T1–T5 visible | - [ ] À faire | |
| 12.6 | Modifier le label d'une table (si rôle autorisé) | Modification enregistrée | - [ ] À faire | |
| 12.7 | Vérifier section Équipe | Absent pour compte testeur (`musicybj@gmail.com`) — visible uniquement pour `youssefbenjema@gmail.com` | - [ ] À faire | |
| 12.8 | Appuyer sur "Se déconnecter" | Retour à l'écran de connexion | - [ ] À faire | |

---

## Section 13 — Langue FR / EN

**Objectif :** Vérifier que le changement de langue fonctionne et persiste.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 13.1 | Aller dans Paramètres → Langue | Sélecteur FR / EN visible | - [ ] À faire | |
| 13.2 | Passer en anglais | Labels principaux traduits immédiatement | - [ ] À faire | |
| 13.3 | Vérifier les tabs en anglais | "Home", "Reservations", "Floor", "Waitlist", "Clients" (ou équivalents) | - [ ] À faire | |
| 13.4 | Vérifier le Dashboard en anglais | Titres des sections en anglais | - [ ] À faire | |
| 13.5 | Vérifier la liste des réservations en anglais | Labels de statut, filtres en anglais | - [ ] À faire | |
| 13.6 | Revenir en français | Retour au français immédiat | - [ ] À faire | |
| 13.7 | Fermer complètement l'app et rouvrir | Langue française persistée (AsyncStorage) | - [ ] À faire | |
| 13.8 | Passer en anglais, fermer, rouvrir | Langue anglaise persistée | - [ ] À faire | |

---

## Section 14 — Sécurité / Isolation des données

**Objectif :** Vérifier que le compte testeur ne voit jamais les données du vrai restaurant.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 14.1 | Vérifier le nom du restaurant affiché | "La Maison Test" — jamais "La Maison" réel | - [ ] À faire | |
| 14.2 | Vérifier que les clients sont fictifs | Noms fictifs, emails `@lamaison-test.local`, tél `+21699XXXXXX` | - [ ] À faire | |
| 14.3 | Vérifier que les réservations sont fictives | Pas de vraies réservations du restaurant | - [ ] À faire | |
| 14.4 | Vérifier l'absence de la section Équipe | Section Équipe invisible pour `musicybj@gmail.com` | - [ ] À faire | |
| 14.5 | Tenter d'accéder aux données d'un autre restaurant | Impossible — RLS Supabase empêche l'accès | - [ ] À faire | |

---

## Section 15 — Responsive / Affichage

**Objectif :** Vérifier que les écrans s'affichent correctement sur différents appareils.

| Étape | Action | Résultat attendu | Statut | Notes / bugs |
|---|---|---|---|---|
| 15.1 | Tester sur iPhone petit écran (SE / 13 mini) | Aucun bouton coupé, scroll fonctionnel | - [ ] À faire | |
| 15.2 | Tester sur iPhone grand écran (Pro Max) | Mise en page correcte, pas d'espace vide excessif | - [ ] À faire | |
| 15.3 | Tester sur iPad (si disponible) | Layouts adaptés, pas de débordement | - [ ] À faire | |
| 15.4 | Vérifier les listes longues (clients ~120) | Scroll fluide, pas de freeze | - [ ] À faire | |
| 15.5 | Vérifier les noms longs dans les listes | Texte tronqué proprement, pas de débordement | - [ ] À faire | |
| 15.6 | Vérifier les modales / sheets | Ouverture/fermeture fluide, contenu lisible | - [ ] À faire | |
| 15.7 | Vérifier le plan de salle sur petit écran | Plan navigable, tables cliquables | - [ ] À faire | |
| 15.8 | Vérifier les formulaires avec clavier ouvert | Champs non cachés par le clavier | - [ ] À faire | |

---

## Section 16 — Bugs / Crash

**Objectif :** Capturer tout comportement anormal observé lors des tests.

| Étape | À surveiller | Statut | Notes / bugs |
|---|---|---|---|
| 16.1 | Écran blanc | Absence d'écran blanc dans tous les parcours | - [ ] À faire | |
| 16.2 | Crash de l'app | Aucun crash observé | - [ ] À faire | |
| 16.3 | Bouton bloqué ou non réactif | Tous les boutons répondent | - [ ] À faire | |
| 16.4 | Erreur Supabase visible à l'écran | Aucune erreur technique visible (ex: "Failed to fetch") | - [ ] À faire | |
| 16.5 | Lenteur excessive | Chargements en moins de 3 secondes | - [ ] À faire | |
| 16.6 | Données incohérentes | Les chiffres des KPIs sont logiques | - [ ] À faire | |
| 16.7 | Doublon de création | Créer une réservation une fois → une seule entrée créée | - [ ] À faire | |
| 16.8 | Perte de session inattendue | Session non perdue lors de l'utilisation normale | - [ ] À faire | |

---

## Synthèse des bugs

| ID | Date | Écran | Étapes pour reproduire | Résultat obtenu | Résultat attendu | Priorité | Screenshot | Statut |
|---|---|---|---|---|---|---|---|---|
| BUG-001 | | | | | | bloquant / important / mineur | oui / non | ouvert / corrigé / à revoir |
| BUG-002 | | | | | | | | |
| BUG-003 | | | | | | | | |
| BUG-004 | | | | | | | | |
| BUG-005 | | | | | | | | |

> Ajouter des lignes au besoin. Numérotation libre (BUG-006, BUG-007, etc.).

---

## Synthèse go / no-go

### Décision finale

- [ ] **GO pour test amis** — L'app peut être partagée à des testeurs externes non-techniques
- [ ] **GO pour test restaurant** — L'app peut être utilisée par l'équipe La Maison en conditions réelles
- [ ] **NO-GO** — Corrections nécessaires avant tout test élargi

---

### Critères GO — Test amis

- [ ] Aucun écran blanc au démarrage
- [ ] Login avec compte testeur fonctionnel
- [ ] Dashboard affiché correctement
- [ ] Réservations consultables
- [ ] Création d'une réservation possible
- [ ] Plan de salle affiché (T1–T5)
- [ ] Isolation La Maison Test vérifiée (pas de données réelles visibles)

### Critères GO — Test restaurant

- [ ] Connexion compte staff réel fonctionnelle
- [ ] Création et modification de réservation OK
- [ ] Changement de statut OK
- [ ] Waitlist OK
- [ ] Plan de salle OK (tables réelles)
- [ ] Section Admin stats OK
- [ ] Section Équipe visible pour `youssefbenjema@gmail.com` uniquement
- [ ] Aucun bug bloquant (BUG priorité "bloquant" = 0)

---

### Commentaires généraux du testeur

_(espace libre pour impressions globales, retours UX, suggestions)_

```
...
```

---

*Checklist créée le 2026-05-21. À compléter lors des sessions de test TestFlight.*  
*Basée sur le dataset test immersif — voir [docs/testflight.md](testflight.md#dataset-test-immersif) pour les détails.*
