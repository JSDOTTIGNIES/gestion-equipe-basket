# JS Dottignies — V6 : parents sans e-mail, Papa et Maman

## Fonctionnement

- Chaque parent choisit un **identifiant** de 4 à 24 caractères et un **code personnel** de 8 caractères minimum. **Aucune adresse e-mail à saisir ou à confirmer**.
- Au premier accès, il saisit son nom, sélectionne son enfant et choisit **Papa** ou **Maman**. L'association est immédiate, sans validation du coach.
- **Deux comptes maximum par joueur** : un Papa et une Maman. Un parent ne peut associer qu'un enfant à ce compte (version actuelle).
- La **présence OUI/NON** est unique par joueur et par match, donc partagée entre ses parents. **Trajet et places de voiture** restent propres à chacun.
- L'accès coach par code est conservé, avec les matchs, convocations et tirages.
- La PWA peut être installée sur le téléphone; les sessions sont conservées tant qu'elles restent valides.
- **Les notifications push automatiques ne sont pas encore activées**, faute de service d'envoi serveur et de souscription des téléphones.

## Installer sur le projet Supabase existant

1. Dans **Supabase > Authentication > Sign In / Providers > Email**, **désactiver Confirm email**. Conserver l'authentification par e-mail/mot de passe activée. Cela est nécessaire à la création des comptes techniques sans boîte e-mail. Ne désactivez pas les règles RLS. Cette modification affecte tous les utilisateurs de ce projet Supabase uniquement (pas le projet Saint-Nicolas séparé).
2. Dans **Supabase > SQL Editor > New query**, exécuter **`supabase/migration_v6.sql`**, après avoir déjà installé la migration V5. Aucune donnée existante n'est effacée.
3. Dans GitHub, remplacer `index.html`, `app.js`, `styles.css`, `service-worker.js`. Conserver `config.js` (le compte coach déjà configuré), les icônes et le manifeste.
4. Vérifier que le dernier déploiement Pages est vert, puis rafraîchir l'application. Sur mobile, fermer et rouvrir la PWA pour déclencher la mise à jour du cache.
5. Inscrire un premier parent, puis un second avec un identifiant différent pour le même enfant (Papa puis Maman). Tester ensuite une convocation et les deux modes de réponse.

## Détail technique de l'authentification

Supabase Auth n'a pas de connexion native par identifiant libre sans e-mail. Cette V6 utilise en interne une **adresse technique non destinée à recevoir des messages** : `identifiant@parents.jsdottignies.be` avec Auth email/password. Les parents ne voient ni ne saisissent cette adresse. **Le domaine devrait être contrôlé par le club pour une utilisation de production**. L'utilisateur créé reçoit un profil Supabase `parent`; aucune clé secrète n'est placée sur GitHub. Désactiver la confirmation d'e-mail rend le flux possible, mais rend aussi le compte impossible à vérifier par e-mail.

Cette méthode est une solution de transition adaptée à un petit groupe, **pas une preuve d'identité** : sans validation parentale, une personne qui connaît les noms peut réserver un rôle Papa/Maman, consulter les convocations de cet enfant et répondre à sa place. Avant le lancement réel, mettre au minimum un **code d'invitation partagé hors de l'application** ou un code privé par famille, vérifier les politiques RLS, et définir une procédure de récupération des codes (aucune récupération automatique par e-mail). Ajouter aussi une protection contre les tentatives répétées, surtout pour le code coach de 6 caractères.

## Limites

- Les comptes parents V5 utilisant de vraies adresses e-mail ne sont pas supprimés, mais n'utilisent pas la nouvelle connexion par identifiant; ils nécessitent une migration manuelle s'ils doivent être conservés.
- Un même parent ayant plusieurs enfants nécessite une évolution ultérieure des associations.
- Ce paquet a été vérifié syntaxiquement, **pas testé de bout en bout sur votre projet Supabase de production**.


## V7 — Logo officiel du club (08/11/2026)
- Ajoute `assets/logo-officiel.png` (fichier original fourni, sans redessin).
- Remplace les icônes `assets/icon-192.png` et `assets/icon-512.png` par des déclinaisons du logo officiel sur fond noir.
- Affiche ce logo dans l'en-tête latéral, l'en-tête mobile et la page de connexion.
- Nouvelle version de cache du service worker : `v7-logo`.
- GitHub : transférer **le contenu** de cette archive à la racine du dépôt, en préservant `config.js`.
- Aucun SQL supplémentaire et aucun changement du code parent/coach.
- Les icônes sur téléphones déjà installés peuvent nécessiter une réinstallation pour être actualisées.


## V8 — Désignations lors des déplacements

- À domicile : trois postes inchangés — Délégué de banc, Chrono, 24/14 secondes.
- En déplacement : deux postes — **Feuille de match** et **Délégué de banc**.
- Tirage automatique et équilibré entre les **familles de deux joueurs convoqués distincts**; une famille ne reçoit pas deux postes sur le même match. Le parent de la famille chargé de la fonction s'organise.
- Le coach lance le tirage depuis la fiche du match et voit les noms désignés; les parents peuvent consulter ces désignations.
- Les matchs et les convocations existants sont conservés.

### Mise à jour

1. **Supabase SQL Editor** : exécuter `supabase/migration_v8.sql` **avant** d'utiliser le tirage des déplacements.
2. **GitHub** : remplacer `app.js` et `service-worker.js` depuis ce paquet. Les autres fichiers sont identiques à V7 et peuvent être conservés.
3. Ne pas remplacer le `config.js` de production.
4. Déploiement GitHub Pages puis rechargement forcé. Si l'application installée sur téléphone affiche l'ancienne version, fermer/réouvrir la PWA.

Note : la fonction attribue les rôles à la **famille du joueur**, comme pour les matchs à domicile, et non à un compte Papa ou Maman individuellement. Une attribution à un parent nominatif nécessiterait une évolution complémentaire.
