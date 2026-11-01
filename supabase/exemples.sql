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
  ('Leïla R. (exemple)', 'publish', 'salon', 'Paris 11e', '12 rue Oberkampf, 75011 Paris', '{}', 0,
   'Coiffeuse spécialisée dans les cheveux texturés : diagnostic, coupe adaptée et routine personnalisée à refaire chez vous. Je travaille avec Inès et Maëlle.',
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



insert into public.reviews (pro_id, is_example, rating, body, first_name, hair, created)
select p.id, true, r.rating, r.body || ' (avis d''exemple)', 'Exemple', r.hair, now() - make_interval(days => r.days)
from (values
  ('Leïla R. (exemple)', 5, 'Diagnostic précis et coupe qui respecte mes boucles.', 'boucles', 12),
  ('Leïla R. (exemple)', 5, 'On m''a expliqué la routine à refaire chez moi, très clair.', 'ondules', 25),
  ('Leïla R. (exemple)', 4, 'Très bon résultat, un peu d''attente à l''accueil.', 'frises', 40),
  ('Nadia K. (exemple)', 5, 'Coupe à sec, boucle par boucle : enfin quelqu''un qui sait faire.', 'frises', 8),
  ('Nadia K. (exemple)', 5, 'Ponctuelle et de bons conseils produits.', 'boucles', 30),
  ('Awa D. (exemple)', 5, 'Tresses nettes et qui tiennent, sans tirer.', 'crepus', 15),
  ('Awa D. (exemple)', 4, 'Très douce avec ma fille, je recommande.', 'crepus', 50),
  ('Karim B. (exemple)', 5, 'Dégradé propre, rapide et efficace.', 'raides', 20)
) as r(name, rating, body, hair, days)
join public.pros p on p.name = r.name and p.is_example;

-- Coiffeurs d'exemple supplémentaires (plusieurs villes)
insert into public.pros (name, status, mode, place, address, zones, travel, bio, hair, tags, skills, diploma, verified, presta, staff, week, geo, is_example, created_at)
values
  ('Inès M. (exemple)', 'publish', 'domicile', 'Versailles', '', '{"Versailles","Guyancourt","Le Chesnay","Viroflay"}', 8,
   'Coiffeuse à domicile depuis 6 ans, je prends soin des boucles et des cheveux frisés avec des produits naturels.',
   '{ondules,boucles,frises}', '{"Produits naturels","Coupe à sec"}', '{coupe-sec,soins,transition}', 'CAP', true,
   '[{"k": "p1", "label": "Coupe sur boucles", "service": "coupe", "dur": 60, "price": 45, "plus": {"mi-long": 10, "long": 20}}, {"k": "p2", "label": "Soin hydratant + définition", "service": "coupe-soin", "dur": 90, "price": 60}, {"k": "p3", "label": "Transition : coupe des pointes défrisées", "service": "coupe", "dur": 75, "price": 55}]',
   '[]', '[[], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["9:00", "13:00", "16:00"]]', '{48.8049,2.1204}', true, now() - interval '30 days'),
  ('Fatou S. (exemple)', 'publish', 'salon', 'Guyancourt', '12 avenue de l''Europe, 78280 Guyancourt', '{}', 0,
   'Coiffeuse afro et métissé : tresses, locks, coupes sur cheveux crépus et soins profonds, dans une ambiance détendue.',
   '{frises,crepus}', '{"Locks","Tresses sans tension"}', '{crepus,tresses,locks,twists}', 'BP', true,
   '[{"k": "p1", "label": "Départ de locks", "service": "tresses", "dur": 240, "price": 150}, {"k": "p2", "label": "Entretien de locks", "service": "tresses", "dur": 120, "price": 70, "plus": {"long": 20}}, {"k": "p3", "label": "Nattes collées", "service": "tresses", "dur": 90, "price": 45, "plus": {"long": 15}}, {"k": "p4", "label": "Coupe crépus", "service": "coupe", "dur": 45, "price": 30}]',
   '[{"k": "s1", "name": "Fatou", "presta": [], "days": [2, 3, 4, 5, 6]}, {"k": "s2", "name": "Yasmine", "presta": ["p3", "p4"], "days": [3, 4, 5, 6]}]', '[[], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30"]]', '{48.7734,2.0739}', true, now() - interval '29 days'),
  ('Camille V. (exemple)', 'publish', 'salon', 'Lyon 2e', '8 rue de la République, 69002 Lyon', '{}', 0,
   'Coiffeuse spécialisée cheveux bouclés et ondulés : coupe à sec, diagnostic et routine sur mesure.',
   '{ondules,boucles}', '{"Méthode curly","Diagnostic offert"}', '{coupe-sec,couleur,soins}', 'BP', true,
   '[{"k": "p1", "label": "Coupe curly", "service": "coupe", "dur": 75, "price": 58, "plus": {"long": 12}}, {"k": "p2", "label": "Coupe + soin profond", "service": "coupe-soin", "dur": 105, "price": 82}, {"k": "p3", "label": "Balayage sur boucles", "service": "couleur", "dur": 180, "price": 150, "plus": {"mi-long": 20, "long": 40}}]',
   '[{"k": "s1", "name": "Clara", "presta": [], "days": [2, 3, 4, 5, 6]}, {"k": "s2", "name": "Nour", "presta": ["p1", "p2"], "days": [1, 2, 3, 4, 5]}]', '[[], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"]]', '{45.7578,4.8351}', true, now() - interval '28 days'),
  ('Sarah L. (exemple)', 'publish', 'domicile', 'Lyon 7e', '', '{"Lyon 7e","Lyon 8e","Villeurbanne","Vénissieux"}', 10,
   'Tresses, twists et vanilles à domicile. Mèches fournies sur demande, travail soigné sans tirer sur les tempes.',
   '{frises,crepus}', '{"Box braids","Twists"}', '{tresses,twists,crepus}', 'CAP', false,
   '[{"k": "p1", "label": "Box braids mi-longues", "service": "tresses", "dur": 240, "price": 110, "plus": {"long": 30}}, {"k": "p2", "label": "Twists", "service": "tresses", "dur": 180, "price": 90, "plus": {"long": 20}}, {"k": "p3", "label": "Vanilles", "service": "tresses", "dur": 150, "price": 75}]',
   '[]', '[[], ["9:00", "13:00", "16:00"], ["9:00", "13:00", "16:00"], ["9:00", "13:00", "16:00"], ["9:00", "13:00", "16:00"], ["9:00", "13:00", "16:00"], ["9:00", "13:00", "16:00"]]', '{45.7451,4.8422}', true, now() - interval '27 days'),
  ('Yasmine H. (exemple)', 'publish', 'salon', 'Marseille 6e', '24 cours Julien, 13006 Marseille', '{}', 0,
   'Coiffure mixte pour tous les types de cheveux, avec une vraie expertise des textures frisées et crépues.',
   '{raides,ondules,boucles,frises,crepus}', '{"Tous types de cheveux","Barbier"}', '{crepus,coupe-sec,enfants}', 'BM', true,
   '[{"k": "p1", "label": "Coupe femme", "service": "coupe", "dur": 60, "price": 48, "plus": {"mi-long": 8, "long": 15}}, {"k": "p2", "label": "Coupe homme / dégradé", "service": "coupe", "dur": 40, "price": 25}, {"k": "p3", "label": "Coupe enfant", "service": "coupe", "dur": 30, "price": 18}, {"k": "p4", "label": "Coloration", "service": "couleur", "dur": 120, "price": 75, "plus": {"long": 25}}]',
   '[]', '[[], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"]]', '{43.2925,5.3845}', true, now() - interval '26 days'),
  ('Karima B. (exemple)', 'publish', 'domicile', 'Marseille 13e', '', '{"Marseille 13e","Marseille 14e","Allauch","Plan-de-Cuques"}', 12,
   'Spécialiste des cheveux crépus et de la transition vers le naturel. Je viens chez vous avec tout le matériel.',
   '{frises,crepus}', '{"Transition","Soins naturels"}', '{transition,crepus,soins}', 'CAP', true,
   '[{"k": "p1", "label": "Big chop + soin", "service": "coupe-soin", "dur": 90, "price": 55}, {"k": "p2", "label": "Soin profond hydratant", "service": "coupe-soin", "dur": 75, "price": 45}, {"k": "p3", "label": "Twist-out", "service": "tresses", "dur": 120, "price": 60, "plus": {"long": 15}}]',
   '[]', '[[], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"]]', '{43.3462,5.4314}', true, now() - interval '25 days'),
  ('Julie P. (exemple)', 'publish', 'salon', 'Lille', '15 rue de Béthune, 59000 Lille', '{}', 0,
   'Coiffeuse de quartier : coupes précises sur cheveux raides et ondulés, brushing et couleur.',
   '{raides,ondules}', '{"Brushing","Couleur"}', '{couleur,enfants}', 'BP', true,
   '[{"k": "p1", "label": "Coupe + brushing", "service": "coupe", "dur": 60, "price": 42, "plus": {"mi-long": 6, "long": 12}}, {"k": "p2", "label": "Couleur racines", "service": "couleur", "dur": 90, "price": 55}, {"k": "p3", "label": "Mèches", "service": "couleur", "dur": 150, "price": 95, "plus": {"long": 25}}]',
   '[]', '[[], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"]]', '{50.634,3.0632}', true, now() - interval '24 days'),
  ('Aminata D. (exemple)', 'publish', 'domicile', 'Roubaix', '', '{"Roubaix","Tourcoing","Lille","Croix"}', 8,
   'Tresses africaines, nattes collées et perruques, à domicile, pour adultes et enfants.',
   '{frises,crepus}', '{"Perruques","Enfants"}', '{tresses,perruques,enfants}', 'CAP', false,
   '[{"k": "p1", "label": "Nattes collées", "service": "tresses", "dur": 90, "price": 45, "plus": {"long": 15}}, {"k": "p2", "label": "Pose de perruque", "service": "autre", "dur": 60, "price": 50}, {"k": "p3", "label": "Tresses enfant", "service": "tresses", "dur": 90, "price": 35}]',
   '[]', '[[], ["9:00", "13:00", "16:00"], ["9:00", "13:00", "16:00"], ["9:00", "13:00", "16:00"], ["9:00", "13:00", "16:00"], ["9:00", "13:00", "16:00"], ["9:00", "13:00", "16:00"]]', '{50.6942,3.1746}', true, now() - interval '23 days'),
  ('Mariam T. (exemple)', 'publish', 'salon', 'Bordeaux', '5 cours Victor Hugo, 33000 Bordeaux', '{}', 0,
   'Coupe boucle par boucle et accompagnement des cheveux bouclés au naturel.',
   '{ondules,boucles,frises}', '{"Coupe à sec"}', '{coupe-sec,transition,soins}', 'BP', true,
   '[{"k": "p1", "label": "Coupe à sec", "service": "coupe", "dur": 75, "price": 60, "plus": {"long": 10}}, {"k": "p2", "label": "Coupe + routine", "service": "coupe-soin", "dur": 105, "price": 80}]',
   '[]', '[[], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"]]', '{44.8346,-0.5724}', true, now() - interval '22 days'),
  ('Grace N. (exemple)', 'publish', 'salon', 'Toulouse', '3 rue d''Alsace-Lorraine, 31000 Toulouse', '{}', 0,
   'Soins et coiffures protectrices pour cheveux texturés, dans mon salon.',
   '{boucles,frises,crepus}', '{"Coiffures protectrices"}', '{tresses,soins,crepus}', 'BP', false,
   '[{"k": "p1", "label": "Soin profond", "service": "coupe-soin", "dur": 60, "price": 45}, {"k": "p2", "label": "Twists", "service": "tresses", "dur": 180, "price": 85, "plus": {"long": 20}}, {"k": "p3", "label": "Coupe crépus", "service": "coupe", "dur": 45, "price": 32}]',
   '[]', '[[], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"]]', '{43.6047,1.4442}', true, now() - interval '21 days'),
  ('Léa F. (exemple)', 'publish', 'salon', 'Nantes', '10 rue Crébillon, 44000 Nantes', '{}', 0,
   'Coupes, couleurs et balayages, avec une attention particulière aux cheveux fins et raides.',
   '{raides,ondules}', '{"Balayage"}', '{couleur}', 'BP', true,
   '[{"k": "p1", "label": "Coupe + brushing", "service": "coupe", "dur": 60, "price": 40, "plus": {"long": 10}}, {"k": "p2", "label": "Balayage", "service": "couleur", "dur": 150, "price": 110, "plus": {"mi-long": 15, "long": 30}}]',
   '[]', '[[], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"], ["9:00", "10:30", "11:15", "14:00", "15:30", "16:15", "17:00", "18:30"]]', '{47.2138,-1.5596}', true, now() - interval '20 days'),
  ('Moussa K. (exemple)', 'publish', 'salon', 'Paris 10e', '32 rue du Faubourg Saint-Denis, 75010 Paris', '{}', 0,
   'Création et entretien de locks, de la racine aux pointes, avec des techniques douces pour le cuir chevelu.',
   '{frises,crepus}', '{"Locks","Crochet"}', '{locks,crepus,soins}', 'CAP', true,
   '[{"k": "p1", "label": "Départ de locks", "service": "tresses", "dur": 240, "price": 160}, {"k": "p2", "label": "Entretien de locks", "service": "tresses", "dur": 120, "price": 75, "plus": {"long": 25}}, {"k": "p3", "label": "Soin du cuir chevelu", "service": "coupe-soin", "dur": 45, "price": 35}]',
   '[]', '[[], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"], ["10:00", "11:30", "14:00", "15:30", "17:00"]]', '{48.8721,2.354}', true, now() - interval '19 days');

update public.pros set slug = public.cm_slugify(regexp_replace(name, ' \(exemple\)$', '') || ' ' || place) || '-' || id where is_example;
insert into public.pro_private (pro_id) select id from public.pros where is_example on conflict do nothing;

insert into public.reviews (pro_id, is_example, rating, body, first_name, hair, created)
select p.id, true, r.rating, r.body || ' (avis d''exemple)', 'Exemple', r.hair, now() - make_interval(days => r.days)
from (values
  ('Inès M. (exemple)', 5, 'Enfin une coiffeuse qui comprend mes boucles, et à la maison en plus.', 'boucles', 6),
  ('Inès M. (exemple)', 5, 'Très douce, de bons conseils pour ma routine.', 'ondules', 22),
  ('Fatou S. (exemple)', 5, 'Mes locks n''ont jamais été aussi belles, travail très propre.', 'crepus', 9),
  ('Fatou S. (exemple)', 4, 'Nattes nickel, un peu d''attente le samedi.', 'frises', 18),
  ('Fatou S. (exemple)', 5, 'Fatou est géniale avec ma fille.', 'crepus', 35),
  ('Camille V. (exemple)', 5, 'Diagnostic précis, coupe parfaite.', 'boucles', 4),
  ('Camille V. (exemple)', 5, 'Mes ondulations ressortent enfin !', 'ondules', 28),
  ('Sarah L. (exemple)', 4, 'Box braids régulières et qui tiennent.', 'crepus', 12),
  ('Yasmine H. (exemple)', 5, 'Ils savent tout faire, du dégradé aux boucles.', 'frises', 7),
  ('Yasmine H. (exemple)', 4, 'Bon accueil, coupe enfant réussie.', 'raides', 26),
  ('Karima B. (exemple)', 5, 'Elle m''a accompagnée pendant toute ma transition.', 'crepus', 15),
  ('Julie P. (exemple)', 5, 'Brushing impeccable et prix correct.', 'raides', 10),
  ('Aminata D. (exemple)', 5, 'Ponctuelle, nattes très propres.', 'crepus', 19),
  ('Mariam T. (exemple)', 5, 'La meilleure coupe à sec de Bordeaux.', 'boucles', 5),
  ('Mariam T. (exemple)', 4, 'Super résultat, un peu cher.', 'frises', 31),
  ('Grace N. (exemple)', 4, 'Soin agréable, mes cheveux sont doux.', 'boucles', 13),
  ('Léa F. (exemple)', 5, 'Balayage très naturel.', 'ondules', 8),
  ('Moussa K. (exemple)', 5, 'Entretien rapide et sans douleur.', 'crepus', 3),
  ('Moussa K. (exemple)', 5, 'Le spécialiste des locks à Paris.', 'frises', 24)
) as r(name, rating, body, hair, days)
join public.pros p on p.name = r.name and p.is_example;
