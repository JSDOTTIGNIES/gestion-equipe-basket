-- JS Dottignies V11 : notifications aux parents, sans rendre les données publiques.
-- Exécuter après les migrations V5 et V6. Aucun document médical concerné.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint endpoint_url check (endpoint ~ '^https://')
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;
grant select,insert,update,delete on public.push_subscriptions to authenticated;
drop policy if exists "push own read" on public.push_subscriptions;
create policy "push own read" on public.push_subscriptions for select to authenticated using (user_id=auth.uid());
drop policy if exists "push own insert" on public.push_subscriptions;
create policy "push own insert" on public.push_subscriptions for insert to authenticated with check (user_id=auth.uid() and not public.is_coach() and exists(select 1 from public.parent_roles pr where pr.user_id=auth.uid()));
drop policy if exists "push own update" on public.push_subscriptions;
create policy "push own update" on public.push_subscriptions for update to authenticated using (user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "push own delete" on public.push_subscriptions;
create policy "push own delete" on public.push_subscriptions for delete to authenticated using(user_id=auth.uid());

create table if not exists public.push_events (
 id uuid primary key default gen_random_uuid(),
 match_id uuid not null references public.matches(id) on delete cascade,
 player_id uuid not null references public.players(id) on delete cascade,
 kind text not null check (kind in ('convocation','reminder_24h')),
 created_at timestamptz not null default now(),
 delivered_at timestamptz,
 unique(match_id,player_id,kind)
);
create index if not exists push_events_pending_idx on public.push_events(created_at) where delivered_at is null;
alter table public.push_events enable row level security;
revoke all on public.push_events from anon,authenticated;

create table if not exists public.push_deliveries (
 event_id uuid not null references public.push_events(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 delivered_at timestamptz not null default now(),
 primary key(event_id,subscription_id)
);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from anon,authenticated;

-- Une insertion dans selections est une nouvelle convocation ; pas de doublon si l'on sauvegarde à nouveau.
create or replace function public.queue_match_convocation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.push_events(match_id,player_id,kind)
 values(new.match_id,new.player_id,'convocation')
 on conflict(match_id,player_id,kind) do nothing;
 return new;
end; $$;
revoke all on function public.queue_match_convocation() from public,anon,authenticated;
drop trigger if exists trigger_queue_match_convocation on public.selections;
create trigger trigger_queue_match_convocation after insert on public.selections
for each row execute function public.queue_match_convocation();

-- Rappels programmés exactement autour de J-1 (heure locale Europe/Brussels).
-- Fonction uniquement appelée par le worker privilégié, via sa connexion service_role.
create or replace function public.enqueue_24h_reminders()
returns integer language plpgsql security invoker set search_path=public as $$
declare v_count integer;
begin
 insert into public.push_events(match_id,player_id,kind)
 select m.id,s.player_id,'reminder_24h'
 from public.matches m
 join public.selections s on s.match_id=m.id
 left join public.child_attendance a on a.match_id=m.id and a.player_id=s.player_id
 where a.player_id is null
   and ((m.match_date + coalesce(m.match_time,time '00:00')) at time zone 'Europe/Brussels')
      >= now() + interval '24 hours'
   and ((m.match_date + coalesce(m.match_time,time '00:00')) at time zone 'Europe/Brussels')
      < now() + interval '24 hours 5 minutes'
 on conflict(match_id,player_id,kind) do nothing;
 get diagnostics v_count=row_count;
 return v_count;
end; $$;
revoke all on function public.enqueue_24h_reminders() from public,anon,authenticated;
grant execute on function public.enqueue_24h_reminders() to service_role;

-- Les événements existants ne sont pas rétrospectivement envoyés : seuls les nouveaux
-- joueurs convoqués et les rappels futurs génèrent des notifications.
