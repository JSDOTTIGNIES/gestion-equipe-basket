# JS Dottignies V11.2 — Désactivation des notifications

Cette mise à jour ajoute le bouton **🔕 Désactiver les notifications** dans « Mes enfants & convocations ». Le parent peut supprimer son abonnement push pour **ce téléphone uniquement**, sans se déconnecter ni modifier les convocations, le covoiturage ou les notifications de l'autre parent.

- Après activation, le bouton « Désactiver » apparaît à la place du bouton « Activer ».
- Après désactivation, le bouton « Activer » réapparaît.
- Le téléphone n'est plus abonné. L'autorisation système iOS/Android reste gérée dans les paramètres du téléphone.
- L'application a déjà les règles Supabase `DELETE` nécessaires (migration V11). **Aucun nouveau SQL, secret ou Cron n'est requis.**

## Déploiement GitHub
Remplacer `index.html`, `app.js` et `service-worker.js` par ceux de ce ZIP. Aucun changement de `styles.css` n'est requis. Ne pas écraser `config.js` : conserver la configuration du projet et la clé VAPID publique.

## Test
Sur un téléphone avec notifications activées, ouvrir l'application installée, se connecter comme parent et toucher « Désactiver les notifications ». Vérifier que « Activer les notifications » revient, puis réactiver si souhaité. Sur iPhone, tester depuis l'application ajoutée à l'écran d'accueil.

# JS Dottignies — V11 Notifications (rappel 24 heures avant)

Version basée sur **V10 Certificats médicaux**. Tous les éléments de V10 sont conservés : connexion coach, parents sans e-mail, Papa/Maman, calendrier, désignations domicile/déplacement, stockage privé des certificats.

## Ce qui est inclus

- Un bouton **🔔 Activer les notifications** dans « Mes enfants & convocations », après connexion parent.
- Une souscription **par téléphone et par compte parent**, enregistrée dans `push_subscriptions` avec RLS.
- Une notification pour **chacun des deux parents** du joueur lorsqu'il est convoqué (dès l'enregistrement côté coach, distribuée au prochain passage du worker).
- Un **rappel 24 h avant le match** seulement si aucune présence OUI/NON n'est enregistrée pour l'enfant. Si Papa ou Maman répond, pas de rappel pour cet enfant.
- Appui sur la notification : ouverture de l'application et du formulaire de réponse pour l'enfant convoqué.
- Icônes et logo officiels conservés.
- Aucun accès public aux listes de souscriptions ou aux certificats médicaux.

## 1 — Supabase SQL

Dans SQL Editor, exécuter une seule fois `supabase/migration_v11_notifications.sql` **après** les migrations précédentes. Les données existantes sont conservées. La migration ne renvoie aucun push rétroactif pour les convocations déjà créées.

## 2 — GitHub Pages

Remplacer `index.html`, `app.js`, `styles.css`, `service-worker.js` et conserver `config.js` existant. Garder les fichiers `assets`, `manifest.webmanifest` et les migrations historiques.

Ajouter **une seule propriété** dans `config.js`, à l'intérieur de `window.JS_CONFIG` :

```js
pushPublicKey: 'VOTRE_CLE_PUBLIQUE_VAPID'
```

La virgule doit être présente après la propriété précédente. **Ne jamais mettre la clé PRIVÉE VAPID, le secret CRON, ou une clé Supabase `service_role` dans GitHub**.

## 3 — Générer la paire de clés VAPID

Sur un poste avec Node.js, exécuter **une seule fois** :

```bash
npx web-push generate-vapid-keys
```

La **publicKey** va dans `config.js` (elle n'est pas secrète). Stocker la **privateKey** uniquement dans les secrets de Supabase Edge Functions. Conserver cette paire entre les déploiements pour ne pas invalider les souscriptions.

## 4 — Déployer une Edge Function Supabase

Déployer le dossier `supabase/functions/push-dispatch`, avec `verify_jwt=false` (voir `supabase/config.toml`). La fonction exige en plus l'en-tête **`x-cron-secret`** : elle n'est pas utilisable publiquement sans ce secret.

Définir dans **Supabase → Edge Functions → Secrets** les valeurs suivantes :

- `VAPID_PUBLIC_KEY` : clé publique générée ;
- `VAPID_PRIVATE_KEY` : clé privée générée ;
- `VAPID_SUBJECT` : une adresse de contact `mailto:adresse@domaine.be` valide ou une URL HTTPS ;
- `CRON_SECRET` : longue valeur aléatoire (au moins 32 octets). 

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont normalement injectées dans les Edge Functions Supabase ; vérifier leur présence côté serveur. **Ne jamais les exposer au navigateur**.

Exemple avec CLI Supabase :

```bash
supabase login
supabase link --project-ref VOTRE_REF
supabase functions deploy push-dispatch --no-verify-jwt
```

Vérifier le déploiement, puis configurer l'exécution périodique ; **un déploiement de l'Edge Function seul n'envoie pas de notification**.

## 5 — Activer l'envoi automatique et le rappel J-1

Activer `pg_cron`, `pg_net` et **Supabase Vault** si nécessaire. Dans **Supabase Vault**, créer les entrées :

- `js_push_function_url` = `https://VOTRE_REF.supabase.co/functions/v1/push-dispatch`
- `js_push_cron_secret` = la même valeur que le secret `CRON_SECRET` configuré dans l'Edge Function.

Ensuite exécuter le fichier `supabase/CONFIGURER_CRON_V11.sql` : une tâche appellera la fonction **toutes les minutes**. La fonction place les rappels dans la file lorsqu'un match est prévu dans environ 24 heures (fuseau horaire **Europe/Brussels**), puis distribue les événements.

**Important :** si la tâche n'est pas activée, l'application peut enregistrer les autorisations mais aucun push à distance ne sera envoyé.

## 6 — Test sur un téléphone

1. Ouvrir le site sur iPhone **depuis Safari**, puis **Partager → Sur l'écran d'accueil**. Ouvrir ensuite l'icône installée. Sur Android, installer via Chrome.
2. Se connecter comme Papa ou Maman ; cliquer sur **Activer les notifications**, puis accepter la permission du système. Répéter sur le deuxième téléphone.
3. Coach : convoquer un joueur qui n'était pas encore sélectionné, et enregistrer.
4. Vérifier un push sur les deux appareils. Un clic doit ouvrir la convocation ; une réponse sur un appareil doit être visible de l'autre.
5. Pour le rappel J-1, utiliser un **match de test daté de 24 h à 24 h 5 min dans le futur** et laisser la présence sans réponse. Ne pas envoyer de rappels pour des dates passées.

## Sécurité et limites

- Les notifications demandent un consentement explicite ; elles ne peuvent pas être activées silencieusement après installation.
- iPhone : Web Push requiert iOS 16.4+ **et** une application installée sur l'écran d'accueil ; un navigateur intégré à WhatsApp ne suffit pas.
- Les notifications peuvent être différées par le système (économie d'énergie, réseau, restrictions iOS).
- Les événements sont mis en file côté serveur : la livraison à chaque appareil dépend du service push.
- Les liens n'incorporent aucun jeton d'authentification ; l'accès à la convocation reste protégé par la session Supabase.
- Vérifier le RGPD, informer les parents et limiter la conservation des endpoints de notification.
- **Non testé dans votre instance Supabase de production** ; valider la fonction, les secrets et le cron avant diffusion aux familles.
