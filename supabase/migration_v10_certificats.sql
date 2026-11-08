-- V10 : certificats médicaux des joueurs. À exécuter une fois dans SQL Editor.
-- Les documents sont des données de santé de mineurs : stockage PRIVÉ, rôle coach exclusivement.

create table if not exists public.medical_certificates (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  file_name text not null check (length(file_name) between 1 and 180),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  file_size bigint not null check (file_size between 1 and 10485760),
  issued_on date,
  expires_on date,
  created_at timestamptz not null default now(),
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  constraint certificate_validity_dates check (expires_on is null or issued_on is null or expires_on >= issued_on),
  constraint storage_folder_matches_player check (split_part(storage_path, '/', 1) = player_id::text)
);
create index if not exists medical_certificates_player_idx on public.medical_certificates(player_id);
alter table public.medical_certificates enable row level security;
revoke all on public.medical_certificates from anon;
revoke all on public.medical_certificates from authenticated;
grant select,insert,delete on public.medical_certificates to authenticated;

drop policy if exists "Coach read medical certificates" on public.medical_certificates;
create policy "Coach read medical certificates" on public.medical_certificates for select to authenticated
 using (public.is_coach());
drop policy if exists "Coach upload medical certificates" on public.medical_certificates;
create policy "Coach upload medical certificates" on public.medical_certificates for insert to authenticated
 with check (public.is_coach() and uploaded_by=auth.uid());
drop policy if exists "Coach delete medical certificates" on public.medical_certificates;
create policy "Coach delete medical certificates" on public.medical_certificates for delete to authenticated
 using (public.is_coach());

-- Bucket privé. Aucune lecture publique ni inscription anonyme.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('medical-certificates','medical-certificates',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Coach read medical storage" on storage.objects;
create policy "Coach read medical storage" on storage.objects for select to authenticated
 using (bucket_id='medical-certificates' and public.is_coach());
drop policy if exists "Coach insert medical storage" on storage.objects;
create policy "Coach insert medical storage" on storage.objects for insert to authenticated
 with check (bucket_id='medical-certificates' and public.is_coach()
 and (storage.foldername(name))[1] is not null
 and exists (select 1 from public.players p where p.id::text=(storage.foldername(name))[1]));
drop policy if exists "Coach delete medical storage" on storage.objects;
create policy "Coach delete medical storage" on storage.objects for delete to authenticated
 using (bucket_id='medical-certificates' and public.is_coach());

-- Vérification après Run : vérifier 'public = false' dans Storage -> medical-certificates.
