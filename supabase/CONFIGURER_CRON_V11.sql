-- ETAPE FACULTATIVE À N'EXECUTER QU'APRES :
-- 1) le déploiement de push-dispatch (verify_jwt=false),
-- 2) la création de l'Edge Function secret CRON_SECRET,
-- 3) la création de deux secrets Supabase Vault nommés js_push_function_url
--    (valeur : https://VOTRE-REF.supabase.co/functions/v1/push-dispatch)
--    et js_push_cron_secret (VALEUR IDENTIQUE à CRON_SECRET).
-- Ne collez aucun secret en clair dans le dépôt GitHub.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Toutes les minutes : notifications après convocation + rappels au voisinage de J-1.
-- Supabase Vault permet de garder le secret hors du texte de cette tâche.
select cron.schedule(
 'js-dottignies-push-v11',
 '* * * * *',
 $$
 select net.http_post(
   url := (select decrypted_secret from vault.decrypted_secrets where name='js_push_function_url' limit 1),
   headers := jsonb_build_object(
     'Content-Type','application/json',
     'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='js_push_cron_secret' limit 1)
   ),
   body := '{}'::jsonb,
   timeout_milliseconds := 20000
 );
 $$
);
