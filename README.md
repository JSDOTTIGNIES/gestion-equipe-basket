# JS Dottignies — gestion d'équipe U14

Application web mobile/ordinateur pour **GitHub Pages + Supabase**, sans serveur ni compilation.

## Contenu déjà importé

- 12 joueurs de `liste des joueurs.xlsx`.
- 3 matchs de `liste des matchs.xlsx`, dates et heures préservées.
- Matches à domicile : désignations *Délégué de banc*, *Chrono* et *24/14 secondes*.
- Matches à l'extérieur : convocations, heure et lieu de rendez-vous, heure de départ, disponibilités des parents et nombre de places passagers.

## 1. Créer Supabase

1. Créer un projet Supabase.
2. Dans **SQL Editor**, coller et exécuter `supabase/schema.sql`.
3. Dans **SQL Editor**, coller et exécuter `supabase/seed.sql`.
4. Dans **Authentication → Providers → Email**, activer les connexions par e-mail (OTP / magic link). Vérifier les paramètres d'envoi et les limites du service d'e-mail ; utiliser un SMTP dédié en production si nécessaire.
5. Dans **Authentication → URL Configuration**, ajouter l'adresse exacte GitHub Pages dans **Redirect URLs**, par exemple `https://MON-COMPTE.github.io/js-dottignies-equipe/`.

## 2. Configurer l'application

1. Renommer `config.example.js` en `config.js`.
2. Dans `config.js`, renseigner **Project URL** et la **Publishable key** (ou clé `anon` legacy) disponibles dans Supabase → Project Settings → API Keys.
3. **Ne jamais utiliser de clé `service_role` ou de secret serveur dans les fichiers GitHub.** La clé publishable/anon est volontairement publique ; les tables sont protégées par des politiques RLS.

## 3. Publier sur GitHub Pages

1. Créer un dépôt GitHub et y transférer le contenu du dossier (pas le ZIP lui-même).
2. Ouvrir **Settings → Pages**.
3. **Build and deployment : Deploy from a branch** → `main` → `/ (root)` → Save.
4. Ouvrir l'URL GitHub Pages affichée par GitHub.

> Pour un dépôt public, ne mettez pas de données personnelles dans les fichiers sources : les noms des joueurs sont insérés dans Supabase, pas dans le code JS. Les informations de covoiturage restent accessibles aux comptes authentifiés ; les parents doivent être informés de cette visibilité.

## 4. Activer le compte coach

1. Se connecter une première fois à l'application avec l'adresse du coach (réception d'un lien par e-mail).
2. Dans Supabase → SQL Editor, exécuter **en remplaçant l'adresse** :

```sql
update public.profiles
set role = 'coach'
where lower(email) = lower('adresse-du-coach@exemple.be');
```

3. Se déconnecter puis se reconnecter à l'application. L'onglet **Effectif & parents** et les fonctions d'administration sont visibles.
4. Le coach associe un nom et un e-mail de parent à chaque joueur. Les parents doivent se connecter avec **exactement la même adresse** pour déclarer leur covoiturage.

## Utilisation

- **Calendrier** : cliquer un match ; le coach coche les joueurs convoqués et enregistre le rendez-vous. Pour un match extérieur, choisir **Salle JS Dottignies** ou **Actalex** + horaire de rendez-vous et de départ. Pour un match à domicile, seulement le lieu et l'heure de rendez-vous.
- **Tirage** : au moins 3 joueurs actifs convoqués. Le coach lance le tirage. Un joueur ne peut pas être désigné deux fois sur le même match. Le tirage privilégie les joueurs moins souvent désignés, avec départage aléatoire. Le résultat mentionne la **famille du joueur** : un de ses parents assurera la fonction.
- **Covoiturage** : pour les déplacements, chaque parent enregistré peut répondre disponible / indisponible et saisir ses places *passagers* (hors conducteur). Le récapitulatif affiche les places offertes.
- **Effectif & parents** : le coach crée ou supprime les associations parent ↔ joueur.

**Si Supabase est déjà configuré avec la V1**, exécuter une seule fois `supabase/migration_v2.sql` dans SQL Editor. Ne réinitialisez pas la base et ne réimportez pas les données initiales.

## Importation de la deuxième partie de saison

Dans **Calendrier**, le coach dispose de deux boutons : **Ajouter un match** (date, heure, domicile/déplacement, adversaire, salle, série, numéro de rencontre facultatif) et **Importer un calendrier Excel**.

L’import accepte les fichiers `.xlsx`/`.xls` semblables au calendrier initial, notamment les colonnes `Serie`, `Num.`, `Salle`, `Date`, `Heure`, `Visités`, `Visiteurs`. Le coach choisit le fichier, visualise les rencontres détectées et confirme l’ajout. Le système ignore les matchs déjà présents par numéro officiel ou combinaison date/équipes. Il ne modifie ni convocations, ni rendez-vous, ni désignations existantes. Les lignes non conformes sont signalées. L’analyse Excel s’effectue dans le navigateur via SheetJS (connexion internet nécessaire pour charger la bibliothèque).

## Limites de cette première version

- Le coach ne peut pas encore importer un **nouveau** Excel directement via l'interface ; `seed.sql` importe les deux fichiers fournis. Les nouvelles rencontres peuvent être ajoutées depuis Supabase ou via une prochaine évolution d'import.
- Les places offertes ne sont pas automatiquement attribuées aux joueurs ; l'écran sert de récapitulatif pour l'organisation du coach.
- Les convocations ne génèrent pas automatiquement un e-mail ou une notification. En cas de modification de la sélection, le tirage du match est annulé et devra être relancé.
- Les parents voient le total des places proposées et les offres ; seuls les parents concernés et le coach voient les noms et e-mails enregistrés dans la table des responsables.
- Les noms de famille des joueurs ne figurent pas dans le fichier fourni ; la désignation utilise donc leur **prénom**. Si plusieurs joueurs portent le même prénom, compléter les fiches.
- Le logo `assets/logo.svg` est un **emblème temporaire stylisé**, pas le logo officiel du club. Le remplacer par le véritable fichier logo pour retrouver exactement l'identité graphique des applications JS précédentes, en gardant le même nom ou en modifiant les références dans `index.html`.

## Structure

```text
index.html              Interface
styles.css              Thème noir/rouge responsive
app.js                  Authentification et logique interactive
config.example.js       Exemple de configuration
config.js               À créer avant publication
assets/logo.svg         Logo temporaire
supabase/schema.sql     Tables, sécurité RLS et tirage serveur
supabase/seed.sql       12 joueurs et 3 matchs Excel
```

## Sécurité

- Le tirage est exécuté **sur le serveur Supabase** et réservé aux profils `coach`.
- Les modifications des matchs, joueurs et convocations sont réservées au coach via RLS.
- Les parents ne peuvent modifier que leurs propres réponses de transport, identifiées par leur adresse e-mail authentifiée.
- Ne diffusez pas l'adresse GitHub Pages à des personnes étrangères à l'équipe tant que l'inscription par e-mail n'est pas restreinte aux familles concernées. Supabase autorise ici, par défaut, la création de comptes par e-mail, mais les comptes non liés à un joueur n'ont pas de droit de covoiturage.
