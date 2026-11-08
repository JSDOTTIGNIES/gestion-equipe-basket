-- V6: 2 parents (papa/maman), inscription sans e-mail réel.
-- Exécuter après migration_v5.sql; aucune table existante n'est supprimée.
-- Pour des comptes sans boîte e-mail, désactiver 'Confirm email' dans Supabase Auth > Providers > Email.
-- Le client utilise une adresse technique interne username@parents.jsdottignies.be;
-- l'identifiant et le secret ne doivent jamais être considérés comme preuve de parentalité.

create table if not exists public.parent_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 player_id uuid not null references public.players(id) on delete cascade,
 relationship text not null check (relationship in ('papa','maman')),
 display_name text not null check (length(btrim(display_name)) between 2 and 100),
 created_at timestamptz not null default now(),
 unique(player_id, relationship)
);
create index if not exists parent_roles_player_idx on public.parent_roles(player_id);
alter table public.parent_roles enable row level security;
grant select on public.parent_roles to authenticated;
drop policy if exists "parent roles self or coach" on public.parent_roles;
create policy "parent roles self or coach" on public.parent_roles for select to authenticated
 using (user_id=auth.uid() or public.is_coach());

create or replace function public.is_parent_of(p_player_id uuid)
 returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.parent_roles r where r.player_id=p_player_id and r.user_id=auth.uid());
$$;
revoke all on function public.is_parent_of(uuid) from public,anon;
grant execute on function public.is_parent_of(uuid) to authenticated;

create or replace function public.claim_parent_role(p_player_id uuid,p_relationship text,p_display_name text)
 returns void language plpgsql security definer set search_path=public as $$
declare v_email text; v_role text;
begin
 if auth.uid() is null then raise exception 'Connexion parent requise'; end if;
 if public.is_coach() then raise exception 'Le coach ne peut pas créer une association parent'; end if;
 if p_relationship not in ('papa','maman') then raise exception 'Choisissez Papa ou Maman'; end if;
 if length(btrim(coalesce(p_display_name,''))) not between 2 and 100 then raise exception 'Nom invalide'; end if;
 if not exists(select 1 from public.players where id=p_player_id and active) then raise exception 'Joueur introuvable'; end if;
 select lower(email) into v_email from auth.users where id=auth.uid();
 if v_email is null or v_email not like '%@parents.jsdottignies.be' then raise exception 'Compte parent sans e-mail non reconnu'; end if;
 if exists(select 1 from public.parent_roles where user_id=auth.uid()) then raise exception 'Ce compte est déjà associé à un enfant'; end if;
 -- Empêche deux papas ou deux mamans sur le même joueur et limite donc à deux parents.
 insert into public.parent_roles(user_id,player_id,relationship,display_name)
 values(auth.uid(),p_player_id,p_relationship,btrim(p_display_name));
 insert into public.guardians(player_id,name,email)
 values(p_player_id,btrim(p_display_name),v_email)
 on conflict(player_id,email) do update set name=excluded.name;
end; $$;
revoke all on function public.claim_parent_role(uuid,text,text) from public,anon;
grant execute on function public.claim_parent_role(uuid,text,text) to authenticated;

-- Une présence par enfant et par match, partagée entre ses 2 parents.
create table if not exists public.child_attendance (
 match_id uuid not null references public.matches(id) on delete cascade,
 player_id uuid not null references public.players(id) on delete cascade,
 attendance text not null check (attendance in ('yes','no')),
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(match_id,player_id)
);
alter table public.child_attendance enable row level security;
grant select on public.child_attendance to authenticated;
drop policy if exists "child attendance read" on public.child_attendance;
create policy "child attendance read" on public.child_attendance for select to authenticated
 using(public.is_coach() or public.is_parent_of(player_id));

-- Réponse atomique: présence unique + trajet individuel + places.
create or replace function public.save_parent_reply(
 p_match_id uuid,p_guardian_id uuid,p_attendance text,p_travel text,p_seats int
) returns void language plpgsql security definer set search_path=public as $$
declare v_player uuid; v_home boolean; v_car boolean; v_travel text; v_seats int;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 select player_id into v_player from public.guardians where id=p_guardian_id and lower(email)=lower(auth.jwt()->>'email');
 if v_player is null or not public.is_parent_of(v_player) then raise exception 'Parent non autorisé pour ce joueur'; end if;
 if p_attendance not in ('yes','no') or p_travel not in ('direct','car','need_ride','none') then raise exception 'Réponse invalide'; end if;
 select is_home into v_home from public.matches where id=p_match_id;
 if v_home is null then raise exception 'Match introuvable'; end if;
 if not exists(select 1 from public.selections where match_id=p_match_id and player_id=v_player)
 then raise exception 'Joueur non convoqué'; end if;
 v_travel:=case when p_attendance='no' then 'none' else p_travel end;
 v_car:=p_attendance='yes' and not v_home and v_travel='car';
 v_seats:=case when v_car then p_seats else 0 end;
 if v_seats is null or v_seats not between 0 and 8 then raise exception 'Nombre de places invalide'; end if;
 insert into public.child_attendance(match_id,player_id,attendance,updated_by,updated_at)
 values(p_match_id,v_player,p_attendance,auth.uid(),now())
 on conflict(match_id,player_id) do update set attendance=excluded.attendance,updated_by=excluded.updated_by,updated_at=now();
 insert into public.match_responses(match_id,guardian_id,attendance,travel,seats,updated_at)
 values(p_match_id,p_guardian_id,p_attendance,v_travel,v_seats,now())
 on conflict(match_id,guardian_id) do update set attendance=excluded.attendance,travel=excluded.travel,seats=excluded.seats,updated_at=now();
 if not v_home then
 insert into public.transport_offers(match_id,guardian_id,available,seats,comment)
 values(p_match_id,p_guardian_id,v_car,v_seats,case when v_travel='direct' then 'Trajet direct' when v_travel='need_ride' then 'Recherche une place' else '' end)
 on conflict(match_id,guardian_id) do update set available=excluded.available,seats=excluded.seats,comment=excluded.comment;
 end if;
end; $$;
revoke all on function public.save_parent_reply(uuid,uuid,text,text,int) from public,anon;
grant execute on function public.save_parent_reply(uuid,uuid,text,text,int) to authenticated;

-- Expose uniquement prénom/nom et identifiant du joueur sur l'écran d'inscription,
-- sans donner accès public aux données des parents et convocations.
create or replace function public.list_public_players()
 returns table(id uuid,name text)
 language sql stable security definer set search_path=public as $$
 select p.id,p.name from public.players p where p.active order by p.name;
$$;
revoke all on function public.list_public_players() from public;
grant execute on function public.list_public_players() to anon,authenticated;
