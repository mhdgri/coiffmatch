# Coiff'Match

Le coiffeur qui connaît vos cheveux : on choisit son type de cheveux, on compare les coiffeurs qui le maîtrisent, et on réserve.

Le site est fait avec **React** (Vite). Les données sont dans **Supabase** et il est mis en ligne sur **Vercel**.

## Lancer le site sur ton ordinateur

```bash
npm install
npm run dev
```

Ouvre ensuite http://localhost:5173.

Sans fichier `.env`, le site tourne en **mode démo** : les comptes et les réservations restent dans ton navigateur. Pratique pour essayer sans rien configurer.

## Brancher Supabase

1. Sur https://supabase.com, crée un projet gratuit. Choisis la région Europe (Paris ou Francfort) et note bien le mot de passe de la base.
2. Va dans **SQL Editor → New query**, colle tout le contenu de `supabase/schema.sql`, puis clique sur **Run**.
3. *(Facultatif, pour la démo)* Dans une nouvelle requête, colle `supabase/exemples-avis.sql` et clique sur **Run**. Cela ajoute des avis d'exemple, signalés comme tels sur le site.
4. Va dans **Authentication → Sign In / Providers → Email** et désactive **Confirm email**. Sinon, chaque compte de test doit cliquer sur un lien reçu par e-mail.
5. Va dans **Project Settings → API**. Copie la **Project URL** et la clé **anon public**.
6. Copie `.env.example` en `.env` et colle-y ces deux valeurs.

## Mettre en ligne sur Vercel

1. Envoie le code sur GitHub.
2. Sur https://vercel.com, clique sur **Add New → Project** et choisis le dépôt. Vercel reconnaît Vite tout seul.
3. Dans **Environment Variables**, ajoute `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, avec les mêmes valeurs que dans `.env`.
4. Clique sur **Deploy**. Le site est en ligne sur une adresse du type `coiffmatch.vercel.app`.
5. Dans Supabase, va dans **Authentication → URL Configuration** et mets cette adresse dans **Site URL**.

## Ce que fait le site

- **Clientes** : recherche par type de cheveux, prestation, salon ou domicile, ville et savoir-faire. Elles voient le profil du coiffeur (prestations, prix selon la longueur, équipe, réalisations, avis) et peuvent faire leur fiche cheveux en 6 questions. Elles réservent en 5 étapes, annulent jusqu'à 24 h avant, et donnent leur avis après le rendez-vous.
- **Coiffeurs** : ils créent leur profil, avec horaires, jours de fermeture, équipe et photos, puis acceptent ou refusent les demandes et voient la fiche cheveux de la cliente.
- **Sécurité** (règles Supabase dans `schema.sql`) :
  - Une cliente ne voit que ses propres rendez-vous, un coiffeur que ceux de son salon.
  - Les réservations passent par une fonction qui vérifie le créneau, les horaires et les doubles réservations.
  - Seule une cliente qui a eu un rendez-vous peut laisser un avis, et seulement après ce rendez-vous.
  - Le badge « Diplôme vérifié » ne peut pas être ajouté par le coiffeur lui-même.

## Profils d'exemple

Le script crée 4 coiffeurs d'exemple, marqués « (exemple) ». Leurs réservations sont confirmées automatiquement, puisque personne ne gère ces comptes.

Avant une vraie ouverture au public, il faut les supprimer en lançant ces deux lignes dans le SQL Editor :

```sql
delete from public.reviews where is_example;
delete from public.pros where is_example;
```
