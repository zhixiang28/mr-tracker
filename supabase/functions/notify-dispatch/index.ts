// Delivers one notification to one person over Telegram, web push and/or email (through the send-email function). Called only by the database (shared NOTIFY_SECRET).
// Secret you set in the dashboard: TELEGRAM_BOT_TOKEN. The shared key and the push (VAPID) private key live in Supabase Vault and are read with the service role.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: sec } = await db.rpc("notify_server_secrets");
  if (!sec || !sec.notify_secret || req.headers.get("x-notify-secret") !== sec.notify_secret) return json({ ok: false }, 401);

  let b: any; try { b = await req.json(); } catch { return json({ ok: false }, 400); }
  const personId = String(b.person_id || ""), event = String(b.event || "");
  const title = String(b.title || "MR Tracker").slice(0, 120), body = String(b.body || "").slice(0, 240), url = String(b.url || "");
  if (!personId) return json({ ok: false }, 400);

  const { data: pref } = await db.from("notify_prefs").select("telegram_chat_id, events, email_on").eq("person_id", personId).maybeSingle();
  if (!pref) return json({ ok: true, sent: 0 });
  if (pref.events && pref.events[event] === false) return json({ ok: true, sent: 0 });

  let sent = 0;
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (token && pref.telegram_chat_id) {
    const safeUrl = /^https:\/\//.test(url) ? url : "";
    const text = `<b>${esc(title)}</b>\n${esc(body)}`;
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: pref.telegram_chat_id, text, parse_mode: "HTML", disable_web_page_preview: true,
        ...(safeUrl ? { reply_markup: { inline_keyboard: [[{ text: "Open", url: safeUrl }]] } } : {}),
      }),
    }).catch(() => null);
    if (r && r.ok) sent++;
    else if (r && (r.status === 403 || r.status === 400)) await db.from("notify_prefs").update({ telegram_chat_id: null }).eq("person_id", personId); // blocked the bot
  }

  const { data: cfg } = await db.from("notify_config").select("value").eq("key", "vapid_public").maybeSingle();
  const pub = cfg?.value, priv = sec.vapid_private;
  if (pub && priv) {
    webpush.setVapidDetails("mailto:admin@spacelogic.com.sg", pub, priv);
    const { data: subs } = await db.from("push_subscriptions").select("endpoint,p256dh,auth").eq("person_id", personId).eq("active", true);
    const payload = JSON.stringify({ title, body, url, tag: event });
    await Promise.all((subs || []).map(async (s: any) => {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 }); sent++; }
      catch (e: any) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await db.from("push_subscriptions").update({ active: false }).eq("endpoint", s.endpoint); }
    }));
  }

  if (pref.email_on) {
    const { data: me } = await db.from("people").select("email").eq("id", personId).maybeSingle();
    if (me?.email) {
      const safeUrl = /^https:\/\//.test(url) ? url : "";
      const html = `<div style="font-family:Arial,sans-serif;max-width:480px"><h2 style="margin:0 0 8px">${esc(title)}</h2><p style="color:#444;margin:0 0 18px">${esc(body)}</p>` +
        (safeUrl ? `<p><a href="${safeUrl}" style="background:#2f6fed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open in MR Tracker</a></p>` : "") +
        `<p style="color:#888;font-size:12px;margin-top:24px">You get this because email notifications are on in Settings → Notifications.</p></div>`;
      const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ to: me.email, subject: title, html }),
      }).catch(() => null);
      if (r && r.ok) sent++;
    }
  }
  return json({ ok: true, sent });
});
