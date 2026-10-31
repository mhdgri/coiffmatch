// Coiff'Match : envoie les e-mails de la table « email_outbox » avec Resend (https://resend.com).
// Déclenché par un « Database Webhook » Supabase à chaque nouvel e-mail (voir le README).
// Secrets à créer dans Supabase → Edge Functions → Secrets : RESEND_API_KEY et MAIL_FROM (ex. « Coiff'Match <bonjour@votre-domaine.fr> »).
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  const payload = await req.json().catch(() => ({}));
  const ids = payload?.record?.id ? [payload.record.id] : [];
  let q = db.from('email_outbox').select('*').is('sent_at', null).limit(20);
  if (ids.length) q = q.in('id', ids);
  const { data: mails } = await q;
  let sent = 0;
  for (const m of mails ?? []) {
    if (!m.to_email) continue;
    const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;color:#10201D">
      <p style="font-family:Georgia,serif;font-size:22px;color:#0B2A27">Coiff'Match</p>
      <h1 style="font-size:20px">${m.subject}</h1><p style="font-size:16px;line-height:1.5">${m.body}</p>
      <p style="font-size:13px;color:#55635F">Cet e-mail vous est envoyé par Coiff'Match à la suite d'une action sur votre compte.</p></div>`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: Deno.env.get('MAIL_FROM') ?? "Coiff'Match <onboarding@resend.dev>", to: m.to_email, subject: m.subject, html, text: m.body }),
    });
    if (r.ok) {
      await db.from('email_outbox').update({ sent_at: new Date().toISOString() }).eq('id', m.id);
      sent++;
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
