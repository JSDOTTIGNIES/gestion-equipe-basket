-- V11.1 : noms des joueurs ayant demandé une place pour un déplacement.
-- Lire UNIQUEMENT les noms : aucun nom de parent, e-mail, adresse ou téléphone.
-- Accessible au coach et aux parents d'un enfant convoqué à ce même match.
-- À exécuter UNE FOIS après V11. Les données existantes sont conservées.

CREATE OR REPLACE FUNCTION public.list_ride_requests()
RETURNS TABLE(match_id uuid, player_id uuid, player_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
 SELECT DISTINCT m.id AS match_id, p.id AS player_id, p.name AS player_name
 FROM public.matches m
 JOIN public.selections s ON s.match_id=m.id
 JOIN public.players p ON p.id=s.player_id
 JOIN public.guardians g ON g.player_id=p.id
 JOIN public.match_responses r ON r.guardian_id=g.id AND r.match_id=m.id
 JOIN public.child_attendance a ON a.match_id=m.id AND a.player_id=p.id
 WHERE m.is_home=false
   AND a.attendance='yes'
   AND r.travel='need_ride'
   AND r.attendance='yes'
   -- Ne pas signaler un besoin si l'autre responsable a déjà confirmé un trajet.
   AND NOT EXISTS (
      SELECT 1 FROM public.match_responses other_r
      JOIN public.guardians other_g ON other_g.id=other_r.guardian_id
      WHERE other_g.player_id=p.id AND other_r.match_id=m.id
        AND other_r.attendance='yes' AND other_r.travel IN ('direct','car')
   )
   AND auth.uid() IS NOT NULL
   AND (
      public.is_coach()
      OR EXISTS (
         SELECT 1 FROM public.selections own_selection
         JOIN public.parent_roles pr ON pr.player_id=own_selection.player_id
         WHERE own_selection.match_id=m.id AND pr.user_id=auth.uid()
      )
   )
 ORDER BY m.id, p.name;
$$;
REVOKE ALL ON FUNCTION public.list_ride_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_ride_requests() TO authenticated;
