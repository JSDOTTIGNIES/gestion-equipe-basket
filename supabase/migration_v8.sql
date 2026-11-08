-- V8 - Fonctions parents lors des matchs en déplacement
-- Appliquer après V6. Les désignations domicile et les autres données sont conservées.
BEGIN;

-- Le rôle « Feuille de match » devient possible dans la table actuelle.
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_role_check;
ALTER TABLE public.assignments ADD CONSTRAINT assignments_role_check
  CHECK (role IN ('Délégué de banc','Chrono','24/14 secondes','Feuille de match'));

-- Uniquement coach; tirage sur deux joueurs convoqués distincts.
-- La clé unique (match_id, player_id) garantit une famille par rôle.
CREATE OR REPLACE FUNCTION public.draw_away_assignments(p_match_id uuid)
RETURNS TABLE(role text, player_id uuid, player_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_home boolean;
  v_count integer;
  v_role text;
  v_player uuid;
BEGIN
  IF NOT public.is_coach() THEN RAISE EXCEPTION 'Accès coach requis'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(p_match_id::text));
  SELECT m.is_home INTO v_home FROM public.matches m WHERE m.id = p_match_id;
  IF v_home IS NULL THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF v_home THEN RAISE EXCEPTION 'Tirage réservé aux déplacements'; END IF;

  SELECT count(*) INTO v_count
    FROM public.selections s JOIN public.players p ON p.id=s.player_id
   WHERE s.match_id=p_match_id AND p.active;
  IF v_count < 2 THEN RAISE EXCEPTION 'Sélectionnez au moins deux joueurs actifs'; END IF;

  DELETE FROM public.assignments a WHERE a.match_id=p_match_id;
  FOREACH v_role IN ARRAY ARRAY['Feuille de match','Délégué de banc'] LOOP
    SELECT s.player_id INTO v_player
    FROM public.selections s
    JOIN public.players p ON p.id=s.player_id
    WHERE s.match_id=p_match_id AND p.active
      AND NOT EXISTS (
        SELECT 1 FROM public.assignments a
        WHERE a.match_id=p_match_id AND a.player_id=s.player_id
      )
    ORDER BY
      (SELECT count(*) FROM public.assignments a WHERE a.player_id=s.player_id AND a.role=v_role),
      (SELECT count(*) FROM public.assignments a WHERE a.player_id=s.player_id),
      random()
    LIMIT 1;
    IF v_player IS NULL THEN RAISE EXCEPTION 'Deux familles distinctes sont nécessaires'; END IF;
    INSERT INTO public.assignments(match_id,role,player_id)
    VALUES (p_match_id,v_role,v_player);
  END LOOP;

  RETURN QUERY
    SELECT a.role,a.player_id,p.name
      FROM public.assignments a JOIN public.players p ON p.id=a.player_id
     WHERE a.match_id=p_match_id
     ORDER BY CASE a.role WHEN 'Feuille de match' THEN 1 ELSE 2 END;
END; $$;

REVOKE ALL ON FUNCTION public.draw_away_assignments(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draw_away_assignments(uuid) TO authenticated;
COMMIT;
