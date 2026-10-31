-- Coiff'Match : profils et avis d'exemple, pour la démo.
-- À lancer APRÈS schema.sql. Tout est signalé « (exemple) » / « (avis d'exemple) » sur le site.
-- Avant d'ouvrir au public :  delete from public.pros where is_example;  (supprime aussi leurs avis)

delete from public.pros where is_example;

insert into public.pros (name, status, mode, place, address, zones, travel, bio, hair, tags, skills, diploma, verified, presta, staff, week, geo, is_example, created_at)
  values
  ('Nadia K. (exemple)', 'publish', 'domicile', 'Paris 18e', '', '{"Paris 17e","Paris 18e","Paris 19e","Saint-Ouen"}', 10,
   'Spécialiste des cheveux bouclés et frisés depuis 8 ans. Je coupe à sec, boucle par boucle, pour respecter votre texture.',
   '{boucles,frises,crepus}', '{"Coupe à sec","Soins sans sulfates"}', '{coupe-sec,transition,soins}', 'CAP', true,
   '[{"k":"p1","label":"Coupe sur boucles","service":"coupe","dur":60,"price":45},{"k":"p2","label":"Coupe + soin hydratant","service":"coupe-soin","dur":90,"price":65},{"k":"p3","label":"Vanilles / twists","service":"tresses","dur":150,"price":80,"plus":{"mi-long":15,"long":30}}]',
   '[]', null, '{48.8925,2.3444}', true, now() - interval '40 days'),
  ('Salon Les Boucles (exemple)', 'publish', 'salon', 'Paris 11e', '12 rue Oberkampf, 75011 Paris', '{}', 0,
   'Salon dédié aux cheveux texturés : diagnostic, coupe adaptée et routine personnalisée à refaire chez vous.',
   '{ondules,boucles,frises}', '{"Méthode curly","Diagnostic offert"}', '{coupe-sec,couleur,enfants}', 'BP', true,
   '[{"k":"p1","label":"Coupe curly","service":"coupe","dur":75,"price":55,"plus":{"long":10}},{"k":"p2","label":"Coupe + soin profond","service":"coupe-soin","dur":105,"price":78},{"k":"p3","label":"Balayage sur boucles","service":"couleur","dur":180,"price":140,"plus":{"mi-long":20,"long":40}}]',
   '[{"k":"s1","name":"Inès","presta":[],"days":[1,2,3,4,5,6]},{"k":"s2","name":"Maëlle","presta":["p1","p2"],"days":[3,4,5,6]}]',
   null, '{48.8650,2.3790}', true, now() - interval '39 days'),
  ('Karim B. (exemple)', 'publish', 'salon', 'Saint-Denis', '5 rue de la République, 93200 Saint-Denis', '{}', 0,
   'Barbier-coiffeur, dégradés précis et coupes homme et femme.',
   '{raides,ondules,crepus}', '{"Dégradés","Barbe"}', '{crepus}', 'CAP', true,
   '[{"k":"p1","label":"Coupe dégradé","service":"coupe","dur":45,"price":25},{"k":"p2","label":"Coupe + soin du cuir chevelu","service":"coupe-soin","dur":60,"price":38},{"k":"p3","label":"Taille de barbe","service":"autre","dur":30,"price":15}]',
   '[]', null, '{48.9362,2.3574}', true, now() - interval '38 days'),
  ('Awa D. (exemple)', 'publish', 'domicile', 'Montreuil', '', '{"Montreuil","Bagnolet","Vincennes","Paris 20e"}', 10,
   'Tresses et coiffures protectrices à domicile, mèches fournies sur demande.',
   '{frises,crepus}', '{"Box braids","Nattes collées"}', '{crepus,tresses,twists,locks}', 'CAP', false,
   '[{"k":"p1","label":"Box braids mi-longues","service":"tresses","dur":240,"price":120,"plus":{"long":30}},{"k":"p2","label":"Nattes collées","service":"tresses","dur":120,"price":60,"plus":{"long":15}},{"k":"p3","label":"Coupe pointes + soin","service":"coupe-soin","dur":60,"price":40}]',
   '[]', null, '{48.8611,2.4430}', true, now() - interval '37 days');

update public.pros set slug = public.cm_slugify(regexp_replace(name, ' \(exemple\)$', '') || ' ' || place) || '-' || id where is_example;

insert into public.pro_private (pro_id) select id from public.pros where is_example on conflict do nothing;

insert into public.reviews (pro_id, is_example, rating, body, first_name, hair, created)
select p.id, true, r.rating, r.body || ' (avis d''exemple)', 'Exemple', r.hair, now() - make_interval(days => r.days)
from (values
  ('Salon Les Boucles (exemple)', 5, 'Diagnostic précis et coupe qui respecte mes boucles.', 'boucles', 12),
  ('Salon Les Boucles (exemple)', 5, 'On m''a expliqué la routine à refaire chez moi, très clair.', 'ondules', 25),
  ('Salon Les Boucles (exemple)', 4, 'Très bon résultat, un peu d''attente à l''accueil.', 'frises', 40),
  ('Nadia K. (exemple)', 5, 'Coupe à sec, boucle par boucle : enfin quelqu''un qui sait faire.', 'frises', 8),
  ('Nadia K. (exemple)', 5, 'Ponctuelle et de bons conseils produits.', 'boucles', 30),
  ('Awa D. (exemple)', 5, 'Tresses nettes et qui tiennent, sans tirer.', 'crepus', 15),
  ('Awa D. (exemple)', 4, 'Très douce avec ma fille, je recommande.', 'crepus', 50),
  ('Karim B. (exemple)', 5, 'Dégradé propre, rapide et efficace.', 'raides', 20)
) as r(name, rating, body, hair, days)
join public.pros p on p.name = r.name and p.is_example;
