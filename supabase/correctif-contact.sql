-- Correctif : e-mail à l'équipe pour chaque message de contact (SQL Editor → Run). Ne supprime aucune donnée.
create or replace function public.cm_contact(p_name text, p_email text, p_subject text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Indiquez votre nom.'; end if;
  if coalesce(p_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Indiquez une adresse e-mail valide.'; end if;
  if char_length(trim(coalesce(p_body, ''))) < 10 then raise exception 'Écrivez votre message (10 caractères minimum).'; end if;
  if (select count(*) from public.contact_messages where created > now() - interval '10 minutes' and (email = lower(p_email) or user_id = auth.uid())) >= 3 then
    raise exception 'Trop de messages en peu de temps. Réessayez dans quelques minutes.';
  end if;
  insert into public.contact_messages (user_id, name, email, subject, body)
  values (auth.uid(), left(trim(p_name), 80), lower(trim(p_email)), left(coalesce(p_subject, ''), 80), left(trim(p_body), 3000));
  -- Prévenir l'équipe par e-mail (envoyé si les e-mails sont branchés).
  perform public.cm_mail(id, 'contact', 'Nouveau message de contact : ' || left(trim(p_name), 80),
    'De : ' || left(trim(p_name), 80) || ' <' || lower(trim(p_email)) || '>' || chr(10) || chr(10) || left(trim(p_body), 3000) ||
    chr(10) || chr(10) || 'Répondez directement à cette adresse. Le message est aussi dans l''espace équipe, onglet Messages.')
  from public.profiles where role = 'admin';
end $$;
grant execute on function public.cm_contact(text, text, text, text) to anon, authenticated;
