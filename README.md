# Coiff'Match

Le coiffeur qui connaît vos cheveux. On choisit son type de cheveux (raides, ondulés, bouclés, frisés, crépus), on compare les coiffeurs qui le maîtrisent, puis on réserve.

Le site reprend à l'identique le site WordPress d'origine : mêmes pages, même design, mêmes fonctions.

- **React (Vite)** affiche les pages.
- **Supabase** garde les comptes et les données.
- **Vercel** met le site en ligne.

## Ce que fait le site

**Clientes**
- Recherche par type de cheveux, prestation, ville, savoir-faire, prix et « disponible demain ». Les résultats s'affichent en liste ou sur une carte.
- Favoris, et fiche cheveux en 6 questions.
- Réservation avec choix de la coiffeuse, prix selon la longueur et photos des cheveux.
- Liste d'attente si une journée est complète.
- « Mes rendez-vous » : annulation, ajout à l'agenda, avis avec photo.
- Messagerie avec le coiffeur, signalements, parrainage, rappels d'entretien, suppression du compte.

**Coiffeurs**
- Profil complet : prestations, suppléments selon la longueur, horaires, jours de fermeture, équipe, photos « avant / après ».
- Demandes à accepter ou refuser, agenda de la semaine, fichier clientes avec notes privées.
- Réponses aux avis, fréquentation du profil, agenda à synchroniser avec le téléphone, lien à partager.

**Équipe**
- Validation des profils et badge « Diplôme vérifié ».
- Signalements, rendez-vous, membres, statistiques et recherches sans résultat.

**Pages publiques**
- Accueil, une page par coiffeur, une page par type de cheveux et par ville.
- Guide des cheveux, contact, mentions légales, CGU, confidentialité.
- Application installable sur téléphone.

## Mettre en ligne

### 1. Supabase

1. Ouvrez **SQL Editor** puis **New query**. Collez tout `supabase/schema.sql`, puis cliquez sur **Run**.
   ⚠️ Ce script remplace les tables de la première version.
2. Faites de même avec `supabase/exemples.sql` : il ajoute 4 coiffeurs d'exemple et leurs avis, tous signalés comme exemples.
3. Ouvrez **Authentication** puis **Sign In / Providers** puis **Email**. Décochez **Confirm email**, puis cliquez sur **Save**.
4. Ouvrez **Authentication** puis **URL Configuration**. Dans **Site URL**, mettez l'adresse du site, par exemple `https://coiffmatch.vercel.app`. Dans **Redirect URLs**, ajoutez `https://coiffmatch.vercel.app/**`.
5. Pour devenir membre de l'équipe : créez votre compte sur le site, puis lancez cette commande dans le SQL Editor :
   ```sql
   update public.profiles set role = 'admin' where email = 'votre@email.fr';
   ```

### 2. Vercel

Ajoutez deux variables d'environnement :
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (la clé « publishable » ou « anon »)

Le site se redéploie tout seul à chaque envoi sur GitHub.

### 3. E-mails (facultatif)

Le site enregistre chaque e-mail à envoyer dans la table `email_outbox` : confirmation, rappel, nouveau message, créneau libéré… Pour qu'ils partent vraiment :

1. Créez un compte gratuit sur https://resend.com et une clé API.
2. Dans Supabase, ouvrez **Edge Functions**, créez une fonction `send-emails` et collez-y `supabase/functions/send-emails/index.ts`.
3. Dans **Edge Functions** puis **Secrets**, ajoutez :
   - `RESEND_API_KEY`
   - `MAIL_FROM` (par exemple `Coiff'Match <bonjour@votre-domaine.fr>`)
4. Ouvrez **Database** puis **Webhooks**, puis **Create a new hook**. Choisissez la table `email_outbox`, l'événement **Insert**, et le type **Supabase Edge Function** `send-emails`.
5. Prévenez le site que les e-mails partent, pour qu'il les annonce aux clientes :
   ```sql
   update public.settings set emails = true;
   ```

Tant que cette étape n'est pas faite, le site ne promet aucun e-mail : il renvoie vers « Mes rendez-vous » et l'espace coiffeur.

## Avant d'ouvrir au public

Supprimez les profils d'exemple :

```sql
delete from public.pros where is_example;
```

Complétez aussi l'éditeur du site (nom, adresse, e-mail, SIRET si vous en avez un) dans `src/static/legal.html` et `src/static/privacy.html`, aux endroits marqués « [à compléter] ».

## Lancer sur son ordinateur

Créez un fichier `.env` qui contient les deux variables ci-dessus, puis :

```bash
npm install
npm run dev
```
