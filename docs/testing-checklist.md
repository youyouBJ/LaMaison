# Checklist de test manuel — La Maison

> **À tester avant la mise en production.**
> Appareil cible : iPhone (Expo Go). Tester aussi sur iPad si disponible.
> Cocher chaque case uniquement après vérification réelle sur l'appareil.

---

## 1. Auth

### Connexion initiale
- [ ] Lancer l'app → écran de connexion affiché
- [ ] Saisir email invalide → message d'erreur clair
- [ ] Saisir mot de passe vide → message d'erreur clair
- [ ] Saisir mauvais mot de passe → message d'erreur Supabase affiché
- [ ] Saisir bon email / bon mot de passe → navigation vers le Dashboard

### Déconnexion
- [ ] Aller dans Paramètres → bouton "Se déconnecter" visible
- [ ] Appuyer → spinner pendant déconnexion
- [ ] Retour automatique à l'écran de connexion

### Reconnexion après déconnexion
- [ ] Après déconnexion, saisir les identifiants → connexion réussie
- [ ] Le bouton "Se connecter" n'est pas bloqué / désactivé
- [ ] Les champs email et mot de passe sont éditables

### Session persistante
- [ ] Se connecter → fermer complètement Expo Go
- [ ] Rouvrir Expo Go → atterrir directement sur le Dashboard (pas l'écran de connexion)

---

## 2. Dashboard

- [ ] Ouvrir le Dashboard → chargement sans erreur
- [ ] Stat "Réservations aujourd'hui" correspond au nombre réel du jour
- [ ] Stat "Couverts aujourd'hui" correspond à la somme des party_size
- [ ] Stat "Déjeuner" affiche le bon nombre de réservations
- [ ] Stat "Dîner" affiche le bon nombre de réservations
- [ ] Couverts déjeuner et dîner sont distincts et cohérents
- [ ] Stat "Walk-ins" affiche uniquement les réservations source = walkin
- [ ] Stat "À appeler" correspond aux réservations pending sans confirmation téléphone
- [ ] Rafraîchir (pull-to-refresh ou bouton) → stats mises à jour

---

## 3. Réservations

### Création — réservation normale
- [ ] Bouton "Nouvelle réservation" → formulaire s'ouvre
- [ ] Choisir une date
- [ ] Choisir un service (Déjeuner / Dîner) → créneaux disponibles affichés
- [ ] Choisir un créneau
- [ ] Ajuster le nombre de couverts (stepper)
- [ ] Sélectionner une table (optionnel)
- [ ] Créer → navigation vers la fiche de la réservation

### Création — avec client existant
- [ ] Rechercher un client par nom / téléphone / email → résultats affichés
- [ ] Sélectionner un client → fiche pré-remplie
- [ ] Créer la réservation → client correct dans la fiche

### Création — avec nouveau client
- [ ] Saisir prénom / nom / téléphone / email
- [ ] Cocher "Client VIP" → toggle actif
- [ ] Créer → nouveau client créé dans Supabase, lié à la réservation
- [ ] Vérifier que `guests.birthday` n'est PAS modifié (colonne doit rester null)

### Création — client de passage (walk-in)
- [ ] Sélectionner "Client de passage"
- [ ] Aucun champ client requis
- [ ] Créer → réservation source = walkin, guest_id null

### Multi-tables
- [ ] Sélectionner plusieurs tables → toutes apparaissent dans la fiche
- [ ] Désélectionner une table → retiré de la sélection
- [ ] Effacer la sélection → aucune table

### Navigation et filtres
- [ ] Liste des réservations → tri par créneau correct
- [ ] Filtre "Déjeuner" → seules les réservations déjeuner affichées
- [ ] Filtre "Dîner" → seules les réservations dîner affichées
- [ ] Sélecteur de date → changer la date → liste mise à jour
- [ ] Recherche par nom → résultats filtrés en temps réel

### Correction de statut
- [ ] Ouvrir une réservation terminée / annulée / no-show
- [ ] Section "Correction du statut" visible
- [ ] Appuyer "Modifier le statut…" → chips de tous les statuts affichés
- [ ] Changer le statut → mise à jour confirmée

---

## 4. Occasions

### Anniversaire
- [ ] Nouvelle réservation → section "Occasion" visible pour tous les types de client
- [ ] Cocher "Anniversaire" → toggle actif
- [ ] Créer → notes contiennent `[Occasion] Anniversaire`
- [ ] Dans la liste → badge or "Anniversaire" visible sur la card
- [ ] Dans la fiche détail → ligne "Occasion : Anniversaire" visible
- [ ] Dans la fiche détail → zone "Notes" ne contient PAS `[Occasion] Anniversaire`
- [ ] Dans le plan de salle → badge "Anniversaire" visible dans le panneau table

### Événement
- [ ] Cocher "Événement" → toggle actif
- [ ] Créer → notes contiennent `[Occasion] Événement`
- [ ] Dans la liste → badge bordeaux "Événement" visible
- [ ] Dans la fiche détail → ligne "Occasion : Événement" visible
- [ ] Dans la fiche détail → notes affichées propres (sans tag)
- [ ] Dans le plan de salle → badge "Événement" visible dans le panneau

### Les deux à la fois
- [ ] Cocher Anniversaire ET Événement → les deux toggles actifs
- [ ] Créer → notes contiennent les deux tags
- [ ] Card réservation → deux badges visibles
- [ ] Fiche détail → deux badges côte à côte dans la ligne "Occasion"

### Notes libres + occasion
- [ ] Cocher Anniversaire + saisir une note "Prévoir gâteau"
- [ ] Créer → notes en base : `[Occasion] Anniversaire\nPrévoir gâteau`
- [ ] Dans la fiche → notes affichées : `Prévoir gâteau` (sans tag)

### Vérification guests.birthday
- [ ] Créer une réservation Anniversaire avec nouveau client
- [ ] Vérifier dans Supabase : `guests.birthday` = null (non modifié)

---

## 5. Confirmation téléphonique

- [ ] Créer une réservation en statut "En attente"
- [ ] Dans la liste → badge "À appeler" visible sur la card
- [ ] Dans la fiche → section "Confirmation téléphonique" visible
- [ ] Bouton "Appeler" sur la card → appel téléphonique déclenché (ou simulé)
- [ ] Bouton "Confirmé par téléphone" → statut passe à "Confirmée"
- [ ] Après confirmation → badge "À appeler" disparaît de la liste
- [ ] Stat Dashboard "À appeler" décrémentée

---

## 6. Plan de salle

### Affichage général
- [ ] Onglet Plan → chargement du canvas
- [ ] Tables affichées avec les bonnes couleurs (libre / réservée / à table)
- [ ] Légende visible et correcte
- [ ] Filtre Tous / Déjeuner / Dîner → plan mis à jour
- [ ] Sélecteur de date → tables mises à jour selon les réservations du jour

### Panneau table
- [ ] Cliquer une table → panneau de détail s'ouvre en bas
- [ ] Recliquer la même table → panneau se ferme
- [ ] Panneau affiche : nom table, zone, capacité, statut
- [ ] Réservations de la table listées : créneau, client, couverts, statut

### Actions depuis le panneau
- [ ] Bouton "Confirmer" (statut pending) → statut passe à confirmed
- [ ] Bouton "À table" → statut passe à seated
- [ ] Bouton "Terminer" → statut passe à completed
- [ ] Bouton "No-show" → statut passe à noshow
- [ ] Bouton "Annuler" → statut passe à cancelled
- [ ] Message de succès affiché après chaque action

### Création depuis le plan
- [ ] Bouton "Ajouter une réservation" → formulaire modal s'ouvre
- [ ] Table pré-sélectionnée dans le formulaire
- [ ] Créer la réservation → retour au plan, table mise à jour
- [ ] Multi-tables : ajouter d'autres tables depuis le formulaire

### Occasions dans le plan
- [ ] Table avec réservation Anniversaire → badge "Anniversaire" dans le panneau
- [ ] Table avec réservation Événement → badge "Événement" dans le panneau
- [ ] Notes affichées dans le panneau sont propres (sans tags techniques)

### Statuts visuels
- [ ] Table sans réservation active → couleur libre (vert)
- [ ] Table avec réservation confirmée → couleur réservée (or)
- [ ] Table avec réservation seated → couleur à table (bordeaux)
- [ ] Rafraîchir (bouton) → statuts mis à jour

---

## 7. Waitlist

### Création
- [ ] Onglet Planning ou Waitlist → bouton "Ajouter à la liste d'attente"
- [ ] Formulaire : saisir nom, couverts, service (Déjeuner / Dîner)
- [ ] Client identifié → rechercher et sélectionner
- [ ] Client de passage → créer sans fiche client
- [ ] Créer → entrée apparaît dans la liste avec statut "En attente"

### Badge Attente sur Planning
- [ ] La vue Planning affiche un badge / compteur de la file d'attente active
- [ ] Le badge se met à jour quand une entrée est créée ou résolue

### Actions sur la waitlist
- [ ] Bouton "Prévenir" → statut passe à "Notifié"
- [ ] Bouton "Installer" → statut passe à "Installé"
- [ ] Bouton "Parti" → statut passe à "Parti"
- [ ] Repasser en attente depuis "Notifié" → statut revient à "En attente"

### Conversion en réservation
- [ ] Depuis une entrée waitlist → bouton "Convertir en réservation"
- [ ] Choisir statut "Confirmée" → réservation créée en confirmed
- [ ] Choisir statut "Installée" (seated) → réservation créée en seated
- [ ] Après conversion → entrée retirée de la waitlist active

---

## 8. CRM Clients

### Recherche et filtres
- [ ] Onglet Clients → liste des clients chargée
- [ ] Recherche par nom → filtrage en temps réel
- [ ] Recherche par téléphone → fonctionne
- [ ] Filtre VIP → seuls les clients VIP affichés
- [ ] Tri par nom → ordre alphabétique correct
- [ ] Tri par dernière visite → ordre chronologique correct

### Fiche client
- [ ] Appuyer sur un client → fiche détail s'ouvre
- [ ] Prénom, nom, téléphone, email affichés
- [ ] Badge VIP si client VIP
- [ ] Tags affichés si renseignés
- [ ] Historique des réservations passées listé

### Vérification guests.birthday
- [ ] Ouvrir la fiche d'un client créé depuis une réservation Anniversaire
- [ ] Le champ anniversaire est vide / null (non renseigné depuis une réservation)

---

## 9. Paramètres

- [ ] Onglet Paramètres → chargement sans erreur
- [ ] Section "Restaurant" : nom, adresse, téléphone, email affichés
- [ ] Section "Compte" : nom staff, rôle, restaurant affichés
- [ ] Section "Services" : liste des shifts avec heures et jours
- [ ] Section "Plan de salle" : nombre total de tables et zones correct
- [ ] Section "Données clients" : total clients, VIP, avec téléphone, avec email
- [ ] Bouton "Actualiser" → rechargement des données
- [ ] Section "Session" : email du compte connecté visible
- [ ] Bouton "Se déconnecter" → déconnexion et retour au Login

---

## 10. Régressions

### Crashs potentiels
- [ ] Réservation sans guest → la card s'affiche sans crash ("Client sans nom")
- [ ] Réservation sans table → la card s'affiche sans crash
- [ ] `reservation_tables` vide → multi-tables affiché correctement (ou vide)
- [ ] Client de passage → aucun crash sur la card, fiche ou plan
- [ ] Notes null → aucun crash sur card, fiche, plan
- [ ] `displayNotes(null)` → retourne null sans crash

### Cas limites UI
- [ ] iPhone SE / petit écran → aucun débordement dans les formulaires
- [ ] Formulaire de réservation : clavier visible sans masquer les champs
- [ ] Plan de salle : canvas redimensionné correctement selon la hauteur disponible
- [ ] Beaucoup de réservations sur une même table → scroll dans le panneau

### Flux complet logout / login
- [ ] Se connecter → naviguer dans plusieurs onglets → se déconnecter
- [ ] Se reconnecter → session repartie correctement, aucun état résiduel
- [ ] Recommencer 2 fois de suite → stable

---

## Notes de test

| Champ | Valeur |
|---|---|
| Appareil principal | iPhone (Expo Go) |
| Testeur | |
| Date du test | |
| Version de l'app | `git log --oneline -1` |
| Environnement Supabase | Production (`nosflczsevtrxnyienyn`) |

---

*Checklist générée le 2026-05-19 — à mettre à jour à chaque nouveau module.*
