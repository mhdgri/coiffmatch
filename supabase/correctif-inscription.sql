-- Correctif : création de compte (à lancer une fois dans Supabase, SQL Editor → Run). Ne supprime aucune donnée.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ref uuid; v_code text;
begin
  select id into v_ref from public.profiles where ref_code = upper(coalesce(new.raw_user_meta_data ->> 'ref', ''));
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.profiles where ref_code = v_code);
  end loop;
  insert into public.profiles (id, email, first_name, role, ref_code, referred_by)
  values (new.id, coalesce(new.email, ''), left(trim(coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'name', '')), 40),
          case when new.raw_user_meta_data ->> 'role' in ('coiffeur', 'pro') then 'coiffeur' else 'client' end, v_code, v_ref)
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.cm_ical_reset() returns text
language plpgsql security definer set search_path = public as $$
declare v_pro bigint; v_t text := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
begin
  select id into v_pro from public.pros where owner = auth.uid() and not is_example order by id limit 1;
  if v_pro is null then raise exception 'Créez d''abord votre profil.'; end if;
  insert into public.pro_private (pro_id, ical_token) values (v_pro, v_t) on conflict (pro_id) do update set ical_token = v_t;
  return v_t;
end $$;

alter table public.pro_private alter column ical_token set default replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
revoke execute on function public.cm_ical_reset() from public, anon;
grant execute on function public.cm_ical_reset() to authenticated;
