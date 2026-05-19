# Enquêtes de satisfaction — Préparation V1

## Contexte

La Maison disposait historiquement d'un flux SevenRooms qui envoyait automatiquement des enquêtes de satisfaction après chaque visite. L'export SevenRooms (feedbacks) montre les dimensions suivantes déjà collectées :

- **Overall** — note globale de l'expérience
- **Food** — qualité de la nourriture
- **Drinks** — qualité des boissons
- **Service** — qualité du service
- **Ambience** — ambiance du restaurant
- **Recommended** — recommanderait-il/elle l'établissement (Yes / No)
- **Commentaire libre** — texte libre optionnel

## État actuel (V1 - mai 2026)

Les boutons "Enquête satisfaction" dans l'app ouvrent **manuellement** WhatsApp ou l'app Mail avec un message prérempli. Aucun lien d'enquête n'est encore inclus.

La constante `LA_MAISON_SURVEY_URL` dans `src/utils/whatsapp.ts` est vide. Dès qu'un lien d'enquête sera disponible, il suffit de la renseigner — les messages WhatsApp et email l'incluront automatiquement.

## Modèle de table future

Quand la table sera créée (migration à faire), elle devra contenir au minimum :

```sql
create table feedback_surveys (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid references reservations(id),
  guest_id        uuid references guests(id),
  visit_date      date not null,
  source          text not null check (source in ('sevenrooms_import', 'manual', 'link')),

  -- Dimensions SevenRooms-compatibles
  overall         smallint check (overall between 1 and 5),
  food            smallint check (food between 1 and 5),
  drinks          smallint check (drinks between 1 and 5),
  service         smallint check (service between 1 and 5),
  ambience        smallint check (ambience between 1 and 5),
  recommended     boolean,
  comment         text,

  created_at      timestamptz default now()
);
```

## Import SevenRooms

Avant de créer la table, il faut obtenir l'export complet des feedbacks SevenRooms (CSV ou JSON) pour :

1. Vérifier les champs exacts disponibles dans l'export.
2. Mapper les valeurs (les notes SevenRooms peuvent être sur 5 ou sur 10).
3. Faire correspondre `reservation_id` et `guest_id` aux données déjà importées.
4. Distinguer les feedbacks avec texte libre des feedbacks purement numériques.

L'import se fait en `source = 'sevenrooms_import'` pour tracer l'origine.

## Prochaines étapes

1. Obtenir l'export complet SevenRooms feedbacks.
2. Créer la migration `feedback_surveys`.
3. Remplir `LA_MAISON_SURVEY_URL` avec le vrai lien d'enquête (Typeform, Google Forms, ou page interne).
4. Les messages WhatsApp et email incluront alors le lien automatiquement sans autre modification.
