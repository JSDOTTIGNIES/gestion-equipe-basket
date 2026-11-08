-- À exécuter sur une base Supabase déjà initialisée en V1.

-- Empêcher les doublons même en cas d'imports simultanés.
create unique index if not exists matches_unique_fixture
  on public.matches(match_date, lower(btrim(home_team)), lower(btrim(away_team)));
