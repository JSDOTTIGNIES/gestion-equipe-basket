-- V5 : à exécuter UNE SEULE FOIS sur la base existante. Ne supprime aucune donnée.
create table if not exists public.parent_link_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 player_id uuid not null references public.players(id) on delete cascade,
 parent_name text not null check(length(trim(parent_name)) between 2 and 100),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 unique(user_id, player_id)
);
create table if not exists public.match_responses (
 match_id uuid not null references public.matches(id) on delete cascade,
 guardian_id uuid not null references public.guardians(id) on delete cascade,
 attendance text not null check(attendance in ('yes','no')),
 travel text not null check(travel in ('direct','car','need_ride','none')),
 seats int not null default 0 check(seats between 0 and 8),
 updated_at timestamptz not null default now(),
 primary key(match_id, guardian_id)
);

alter table public.parent_link_requests enable row level security;
alter table public.match_responses enable row level security;

grant select,insert,update on public.parent_link_requests to authenticated;
grant select,insert,update on public.match_responses to authenticated;
-- Autoriser la lecture de ses enfants validés (déjà autorisée par la RLS de guardians).
grant select on public.guardians to authenticated;

drop policy if exists "links read own or coach" on public.parent_link_requests;
create policy "links read own or coach" on public.parent_link_requests for select to authenticated
 using (user_id=auth.uid() or public.is_coach());
drop policy if exists "links request own" on public.parent_link_requests;
create policy "links request own" on public.parent_link_requests for insert to authenticated
 with check (user_id=auth.uid() and status='pending');
-- Aucune politique UPDATE accessible aux parents : seul le RPC de validation modifie les demandes.

drop policy if exists "responses read own or coach" on public.match_responses;
create policy "responses read own or coach" on public.match_responses for select to authenticated
 using(public.is_coach() or exists(select 1 from public.guardians g where g.id=guardian_id and lower(g.email)=lower(auth.jwt()->>'email')));
drop policy if exists "responses insert own selected" on public.match_responses;
create policy "responses insert own selected" on public.match_responses for insert to authenticated
 with check (public.is_coach() or (exists(select 1 from public.guardians g where g.id=guardian_id and lower(g.email)=lower(auth.jwt()->>'email')) and exists(select 1 from public.selections s join public.guardians g on g.player_id=s.player_id where s.match_id=match_responses.match_id and g.id=guardian_id)));
drop policy if exists "responses update own selected" on public.match_responses;
create policy "responses update own selected" on public.match_responses for update to authenticated
 using(public.is_coach() or exists(select 1 from public.guardians g where g.id=guardian_id and lower(g.email)=lower(auth.jwt()->>'email')))
 with check(public.is_coach() or (exists(select 1 from public.guardians g where g.id=guardian_id and lower(g.email)=lower(auth.jwt()->>'email')) and exists(select 1 from public.selections s join public.guardians g on g.player_id=s.player_id where s.match_id=match_responses.match_id and g.id=guardian_id)));

create or replace function public.review_parent_link(p_request_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v public.parent_link_requests%rowtype; v_email text;
begin
 if not public.is_coach() then raise exception 'Accès coach requis'; end if;
 select * into v from public.parent_link_requests where id=p_request_id for update;
 if not found then raise exception 'Demande inconnue'; end if;
 if v.status <> 'pending' then raise exception 'Demande déjà traitée'; end if;
 if p_approve then
   select lower(email) into v_email from auth.users where id=v.user_id;
   if v_email is null then raise exception 'Compte parent introuvable'; end if;
   insert into public.guardians(player_id,name,email) values(v.player_id,v.parent_name,v_email)
     on conflict(player_id,email) do update set name=excluded.name;
 end if;
 update public.parent_link_requests set status=case when p_approve then 'approved' else 'rejected' end where id=v.id;
end; $$;
revoke all on function public.review_parent_link(uuid,boolean) from public,anon;
grant execute on function public.review_parent_link(uuid,boolean) to authenticated;

-- La table transport_offers préexistante possède ses propres politiques RLS.
grant select,insert,update on public.transport_offers to authenticated;

-- Demande répétable sans droit de modification direct de la table par les parents.
create or replace function public.request_parent_link(p_player_id uuid,p_parent_name text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 if length(trim(coalesce(p_parent_name,''))) not between 2 and 100 then raise exception 'Nom du parent invalide'; end if;
 if not exists(select 1 from public.players where id=p_player_id and active) then raise exception 'Joueur introuvable'; end if;
 insert into public.parent_link_requests(user_id,player_id,parent_name,status)
 values(auth.uid(),p_player_id,trim(p_parent_name),'pending')
 on conflict(user_id,player_id) do update set parent_name=excluded.parent_name,status='pending';
end; $$;
revoke all on function public.request_parent_link(uuid,text) from public,anon;
grant execute on function public.request_parent_link(uuid,text) to authenticated;
revoke insert,update on public.parent_link_requests from authenticated;
