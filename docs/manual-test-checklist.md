# Checklist de test manuel — TestFlight / Terrain

> Appareil cible principal : iPhone (Expo Go / TestFlight).  
> Tester aussi sur iPad quand disponible.  
> Cocher chaque case uniquement après vérification réelle sur l'appareil.

---

## 1. Auth

### Connexion
- [ ] Lancer l'app → écran de connexion affiché
- [ ] Email invalide → message d'erreur clair, bouton non bloqué
- [ ] Mot de passe vide → message d'erreur, bouton non bloqué
- [ ] Mauvais mot de passe → message d'erreur Supabase affiché
- [ ] Bon email / bon mot de passe → navigation vers le Dashboard
- [ ] Pendant la connexion → bouton "Se connecter" désactivé (pas de double-envoi)

### Session persistante
- [ ] Se connecter → fermer complètement l'app → rouvrir → atterrir sur le Dashboard

### Déconnexion (depuis Pilotage)
- [ ] Bouton "Se déconnecter" → spinner affiché pendant déconnexion
- [ ] Retour automatique à l'écran de connexion
- [ ] Se reconnecter → session repartie correctement

### Déconnexion (depuis Configuration)
- [ ] Même test depuis l'onglet Configuration
- [ ] Reconnexion stable, aucun état résiduel

---

## 2. Réservations

### Liste et filtres
- [ ] Onglet Réservations → chargement sans erreur
- [ ] Liste vide pour une date sans réservation → message "Aucune réservation" affiché
- [ ] Pull-to-refresh → données rechargées
- [ ] Filtre Déjeuner / Dîner → seules les réservations du service affiché
- [ ] Filtre statut → seules les réservations du statut affiché
- [ ] Recherche par nom → filtrage en temps réel, résultats corrects
- [ ] Changer la date → liste mise à jour
- [ ] Card réservation sans client → "Client sans nom" ou "Client de passage" affiché, pas de crash
- [ ] Card réservation sans table → pas de crash, table omise

### Fiche détail
- [ ] Ouvrir une fiche réservation → toutes les infos affichées (créneau, couverts, tables, statut)
- [ ] Statut "En attente de confirmation" → libellé exact affiché
- [ ] Statut "Confirmée" → libellé exact affiché
- [ ] Statut "À table" → libellé exact affiché
- [ ] Statut "Terminée" → libellé exact affiché
- [ ] Statut "Annulée" → libellé exact affiché
- [ ] Statut "No-show" → libellé exact affiché
- [ ] Notes null / vides → section Notes absente (pas de ligne vide)
- [ ] Multi-tables → toutes les tables affichées dans la fiche

### Correction de statut
- [ ] Ouvrir une réservation terminée / annulée / no-show
- [ ] Bouton "Modifier le statut…" → grille de correction affichée
- [ ] Changer le statut → mise à jour confirmée, grille ferme
- [ ] Pendant la mise à jour → tous les boutons d'action désactivés

### Confirmation téléphonique
- [ ] Réservation "En attente" → section "Confirmation téléphonique" visible
- [ ] Bouton "Confirmé par téléphone" → statut passe à "Confirmée"
- [ ] Bouton désactivé pendant la mise à jour

---

## 3. Nouvelle réservation

### Formulaire — réservation normale
- [ ] Bouton "Nouvelle réservation" → formulaire s'ouvre
- [ ] Choisir une date → services disponibles chargés
- [ ] Choisir un service → créneaux disponibles affichés
- [ ] Choisir un créneau → stepper de couverts actif
- [ ] Ajuster couverts → valeur mise à jour
- [ ] Sélection optionnelle de table → case cochable / décochable
- [ ] Soumettre → navigation vers la fiche de la réservation créée
- [ ] Pendant la soumission → bouton "Créer" désactivé (pas de double-envoi)

### Statut de création
- [ ] Option "Confirmée" sélectionnable
- [ ] Option "En attente de confirmation" sélectionnable
- [ ] Le texte de l'option est centré dans le bouton (pas aligné à gauche)

### Client existant
- [ ] Rechercher un client → résultats affichés
- [ ] Sélectionner → champs pré-remplis (nom, téléphone, email)
- [ ] Créer → client correct lié dans Supabase

### Nouveau client
- [ ] Saisir prénom / nom / téléphone / email
- [ ] Toggle VIP actif → client créé VIP
- [ ] Créer → nouveau client dans Supabase, lié à la réservation

### Walk-in (client de passage)
- [ ] Sélectionner "Client de passage"
- [ ] Aucun champ client requis
- [ ] Créer → réservation source = walkin, guest_id null, pas de crash

### Multi-tables
- [ ] Sélectionner plusieurs tables → toutes dans la liste de sélection
- [ ] Désélectionner une table → retirée
- [ ] Effacer → aucune table sélectionnée
- [ ] Créer → toutes les tables dans `reservation_tables`

---

## 4. Plan de salle

### Affichage
- [ ] Onglet Plan → canvas chargé sans erreur
- [ ] Tables affichées avec les couleurs correctes (libre vert / réservée or / à table bordeaux)
- [ ] Légende visible et correcte
- [ ] Filtre Tous / Déjeuner / Dîner → plan mis à jour
- [ ] Sélecteur de date → tables mises à jour

### Panneau table
- [ ] Appuyer sur une table → panneau de détail s'ouvre en bas
- [ ] Réappuyer → panneau se ferme
- [ ] Panneau : nom, zone, capacité, statut affichés correctement
- [ ] Table sans réservation → "Aucune réservation assignée"
- [ ] Réservations listées : créneau, client, couverts, statut, notes

### Actions depuis le panneau
- [ ] "Confirmer" (pending) → statut passe à confirmed, message de succès
- [ ] "À table" → statut passe à seated, message de succès
- [ ] "Terminer" → statut passe à completed, message de succès
- [ ] "No-show" → statut passe à noshow, message de succès
- [ ] "Annuler" → statut passe à cancelled, message de succès
- [ ] Pendant mise à jour → spinner "Mise à jour…" visible, boutons masqués

### Création depuis le plan
- [ ] Bouton "Ajouter une réservation" → formulaire modal s'ouvre
- [ ] Table pré-sélectionnée dans le formulaire
- [ ] Créer → retour au plan, table mise à jour
- [ ] Annuler → retour au panneau sans modification

---

## 5. Waitlist

### Affichage et libellés
- [ ] Entrée en attente → statut "En attente" affiché
- [ ] Bouton de création → libellé "En attente de table" ou équivalent
- [ ] Liste vide → état vide affiché

### Création
- [ ] Formulaire : saisir nom, couverts, service
- [ ] Client identifié → recherche et sélection
- [ ] Client de passage → créer sans fiche client
- [ ] Créer → entrée dans la liste, statut "En attente"

### Statuts et actions
- [ ] "Prévenir" → statut "Prévenu", bouton désactivé pendant action
- [ ] "Installer" → statut "Installé"
- [ ] "Parti" → statut "Parti"
- [ ] Appui double rapide sur un bouton → une seule action exécutée

### Conversion en réservation
- [ ] "Convertir en réservation" → formulaire de conversion
- [ ] Choisir statut → réservation créée avec le bon statut
- [ ] Après conversion → entrée disparaît de la waitlist active

---

## 6. CRM Clients

### Liste et filtres
- [ ] Onglet Clients → liste chargée, pagination active
- [ ] Recherche par nom → résultats en temps réel
- [ ] Recherche par téléphone → fonctionne
- [ ] Filtre VIP → seuls les clients VIP affichés
- [ ] Scroll bas → chargement de la page suivante (load more)
- [ ] Liste vide → état "Aucun client" affiché

### Fiche client
- [ ] Ouvrir une fiche → prénom, nom, téléphone, email, tags, historique
- [ ] Client VIP → badge VIP visible
- [ ] Aucun téléphone → champ téléphone absent (pas de crash)
- [ ] Aucun email → champ email absent (pas de crash)
- [ ] Historique des réservations passées listé correctement

### Modification
- [ ] Modifier nom / téléphone / email → sauvegarde
- [ ] Pendant la sauvegarde → bouton désactivé
- [ ] Message de succès ou d'erreur affiché

### VIP toggle
- [ ] Toggle VIP → client passe VIP, badge apparaît immédiatement
- [ ] Re-toggle → client redevient non-VIP, badge disparaît

### Suppression
- [ ] Appuyer "Supprimer le client" → alerte de confirmation
- [ ] Confirmer → client supprimé, retour à la liste
- [ ] Annuler → client non supprimé
- [ ] Pendant la suppression → bouton désactivé

---

## 7. Enquête de satisfaction

### Depuis la fiche réservation (statut completed)
- [ ] Réservation "Terminée" → section "Enquête de satisfaction" visible
- [ ] Bouton "Générer le lien" → spinner affiché, lien créé
- [ ] Lien créé → boutons "WhatsApp" et "Email" activés
- [ ] Bouton "Copier" → feedback de copie dans le presse-papiers
- [ ] Pendant la génération → bouton désactivé (pas de double-appui)
- [ ] Deuxième appui "Générer" → lien recréé (pas d'erreur)

### Depuis le plan de salle (statut completed)
- [ ] Réservation completed dans panneau → bouton WhatsApp "Avis WhatsApp" visible
- [ ] Appuyer → lien récupéré, WhatsApp ouvert avec message satisfaction
- [ ] Bouton email → message satisfaction envoyé via l'app Mail

---

## 8. Pilotage (Admin analytics)

### Chargement et navigation
- [ ] Onglet "Pilotage" → chargement sans erreur
- [ ] Sélecteur de période visible (chips)

### Périodes prédéfinies
- [ ] "7 jours" → stats chargées pour les 7 derniers jours
- [ ] "30 jours" → stats correctes
- [ ] "90 jours" → stats correctes
- [ ] Changement de période → stats mises à jour

### Dates personnalisées
- [ ] "Personnalisé" → champs de date début / fin affichés
- [ ] Saisir dates valides → stats chargées pour la période
- [ ] Date de fin < date de début → comportement correct (pas de crash)

### Stats affichées
- [ ] Nombre total de réservations
- [ ] Couverts totaux
- [ ] Taux d'annulation
- [ ] Taux de no-show
- [ ] Répartition par statut
- [ ] Top clients (si disponible)
- [ ] Stats de satisfaction (si données disponibles)

### Déconnexion depuis Pilotage
- [ ] Bouton "Se déconnecter" → déconnexion et retour au Login

---

## 9. Configuration (Paramètres)

### Chargement
- [ ] Onglet Configuration → chargement sans erreur
- [ ] Infos restaurant, services, plan de salle affichés

### Modifier les infos du restaurant
- [ ] Modifier le nom → sauvegarder → mise à jour confirmée
- [ ] Modifier téléphone / email → sauvegarder → pas d'erreur
- [ ] Pendant la sauvegarde → bouton désactivé
- [ ] Message de succès visible

### Modifier un service (shift)
- [ ] Appuyer "Modifier" sur un service → champs de saisie visibles
- [ ] Modifier le nom / horaires / durée de slot / max couverts
- [ ] Sauvegarder → mise à jour confirmée avec feedback
- [ ] Pendant la sauvegarde → bouton désactivé
- [ ] Annuler → aucune modification

### Modifier une table
- [ ] Appuyer "Modifier" sur une table → champs visibles
- [ ] Modifier le libellé / zone / capacité
- [ ] Sauvegarder → mise à jour confirmée
- [ ] Pendant la sauvegarde → bouton désactivé

### Déconnexion depuis Configuration
- [ ] Bouton "Se déconnecter" → déconnexion et retour au Login

---

## 10. WhatsApp et Email

### Depuis la fiche réservation
- [ ] Client avec téléphone → bouton WhatsApp visible (vert)
- [ ] Appuyer WhatsApp → WhatsApp s'ouvre avec message pré-rempli
- [ ] Feedback "WhatsApp ouvert" affiché en vert
- [ ] Client sans téléphone → bouton WhatsApp absent
- [ ] Numéro invalide → feedback rouge "Numéro invalide"
- [ ] Client avec email → bouton Email visible
- [ ] Appuyer Email → app Mail s'ouvre avec sujet et corps pré-remplis
- [ ] Feedback "Email ouvert" affiché en vert
- [ ] Email invalide → feedback rouge "Email invalide"

### Depuis le plan de salle
- [ ] Réservation avec téléphone → bouton WhatsApp dans le panneau (vert)
- [ ] Appuyer WhatsApp → WhatsApp s'ouvre
- [ ] Réservation completed → bouton "Avis WhatsApp" (message satisfaction)
- [ ] Sans téléphone, avec email → bouton Email affiché

### Depuis la fiche client
- [ ] Bouton WhatsApp sur la fiche → WhatsApp s'ouvre
- [ ] Bouton Email sur la fiche → app Mail s'ouvre

---

## 11. Responsive iPhone / iPad

### Badges et libellés longs
- [ ] Badge "En attente de confirmation" → texte non coupé sur iPhone SE
- [ ] Badge ajusté en taille sur petits écrans (pas de débordement)
- [ ] Tous les libellés de statut lisibles sur iPhone SE

### Boutons d'action
- [ ] Fiche réservation → boutons non rognés, wrappés si nécessaire
- [ ] Plan de salle panneau → boutons d'action wrappés sur petite hauteur
- [ ] Waitlist → boutons d'action toujours accessibles

### Formulaires et clavier
- [ ] Nouveau formulaire de réservation → clavier ne masque pas les champs importants
- [ ] Recherche client → résultats visibles au-dessus du clavier

### Pilotage
- [ ] Chips de sélection de période → wrappés sur petits écrans (pas de scroll horizontal forcé)
- [ ] Champs dates personnalisées → accessibles sur iPhone SE

### Plan de salle
- [ ] Canvas redimensionné correctement selon la hauteur disponible
- [ ] Panneau table → scroll interne fonctionnel pour beaucoup de réservations

### iPad
- [ ] Tous les écrans s'affichent correctement en mode portrait iPad
- [ ] Pas d'éléments qui débordent ou disparaissent

---

## 12. Régression finale

### Flux complet de bout en bout
- [ ] Se connecter → créer une réservation (nouveau client VIP) → plan de salle → mettre à table → terminer → envoyer enquête WhatsApp → se déconnecter
- [ ] Se reconnecter → retrouver la réservation dans l'historique client → supprimer le client de test
- [ ] Répéter le flux complet 2 fois → aucune régression

### Multi-actions rapides
- [ ] Appui double rapide sur "Créer la réservation" → une seule réservation créée
- [ ] Appui double rapide sur "Sauvegarder" (paramètres) → une seule requête envoyée
- [ ] Appui double rapide sur "Se déconnecter" → déconnexion propre sans erreur

### Réseau lent / erreur Supabase
- [ ] Couper le réseau → créer une réservation → erreur affichée proprement, pas de crash
- [ ] Rétablir le réseau → réessayer → réservation créée
- [ ] Erreur sur chargement de liste → message d'erreur + bouton "Réessayer"

### Données manquantes
- [ ] Réservation sans client (walk-in) → s'affiche partout sans crash
- [ ] Réservation sans table → s'affiche partout sans crash
- [ ] Client sans téléphone ni email → fiche sans crash, boutons communication absents
- [ ] Notes null → aucune ligne vide affichée dans les fiches

### Stabilité générale
- [ ] Naviguer entre tous les onglets 5 fois → aucun crash
- [ ] Laisser l'app en arrière-plan 5 min → revenir → données fraîches, pas de blocage
- [ ] Tester sur iOS 16+ et iOS 17+ si possible

---

## Informations de session de test

| Champ | Valeur |
|---|---|
| Appareil | |
| Version iOS | |
| Testeur | |
| Date | |
| Version app | `git log --oneline -1` |
| Environnement | Production (`nosflczsevtrxnyienyn`) |

---

*Checklist générée le 2026-05-20 — à mettre à jour à chaque nouveau module.*
