-- JS Dottignies | Exécuter une fois dans Supabase > SQL Editor
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'parent' check(role in ('parent','coach')),
  created_at timestamptz not null default now()
);
create or replace function public.on_user_created() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,email,role) values(new.id, coalesce(new.email,''), 'parent') on conflict (id) do update set email=excluded.email;
  return new;
end; $$;
drop trigger if exists auth_user_profile on auth.users;
create trigger auth_user_profile after insert on auth.users for each row execute procedure public.on_user_created();

create or replace function public.is_coach() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='coach');
$$;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(), external_id text unique,
  competition text, match_date date not null, match_time time not null,
  home_team text not null, away_team text not null, venue text,
  is_home boolean not null, meeting_location text check(meeting_location in ('Salle JS Dottignies','Actalex')),
  meeting_time time, departure_time time,
  notes text not null default '', created_at timestamptz not null default now()
);

-- Empêcher les doublons même en cas d'imports simultanés.
create unique index if not exists matches_unique_fixture
  on public.matches(match_date, lower(btrim(home_team)), lower(btrim(away_team)));

create table if not exists public.selections (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  primary key(match_id,player_id)
);
create table if not exists public.assignments (
  match_id uuid not null references public.matches(id) on delete cascade,
  role text not null check(role in ('Délégué de banc','Chrono','24/14 secondes')),
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(match_id,role), unique(match_id,player_id)
);
create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  name text not null, email text not null, created_at timestamptz not null default now(),
  unique(player_id,email)
);
create table if not exists public.transport_offers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  available boolean not null default false,
  seats integer not null default 0 check(seats between 0 and 20),
  comment text not null default '', updated_at timestamptz not null default now(),
  unique(match_id,guardian_id)
);
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
drop trigger if exists update_transport_time on public.transport_offers;
create trigger update_transport_time before update on public.transport_offers for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.selections enable row level security;
alter table public.assignments enable row level security;
alter table public.guardians enable row level security;
alter table public.transport_offers enable row level security;

create policy "profile read own or coach" on public.profiles for select to authenticated using (id=auth.uid() or public.is_coach());
create policy "players read" on public.players for select to authenticated using (true);
create policy "players coach insert" on public.players for insert to authenticated with check(public.is_coach());
create policy "players coach update" on public.players for update to authenticated using(public.is_coach()) with check(public.is_coach());
create policy "matches read" on public.matches for select to authenticated using (true);
create policy "matches coach insert" on public.matches for insert to authenticated with check(public.is_coach());
create policy "matches coach update" on public.matches for update to authenticated using(public.is_coach()) with check(public.is_coach());
create policy "selections read" on public.selections for select to authenticated using(true);
create policy "selections coach insert" on public.selections for insert to authenticated with check(public.is_coach());
create policy "selections coach delete" on public.selections for delete to authenticated using(public.is_coach());
create policy "assignments read" on public.assignments for select to authenticated using(true);
create policy "guardians read own or coach" on public.guardians for select to authenticated using(public.is_coach() or lower(email)=lower(coalesce(auth.jwt()->>'email','')));
create policy "guardians coach insert" on public.guardians for insert to authenticated with check(public.is_coach());
create policy "guardians coach update" on public.guardians for update to authenticated using(public.is_coach()) with check(public.is_coach());
create policy "guardians coach delete" on public.guardians for delete to authenticated using(public.is_coach());
create policy "transport read" on public.transport_offers for select to authenticated using(true);
create policy "transport insert" on public.transport_offers for insert to authenticated with check(
  public.is_coach() or exists(select 1 from public.guardians g join public.matches m on m.id=match_id where g.id=guardian_id and not m.is_home and lower(g.email)=lower(coalesce(auth.jwt()->>'email','')))
);
create policy "transport update" on public.transport_offers for update to authenticated using(
  public.is_coach() or exists(select 1 from public.guardians g where g.id=guardian_id and lower(g.email)=lower(coalesce(auth.jwt()->>'email','')))
) with check(
  public.is_coach() or exists(select 1 from public.guardians g join public.matches m on m.id=match_id where g.id=guardian_id and not m.is_home and lower(g.email)=lower(coalesce(auth.jwt()->>'email','')))
);

-- Mettre à jour les convocations en une transaction ; un changement de sélection
-- invalide le tirage précédent pour ne jamais désigner un joueur non convoqué.
create or replace function public.save_match_selections(p_match_id uuid, p_player_ids uuid[])
returns void language plpgsql security definer set search_path=public as $$
declare v_ids uuid[];
begin
  if not public.is_coach() then raise exception 'Accès coach requis'; end if;
  if not exists(select 1 from public.matches where id=p_match_id) then raise exception 'Match introuvable'; end if;
  select coalesce(array_agg(distinct x), array[]::uuid[]) into v_ids from unnest(coalesce(p_player_ids,array[]::uuid[])) x;
  if exists(select 1 from unnest(v_ids) x where not exists(select 1 from public.players p where p.id=x and p.active))
  then raise exception 'Joueur invalide ou inactif'; end if;
  perform pg_advisory_xact_lock(hashtext(p_match_id::text));
  if exists ((select player_id from public.selections where match_id=p_match_id except select unnest(v_ids))
     union all (select unnest(v_ids) except select player_id from public.selections where match_id=p_match_id)) then
    delete from public.assignments where match_id=p_match_id;
    delete from public.selections where match_id=p_match_id;
    insert into public.selections(match_id,player_id) select p_match_id,x from unnest(v_ids) x;
  end if;
end; $$;
revoke all on function public.save_match_selections(uuid,uuid[]) from public,anon;
grant execute on function public.save_match_selections(uuid,uuid[]) to authenticated;

-- Tirage côté serveur : joueurs convoqués uniquement, sans doublon par match.
-- Favorise ceux qui ont eu le moins de responsabilités dans la saison,
-- puis un ordre aléatoire entre familles à égalité.
create or replace function public.draw_home_assignments(p_match_id uuid)
returns table(role text, player_id uuid, player_name text)
language plpgsql security definer set search_path=public as $$
declare v_home boolean; v_count integer; v_role text; v_player uuid;
begin
  if not public.is_coach() then raise exception 'Accès coach requis'; end if;
  perform pg_advisory_xact_lock(hashtext(p_match_id::text));
  select is_home into v_home from public.matches where id=p_match_id;
  if v_home is null then raise exception 'Match introuvable'; end if;
  if not v_home then raise exception 'Tirage réservé aux matchs à domicile'; end if;
  select count(*) into v_count from public.selections where match_id=p_match_id;
  if v_count<3 then raise exception 'Sélectionnez au moins trois joueurs'; end if;
  delete from public.assignments where match_id=p_match_id;
  foreach v_role in array array['Délégué de banc','Chrono','24/14 secondes'] loop
    select s.player_id into v_player from public.selections s
      join public.players p on p.id=s.player_id
      where s.match_id=p_match_id and p.active
        and not exists(select 1 from public.assignments a where a.match_id=p_match_id and a.player_id=s.player_id)
      order by (select count(*) from public.assignments a where a.player_id=s.player_id and a.role=v_role),
               (select count(*) from public.assignments a where a.player_id=s.player_id),
               random() limit 1;
    if v_player is null then raise exception 'Au moins trois joueurs actifs doivent être sélectionnés'; end if;
    insert into public.assignments(match_id,role,player_id) values(p_match_id,v_role,v_player);
  end loop;
  return query select a.role,a.player_id,p.name from public.assignments a join public.players p on p.id=a.player_id where a.match_id=p_match_id;
end; $$;
revoke all on function public.draw_home_assignments(uuid) from public,anon;
grant execute on function public.draw_home_assignments(uuid) to authenticated;

-- Créer le compte coach depuis l'écran de connexion, puis le promouvoir :
-- update public.profiles set role='coach' where lower(email)=lower('coach@exemple.be');
