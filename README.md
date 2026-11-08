# JS Dottignies U14 — V5 : espace parents et installation mobile

## Ce qui est ajouté

- Un parent se connecte avec le lien envoyé par e-mail, puis choisit son enfant dans la liste et saisit son nom.
- Pour protéger les joueurs, l'association est une **demande**. Le coach la valide dans **Effectif & parents**. Le compte parent est ensuite lié au(x) joueur(s) concerné(s).
- Le parent peut répondre pour chaque enfant effectivement convoqué : **Présent OUI/NON**, **nous allons directement sur place**, **je propose ma voiture**, **j'ai besoin d'une place**, et nombre de places passagers (0 à 8). Les matchs à l'extérieur alimentent aussi le récapitulatif de covoiturage.
- Le coach voit les demandes en attente et les réponses de présence dans le détail du match.
- L'application est installable sur l'écran d'accueil via le manifeste PWA, un service worker et les icônes du logo officiel JS Dottignies. Supabase conserve la session sur l'appareil tant que la session reste valide.

## Installation sur votre projet existant

1. **Supabase → SQL Editor → New query** : copier et exécuter **une fois** `supabase/migration_v5.sql`. Ne pas réexécuter `schema.sql` ou `seed.sql` et ne pas vider les tables.
2. **GitHub → dépôt JSDOTTIGNIES/gestion-equipe-basket** : remplacer `index.html`, `app.js`, `styles.css`; ajouter `manifest.webmanifest`, `service-worker.js`, `assets/icon-192.png`, `assets/icon-512.png`.
3. **Ne PAS écraser `config.js`** : conserver l'URL Supabase, la publishable key et `coachLoginEmail`.
4. Attendre le statut vert du dernier déploiement dans GitHub Actions, puis recharger l'application une fois avec Ctrl+F5.
5. Tester avec **un compte parent** et un compte coach. L'association proposée par le parent doit apparaître en attente dans **Effectif & parents**. La validation doit rendre le joueur disponible dans « Mes enfants ».
6. Tester : convocation d'un joueur par le coach, réponse OUI/NON du parent, offre de places et affichage côté coach.

## Installer sur téléphone

- **iPhone (Safari)** : ouvrir `https://jsdottignies.github.io/gestion-equipe-basket/`, menu Partager → **Sur l'écran d'accueil** → Ajouter. La PWA doit ensuite être lancée depuis son icône.
- **Android (Chrome)** : ouvrir la même adresse, menu ⋮ → **Installer l'application** / **Ajouter à l'écran d'accueil**.
- La connexion est maintenue par Supabase `persistSession`, sous réserve de validité de la session. Sur iPhone, Safari et l'app installée peuvent avoir des stockages distincts : une première connexion depuis l'app installée peut être nécessaire.

## Notifications importantes — état réel

La V5 rend l'application installable et inclut une base technique de réception de push dans le service worker, **mais n'envoie pas encore de notifications distantes automatiques**. Les notifications lorsqu'une application est fermée nécessitent encore :

1. L'inscription du téléphone auprès du service Web Push avec consentement explicite (et conservation sécurisée de son abonnement dans Supabase).
2. Un composant serveur d'envoi (Supabase Edge Function avec VAPID ou service équivalent) et les secrets conservés côté serveur, jamais dans GitHub Pages.
3. Le déclenchement serveur après une **nouvelle** convocation ou modification de convocation, avec dédoublonnage et lien vers le match.
4. Les tests sur Android et iPhone (Web Push fonctionne sur iPhone pour les apps ajoutées à l'écran d'accueil depuis iOS 16.4).

**Ne pas annoncer aux parents que les notifications automatiques sont actives avant d'avoir déployé et testé ce service.**

## Sécurité et confidentialité

- Un parent ne peut pas s'attribuer directement un joueur : le coach doit approuver la demande côté Supabase (`review_parent_link`).
- Les réponses de présence sont protégées par RLS et liées à l'e-mail Supabase authentifié. Le coach voit les réponses et parents voient uniquement leurs propres réponses de présence.
- Les parents doivent être informés de la visibilité des offres de covoiturage pour l'équipe. Limiter l'accès aux personnes concernées.
- Éviter de placer des données personnelles de mineurs, mots de passe ou secrets de serveur dans un dépôt GitHub public.
- L'accès coach par 2 lettres + 4 chiffres reste faible : prévoir des protections contre les tentatives répétées et une méthode de récupération sécurisée avant diffusion.

## Remarque

Le code et la syntaxe JavaScript ont été contrôlés localement. Le parcours complet Supabase et les téléphones réels **n'ont pas été testés**. Si Supabase renvoie une erreur SQL, **ne pas modifier les politiques de sécurité à l'aveugle** : consulter le message exact.
