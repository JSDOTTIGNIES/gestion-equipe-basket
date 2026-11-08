-- Jeu de données issu des fichiers Excel fournis. À exécuter après schema.sql.
-- Réexécutable sans duplication des joueurs ni des matchs.

insert into public.players(name) values('Hector') on conflict (name) do nothing;
insert into public.players(name) values('Matty') on conflict (name) do nothing;
insert into public.players(name) values('Raphaël') on conflict (name) do nothing;
insert into public.players(name) values('Léonard') on conflict (name) do nothing;
insert into public.players(name) values('Ismaïl') on conflict (name) do nothing;
insert into public.players(name) values('Alexandre') on conflict (name) do nothing;
insert into public.players(name) values('Matéo') on conflict (name) do nothing;
insert into public.players(name) values('Eden') on conflict (name) do nothing;
insert into public.players(name) values('Hugo') on conflict (name) do nothing;
insert into public.players(name) values('Ernest') on conflict (name) do nothing;
insert into public.players(name) values('Emylio') on conflict (name) do nothing;
insert into public.players(name) values('Célestin') on conflict (name) do nothing;

insert into public.matches(external_id,competition,match_date,match_time,home_team,away_team,venue,is_home) values('AW136027','U14HB B','2026-11-21','12:00:00','RU14H JS Dottignies','RU14H Royal Excelsior Brussels A','Hall De l''Europe',true) on conflict(external_id) do nothing;
insert into public.matches(external_id,competition,match_date,match_time,home_team,away_team,venue,is_home) values('AW136022','U14HB B','2026-12-12','10:00:00','RU14H Olympic Mont Sur Marchienne','RU14H JS Dottignies','HP Marcel Flandre',false) on conflict(external_id) do nothing;
insert into public.matches(external_id,competition,match_date,match_time,home_team,away_team,venue,is_home) values('AW136011','U14HB B','2026-12-19','15:00:00','RU14H BC Malonne','RU14H JS Dottignies','CS Malonne',false) on conflict(external_id) do nothing;
