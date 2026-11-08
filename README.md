# JS Dottignies V10 — Certificats médicaux

## Installation
1. Supabase → SQL Editor : exécuter `supabase/migration_v10_certificats.sql`.
2. Supabase → Storage : confirmer que le bucket `medical-certificates` est **Private**.
3. GitHub : remplacer `index.html`, `app.js`, `styles.css`, `service-worker.js`. Ne pas modifier `config.js`.
4. Après déploiement, recharger l’application et se connecter avec le compte coach. L'onglet **Certificats médicaux** apparaît uniquement pour ce rôle.

## Fonctions
- Dossier de documents par joueur, PDF/JPG/PNG, 10 Mo maximum.
- Ajout avec dates facultatives de certificat et de validité ; consultation par URL signée expirant en 60 secondes ; suppression.
- Contrôles serveur Supabase RLS : lecture, envoi et suppression interdits aux parents et visiteurs.
- **Aucun certificat médical dans GitHub.** Les fichiers déposés restent dans le bucket privé.

## Précautions
Les certificats concernent des mineurs et sont des données de santé : limiter les accès au coach, informer les familles, limiter la durée de conservation, supprimer les documents devenus inutiles et s'assurer de la conformité RGPD. Éviter les comptes coach partagés lorsque c'est possible.
La fonction affiche une date de fin de validité **déclarée**, sans certifier automatiquement la validité médicale.
L'upload est limité aux PDF et images ; les scans antivirus ne sont pas inclus. Le code a été vérifié statiquement, mais pas testé avec un projet Supabase en direct.
