-- Coiff'Match : avis d'exemple, pour la démo uniquement.
-- À lancer APRÈS schema.sql si tu veux que les profils d'exemple affichent des avis.
-- Chaque avis est signalé « (avis d'exemple) » sur le site : ce ne sont pas de vraies clientes.
-- Avant d'ouvrir le site au public, supprime-les :  delete from public.reviews where is_example;

insert into public.reviews (pro_id, is_example, client_name, hair, rating, body, created_at) values
  ('00000000-0000-4000-a000-000000000002', true, 'Exemple', 'boucles', 5, 'Diagnostic précis et coupe qui respecte mes boucles. (avis d''exemple)', now() - interval '12 days'),
  ('00000000-0000-4000-a000-000000000002', true, 'Exemple', 'ondules', 5, 'On m''a expliqué la routine à refaire chez moi, très clair. (avis d''exemple)', now() - interval '25 days'),
  ('00000000-0000-4000-a000-000000000002', true, 'Exemple', 'frises', 4, 'Très bon résultat, un peu d''attente à l''accueil. (avis d''exemple)', now() - interval '40 days'),
  ('00000000-0000-4000-a000-000000000001', true, 'Exemple', 'frises', 5, 'Coupe à sec, boucle par boucle : enfin quelqu''un qui sait faire. (avis d''exemple)', now() - interval '8 days'),
  ('00000000-0000-4000-a000-000000000001', true, 'Exemple', 'boucles', 4, 'Ponctuelle et de bons conseils produits. (avis d''exemple)', now() - interval '30 days'),
  ('00000000-0000-4000-a000-000000000004', true, 'Exemple', 'crepus', 5, 'Tresses nettes et qui tiennent, sans tirer. (avis d''exemple)', now() - interval '15 days'),
  ('00000000-0000-4000-a000-000000000004', true, 'Exemple', 'crepus', 5, 'Très douce avec ma fille, je recommande. (avis d''exemple)', now() - interval '50 days'),
  ('00000000-0000-4000-a000-000000000003', true, 'Exemple', 'raides', 4, 'Dégradé propre, rapide et efficace. (avis d''exemple)', now() - interval '20 days');
