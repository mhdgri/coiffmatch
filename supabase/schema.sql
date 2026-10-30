-- Coiff'Match : base de données Supabase
-- À coller en une fois dans Supabase → SQL Editor → New query → Run.
-- Le script peut être relancé sans risque : il ne supprime aucune donnée.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────

-- Un profil par compte (cliente ou coiffeur), créé automatiquement à l'inscription.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '',
  role       text not null default 'client' check (role in ('client', 'pro')),
  phone      text not null default '',
  hair       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Les coiffeurs et salons.
create table if not exists public.pros (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid unique references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 2 and 80),
  mode       text not null default 'salon' check (mode in ('salon', 'domicile')),
  city       text not null default '',
  address    text not null default '',
  zones      text not null default '',
  travel     int  not null default 0 check (travel between 0 and 100),
  hair       text[] not null default '{}',
  skills     text[] not null default '{}',
  tags       text[] not null default '{}',
  diploma    text not null default '',
  verified   boolean not null default false,
  bio        text not null default '' check (char_length(bio) <= 1200),
  lat        double precision,
  lng        double precision,
  hours      jsonb not null default '{"0":[],"1":["9:00","10:30","14:00","15:30","17:00"],"2":["9:00","10:30","14:00","15:30","17:00"],"3":["9:00","10:30","14:00","15:30","17:00"],"4":["9:00","10:30","14:00","15:30","17:00"],"5":["9:00","10:30","14:00","15:30","17:00"],"6":["9:00","10:30","14:00"]}'::jsonb,
  closed     date[] not null default '{}',
  staff      jsonb not null default '[]'::jsonb,
  photos     text[] not null default '{}',
  published  boolean not null default true,
  is_example boolean not null default false,
  created_at timestamptz not null default now()
);

-- Les prestations d'un coiffeur. « plus » = supplément selon la longueur, ex. {"mi-long":15,"long":30}.
create table if not exists public.services (
  id       uuid primary key default gen_random_uuid(),
  pro_id   uuid not null references public.pros (id) on delete cascade,
  label    text not null check (char_length(label) between 2 and 80),
  service  text not null default 'coupe' check (service in ('coupe', 'coupe-soin', 'tresses', 'couleur', 'autre')),
  duration int  not null default 60 check (duration between 15 and 600),
  price    int  not null default 0 check (price between 0 and 2000),
  plus     jsonb not null default '{}'::jsonb,
  position int  not null default 0
);
create index if not exists services_pro_idx on public.services (pro_id);

-- Les rendez-vous. Ils ne s'écrivent que par les fonctions plus bas (book, cancel_booking…).
create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  pro_id       uuid not null references public.pros (id) on delete cascade,
  service_id   uuid references public.services (id) on delete set null,
  client_id    uuid not null references auth.users (id) on delete cascade,
  client_name  text not null default '',
  client_phone text not null default '',
  address      text not null default '',
  hair         jsonb not null default '{}'::jsonb,
  label        text not null default '',
  day          date not null,
  hour         text not null,
  dur          int  not null,
  staff        text not null default '',
  staff_name   text not null default '',
  length       text not null default '',
  price        int  not null default 0,
  notes        text not null default '' check (char_length(notes) <= 500),
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'refused', 'cancelled')),
  created_at   timestamptz not null default now()
);
create index if not exists bookings_pro_day_idx on public.bookings (pro_id, day);
create index if not exists bookings_client_idx on public.bookings (client_id);
-- Filet de sécurité : jamais deux rendez-vous actifs au même créneau avec la même personne.
create unique index if not exists bookings_slot_uniq on public.bookings (pro_id, day, hour, staff) where status in ('pending', 'confirmed');

-- Les avis, un par rendez-vous passé.
-- is_example : avis d'exemple pour la démo (sans cliente ni rendez-vous), toujours signalés comme tels.
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid unique references public.bookings (id) on delete cascade,
  pro_id      uuid not null references public.pros (id) on delete cascade,
  client_id   uuid references auth.users (id) on delete cascade,
  is_example  boolean not null default false,
  client_name text not null default '',
  hair        text not null default '',
  rating      int  not null check (rating between 1 and 5),
  body        text not null default '' check (char_length(body) <= 800),
  created_at  timestamptz not null default now(),
  check (is_example or (booking_id is not null and client_id is not null))
);
create index if not exists reviews_pro_idx on public.reviews (pro_id);

-- Note moyenne et nombre d'avis par coiffeur.
create or replace view public.pro_ratings with (security_invoker = on) as
  select pro_id, round(avg(rating)::numeric, 1) as rating, count(*)::int as count
  from public.reviews group by pro_id;

-- ─────────────────────────────────────────────
-- Création du profil à l'inscription
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'name', ''), 60),
    case when new.raw_user_meta_data ->> 'role' = 'pro' then 'pro' else 'client' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- Sécurité : qui peut lire et écrire quoi
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.pros     enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews  enable row level security;

-- Profils : chacun ne voit et ne modifie que le sien (et jamais son rôle).
drop policy if exists "profil lu par son propriétaire" on public.profiles;
create policy "profil lu par son propriétaire" on public.profiles for select using (id = auth.uid());
drop policy if exists "profil modifié par son propriétaire" on public.profiles;
create policy "profil modifié par son propriétaire" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, phone, hair) on public.profiles to authenticated;

-- Coiffeurs : publics en lecture ; un compte coiffeur crée et modifie seulement sa propre fiche.
drop policy if exists "coiffeurs publiés visibles" on public.pros;
create policy "coiffeurs publiés visibles" on public.pros for select using (published or owner = auth.uid());
drop policy if exists "coiffeur crée sa fiche" on public.pros;
create policy "coiffeur crée sa fiche" on public.pros for insert with check (
  owner = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'pro')
);
drop policy if exists "coiffeur modifie sa fiche" on public.pros;
create policy "coiffeur modifie sa fiche" on public.pros for update using (owner = auth.uid()) with check (owner = auth.uid());
revoke insert, update, delete on public.pros from anon, authenticated;
grant select on public.pros to anon, authenticated;
-- « verified » (diplôme vérifié) et « is_example » restent réservés à l'administration.
grant insert (owner, name, mode, city, address, zones, travel, hair, skills, tags, diploma, bio, lat, lng, hours, closed, staff, photos, published)
  on public.pros to authenticated;
grant update (name, mode, city, address, zones, travel, hair, skills, tags, diploma, bio, lat, lng, hours, closed, staff, photos, published)
  on public.pros to authenticated;

-- Prestations : publiques en lecture, modifiables par le coiffeur concerné.
drop policy if exists "prestations visibles" on public.services;
create policy "prestations visibles" on public.services for select using (true);
drop policy if exists "prestations du coiffeur" on public.services;
create policy "prestations du coiffeur" on public.services for all
  using (exists (select 1 from public.pros p where p.id = pro_id and p.owner = auth.uid()))
  with check (exists (select 1 from public.pros p where p.id = pro_id and p.owner = auth.uid()));
revoke insert, update, delete on public.services from anon;
grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;

-- Rendez-vous : la cliente voit les siens, le coiffeur ceux de sa fiche. Écriture par fonctions seulement.
drop policy if exists "rendez-vous visibles par les intéressés" on public.bookings;
create policy "rendez-vous visibles par les intéressés" on public.bookings for select using (
  client_id = auth.uid() or exists (select 1 from public.pros p where p.id = pro_id and p.owner = auth.uid())
);
revoke insert, update, delete on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;

-- Avis : publics en lecture. Écriture par la fonction leave_review seulement.
drop policy if exists "avis visibles" on public.reviews;
create policy "avis visibles" on public.reviews for select using (true);
revoke insert, update, delete on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant select on public.pro_ratings to anon, authenticated;

-- ─────────────────────────────────────────────
-- Fonctions appelées par le site
-- ─────────────────────────────────────────────

-- Créneaux occupés (sans aucune information sur les clientes).
create or replace function public.busy_slots(p_pro uuid default null)
returns table (pro_id uuid, day date, hour text, dur int, staff text)
language sql stable security definer set search_path = public as $$
  select b.pro_id, b.day, b.hour, b.dur, b.staff from public.bookings b
  where b.status in ('pending', 'confirmed') and b.day >= (now() at time zone 'Europe/Paris')::date
    and (p_pro is null or b.pro_id = p_pro);
$$;

-- Réserver un créneau. Renvoie l'identifiant du rendez-vous.
create or replace function public.book(
  p_service uuid, p_day date, p_hour text, p_staff text default '', p_length text default '',
  p_phone text default '', p_address text default '', p_notes text default ''
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_prof   public.profiles;
  v_srv    public.services;
  v_pro    public.pros;
  v_dow    text := extract(dow from p_day)::int::text;
  v_start  timestamp;
  v_now    timestamp := now() at time zone 'Europe/Paris';
  v_price  int;
  v_staff  text := coalesce(p_staff, '');
  v_sname  text := '';
  v_member jsonb;
  v_id     uuid;
  v_cands  text[];
  c        text;
begin
  if v_uid is null then raise exception 'Connectez-vous pour réserver.'; end if;
  select * into v_prof from public.profiles where id = v_uid;
  if v_prof.role = 'pro' then raise exception 'Un compte coiffeur ne peut pas réserver. Créez un compte cliente.'; end if;
  select * into v_srv from public.services where id = p_service;
  if not found then raise exception 'Cette prestation n''existe plus.'; end if;
  select * into v_pro from public.pros where id = v_srv.pro_id and published;
  if not found then raise exception 'Ce coiffeur n''est plus disponible.'; end if;
  if p_hour !~ '^\d{1,2}:\d{2}$' then raise exception 'Heure invalide.'; end if;

  v_start := p_day + p_hour::time;
  if v_start <= v_now then raise exception 'Ce créneau est déjà passé.'; end if;
  if p_day > v_now::date + 60 then raise exception 'Les réservations sont ouvertes sur 60 jours.'; end if;
  if p_day = any (v_pro.closed) then raise exception 'Le coiffeur est fermé ce jour-là.'; end if;
  if not coalesce(v_pro.hours -> v_dow, '[]'::jsonb) ? p_hour then raise exception 'Ce créneau n''est pas proposé.'; end if;

  -- Prix selon la longueur
  v_price := v_srv.price;
  if v_srv.plus <> '{}'::jsonb then
    if p_length not in ('court', 'mi-long', 'long') then raise exception 'Indiquez la longueur de vos cheveux.'; end if;
    v_price := v_price + coalesce((v_srv.plus ->> p_length)::int, 0);
  elsif p_length not in ('', 'court', 'mi-long', 'long') then
    raise exception 'Longueur invalide.';
  end if;

  if v_pro.mode = 'domicile' and char_length(trim(p_address)) < 5 then raise exception 'Indiquez l''adresse du rendez-vous.'; end if;

  -- Un seul rendez-vous à la fois par coiffeur pendant la vérification
  perform pg_advisory_xact_lock(hashtext(v_pro.id::text));

  -- Choix du coiffeur dans l'équipe
  if jsonb_array_length(v_pro.staff) > 0 then
    select array_agg(m ->> 'k') into v_cands from jsonb_array_elements(v_pro.staff) m
      where (m -> 'days') ? v_dow
        and (coalesce(jsonb_array_length(m -> 'services'), 0) = 0 or (m -> 'services') ? v_srv.id::text)
        and (v_staff = '' or m ->> 'k' = v_staff);
    if v_cands is null then raise exception 'Cette personne ne travaille pas ce jour-là ou ne fait pas cette prestation.'; end if;
    v_staff := null;
    foreach c in array v_cands loop
      if not exists (
        select 1 from public.bookings b where b.pro_id = v_pro.id and b.day = p_day and b.staff = c
          and b.status in ('pending', 'confirmed')
          and (p_day + b.hour::time) < v_start + make_interval(mins => v_srv.duration)
          and v_start < (p_day + b.hour::time) + make_interval(mins => b.dur)
      ) then v_staff := c; exit; end if;
    end loop;
    if v_staff is null then raise exception 'Ce créneau vient d''être pris. Choisissez-en un autre.'; end if;
    select m into v_member from jsonb_array_elements(v_pro.staff) m where m ->> 'k' = v_staff;
    v_sname := coalesce(v_member ->> 'name', '');
  else
    v_staff := '';
    if exists (
      select 1 from public.bookings b where b.pro_id = v_pro.id and b.day = p_day
        and b.status in ('pending', 'confirmed')
        and (p_day + b.hour::time) < v_start + make_interval(mins => v_srv.duration)
        and v_start < (p_day + b.hour::time) + make_interval(mins => b.dur)
    ) then raise exception 'Ce créneau vient d''être pris. Choisissez-en un autre.'; end if;
  end if;

  insert into public.bookings (pro_id, service_id, client_id, client_name, client_phone, address, hair, label,
                               day, hour, dur, staff, staff_name, length, price, notes, status)
  values (v_pro.id, v_srv.id, v_uid, coalesce(nullif(v_prof.name, ''), 'Cliente'), left(coalesce(p_phone, ''), 30),
          left(coalesce(p_address, ''), 200), coalesce(v_prof.hair, '{}'::jsonb), v_srv.label,
          p_day, p_hour, v_srv.duration, v_staff, v_sname, coalesce(p_length, ''), v_price, left(coalesce(p_notes, ''), 500),
          -- Les profils d'exemple n'ont personne pour confirmer : leurs rendez-vous sont confirmés tout de suite.
          case when v_pro.is_example then 'confirmed' else 'pending' end)
  returning id into v_id;

  if char_length(coalesce(p_phone, '')) > 0 then
    update public.profiles set phone = left(p_phone, 30) where id = v_uid;
  end if;
  return v_id;
end $$;

-- Annuler : la cliente jusqu'à 24 h avant, le coiffeur à tout moment.
create or replace function public.cancel_booking(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_b public.bookings; v_owner uuid;
begin
  select * into v_b from public.bookings where id = p_id for update;
  if not found then raise exception 'Rendez-vous introuvable.'; end if;
  select owner into v_owner from public.pros where id = v_b.pro_id;
  if v_b.status not in ('pending', 'confirmed') then raise exception 'Ce rendez-vous est déjà clos.'; end if;
  if auth.uid() = v_owner then
    null;
  elsif auth.uid() = v_b.client_id then
    if (v_b.day + v_b.hour::time) - interval '24 hours' < (now() at time zone 'Europe/Paris') then
      raise exception 'L''annulation en ligne est possible jusqu''à 24 h avant. Contactez le coiffeur.';
    end if;
  else
    raise exception 'Vous ne pouvez pas annuler ce rendez-vous.';
  end if;
  update public.bookings set status = 'cancelled' where id = p_id;
end $$;

-- Le coiffeur accepte ou refuse une demande.
create or replace function public.set_booking_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_b public.bookings;
begin
  select b.* into v_b from public.bookings b join public.pros p on p.id = b.pro_id
    where b.id = p_id and p.owner = auth.uid() for update of b;
  if not found then raise exception 'Rendez-vous introuvable.'; end if;
  if p_status not in ('confirmed', 'refused') then raise exception 'Statut invalide.'; end if;
  if v_b.status <> 'pending' then raise exception 'Cette demande a déjà reçu une réponse.'; end if;
  update public.bookings set status = p_status where id = p_id;
end $$;

-- Laisser un avis après un rendez-vous confirmé et passé.
create or replace function public.leave_review(p_booking uuid, p_rating int, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_b public.bookings; v_id uuid;
begin
  select * into v_b from public.bookings where id = p_booking and client_id = auth.uid();
  if not found then raise exception 'Rendez-vous introuvable.'; end if;
  if v_b.status <> 'confirmed' then raise exception 'Seul un rendez-vous confirmé peut recevoir un avis.'; end if;
  if (v_b.day + v_b.hour::time) > (now() at time zone 'Europe/Paris') then raise exception 'Vous pourrez donner votre avis après le rendez-vous.'; end if;
  if p_rating not between 1 and 5 then raise exception 'Choisissez une note de 1 à 5.'; end if;
  if exists (select 1 from public.reviews where booking_id = p_booking) then raise exception 'Vous avez déjà donné votre avis.'; end if;
  insert into public.reviews (booking_id, pro_id, client_id, client_name, hair, rating, body)
  values (p_booking, v_b.pro_id, v_b.client_id, split_part(v_b.client_name, ' ', 1), coalesce(v_b.hair ->> 'type', ''), p_rating, left(coalesce(p_body, ''), 800))
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.book(uuid, date, text, text, text, text, text, text) from public, anon;
revoke execute on function public.cancel_booking(uuid) from public, anon;
revoke execute on function public.set_booking_status(uuid, text) from public, anon;
revoke execute on function public.leave_review(uuid, int, text) from public, anon;
grant execute on function public.book(uuid, date, text, text, text, text, text, text) to authenticated;
grant execute on function public.cancel_booking(uuid) to authenticated;
grant execute on function public.set_booking_status(uuid, text) to authenticated;
grant execute on function public.leave_review(uuid, int, text) to authenticated;
grant execute on function public.busy_slots(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Photos des réalisations (stockage Supabase)
-- ─────────────────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
    execute 'drop policy if exists "photos : envoi dans son dossier" on storage.objects';
    execute 'create policy "photos : envoi dans son dossier" on storage.objects for insert to authenticated
             with check (bucket_id = ''photos'' and (storage.foldername(name))[1] = auth.uid()::text)';
    execute 'drop policy if exists "photos : suppression dans son dossier" on storage.objects';
    execute 'create policy "photos : suppression dans son dossier" on storage.objects for delete to authenticated
             using (bucket_id = ''photos'' and (storage.foldername(name))[1] = auth.uid()::text)';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- Profils d'exemple (pour tester ; supprimables : delete from pros where is_example;)
-- Ils n'ont aucun avis : les avis viennent seulement de vraies clientes.
-- ─────────────────────────────────────────────
insert into public.pros (id, name, mode, city, address, zones, travel, hair, skills, tags, diploma, verified, bio, lat, lng, hours, staff, is_example)
values
  ('00000000-0000-4000-a000-000000000001', 'Nadia K. (exemple)', 'domicile', 'Paris 18e', '', 'Paris 17e, Paris 18e, Paris 19e, Saint-Ouen', 10,
   '{boucles,frises,crepus}', '{coupe-sec,transition,soins}', '{"Coupe à sec","Soins sans sulfates"}', 'CAP', true,
   'Spécialiste des cheveux bouclés et frisés depuis 8 ans. Je coupe à sec, boucle par boucle, pour respecter votre texture.',
   48.8925, 2.3444,
   '{"0":[],"1":["9:00","10:30","14:00","15:30","17:00"],"2":["9:00","10:30","14:00","15:30","17:00"],"3":["9:00","10:30","14:00","15:30","17:00"],"4":["9:00","10:30","14:00","15:30","17:00"],"5":["9:00","10:30","14:00","15:30","17:00"],"6":["9:00","10:30","14:00"]}',
   '[]', true),
  ('00000000-0000-4000-a000-000000000002', 'Salon Les Boucles (exemple)', 'salon', 'Paris 11e', '12 rue Oberkampf, 75011 Paris', '', 0,
   '{ondules,boucles,frises}', '{coupe-sec,couleur,enfants}', '{"Méthode curly","Diagnostic offert"}', 'BP', true,
   'Salon dédié aux cheveux texturés : diagnostic, coupe adaptée et routine personnalisée à refaire chez vous.',
   48.8650, 2.3790,
   '{"0":[],"1":[],"2":["9:00","10:30","11:15","14:00","15:30","17:00"],"3":["9:00","10:30","11:15","14:00","15:30","17:00"],"4":["9:00","10:30","11:15","14:00","15:30","17:00"],"5":["9:00","10:30","11:15","14:00","15:30","17:00","18:30"],"6":["9:00","10:30","11:15","14:00","15:30"]}',
   '[{"k":"s1","name":"Inès","services":[],"days":["1","2","3","4","5","6"]},{"k":"s2","name":"Maëlle","services":["00000000-0000-4000-b000-000000000021","00000000-0000-4000-b000-000000000022"],"days":["3","4","5","6"]}]',
   true),
  ('00000000-0000-4000-a000-000000000003', 'Karim B. (exemple)', 'salon', 'Saint-Denis', '5 rue de la République, 93200 Saint-Denis', '', 0,
   '{raides,ondules,crepus}', '{crepus}', '{"Dégradés","Barbe"}', 'CAP', true,
   'Barbier-coiffeur, dégradés précis et coupes homme et femme.',
   48.9362, 2.3574,
   '{"0":[],"1":["10:30","11:15","14:00","15:30","16:15","17:00","18:30"],"2":["10:30","11:15","14:00","15:30","16:15","17:00","18:30"],"3":["10:30","11:15","14:00","15:30","16:15","17:00","18:30"],"4":["10:30","11:15","14:00","15:30","16:15","17:00","18:30"],"5":["10:30","11:15","14:00","15:30","16:15","17:00","18:30"],"6":["9:00","10:30","11:15","14:00","15:30"]}',
   '[]', true),
  ('00000000-0000-4000-a000-000000000004', 'Awa D. (exemple)', 'domicile', 'Montreuil', '', 'Montreuil, Bagnolet, Vincennes, Paris 20e', 10,
   '{frises,crepus}', '{crepus,tresses,twists,locks}', '{"Box braids","Nattes collées"}', 'CAP', false,
   'Tresses et coiffures protectrices à domicile, mèches fournies sur demande.',
   48.8611, 2.4430,
   '{"0":[],"1":["9:00","14:00"],"2":["9:00","14:00"],"3":["9:00","14:00"],"4":["9:00","14:00"],"5":["9:00","14:00"],"6":["9:00","14:00"]}',
   '[]', true)
on conflict (id) do nothing;

insert into public.services (id, pro_id, label, service, duration, price, plus, position) values
  ('00000000-0000-4000-b000-000000000011', '00000000-0000-4000-a000-000000000001', 'Coupe sur boucles', 'coupe', 60, 45, '{}', 1),
  ('00000000-0000-4000-b000-000000000012', '00000000-0000-4000-a000-000000000001', 'Coupe + soin hydratant', 'coupe-soin', 90, 65, '{}', 2),
  ('00000000-0000-4000-b000-000000000013', '00000000-0000-4000-a000-000000000001', 'Vanilles / twists', 'tresses', 150, 80, '{"mi-long":15,"long":30}', 3),
  ('00000000-0000-4000-b000-000000000021', '00000000-0000-4000-a000-000000000002', 'Coupe curly', 'coupe', 75, 55, '{"long":10}', 1),
  ('00000000-0000-4000-b000-000000000022', '00000000-0000-4000-a000-000000000002', 'Coupe + soin profond', 'coupe-soin', 105, 78, '{}', 2),
  ('00000000-0000-4000-b000-000000000023', '00000000-0000-4000-a000-000000000002', 'Balayage sur boucles', 'couleur', 180, 140, '{"mi-long":20,"long":40}', 3),
  ('00000000-0000-4000-b000-000000000031', '00000000-0000-4000-a000-000000000003', 'Coupe dégradé', 'coupe', 45, 25, '{}', 1),
  ('00000000-0000-4000-b000-000000000032', '00000000-0000-4000-a000-000000000003', 'Coupe + soin du cuir chevelu', 'coupe-soin', 60, 38, '{}', 2),
  ('00000000-0000-4000-b000-000000000033', '00000000-0000-4000-a000-000000000003', 'Taille de barbe', 'autre', 30, 15, '{}', 3),
  ('00000000-0000-4000-b000-000000000041', '00000000-0000-4000-a000-000000000004', 'Box braids mi-longues', 'tresses', 240, 120, '{"long":30}', 1),
  ('00000000-0000-4000-b000-000000000042', '00000000-0000-4000-a000-000000000004', 'Nattes collées', 'tresses', 120, 60, '{"long":15}', 2),
  ('00000000-0000-4000-b000-000000000043', '00000000-0000-4000-a000-000000000004', 'Coupe pointes + soin', 'coupe-soin', 60, 40, '{}', 3)
on conflict (id) do nothing;
