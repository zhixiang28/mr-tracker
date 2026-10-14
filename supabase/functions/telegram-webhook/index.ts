// Receives messages sent to the Telegram bot. "/start CODE" links that chat to the account that generated CODE in Settings.
// Open this function's URL once with ?setup=1 to register the webhook with Telegram.
// Secret you set in the dashboard: TELEGRAM_BOT_TOKEN. The webhook secret lives in Supabase Vault.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const tg = (method: string, payload: unknown) => fetch(`https://api.telegram.org/bot${token}/${method}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
const say = (chat: number, text: string) => tg("sendMessage", { chat_id: chat, text, parse_mode: "HTML" });

Deno.serve(async (req) => {
  const { data: sec } = await db.rpc("notify_server_secrets");
  const hook = sec?.telegram_webhook_secret;
  if (!token || !hook) return new Response("Telegram is not configured yet (missing secrets).", { status: 500 });

  if (req.method === "GET") {
    if (new URL(req.url).searchParams.get("setup") !== "1") return new Response("ok");
    const r = await tg("setWebhook", { url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-webhook`, secret_token: hook, allowed_updates: ["message"] });
    return new Response(r ? await r.text() : "could not reach Telegram", { headers: { "content-type": "application/json" } });
  }
  if (req.headers.get("x-telegram-bot-api-secret-token") !== hook) return new Response("forbidden", { status: 403 });

  let u: any; try { u = await req.json(); } catch { return new Response("ok"); }
  const m = u?.message, chat = m?.chat?.id, text = String(m?.text || "").trim();
  if (!chat || m.chat.type !== "private") return new Response("ok");

  const cmd = text.split(/\s+/);
  if (/^\/start$/i.test(cmd[0]) && cmd[1]) {
    const code = cmd[1].toUpperCase().replace(/[^A-Z0-9]/g, "");
    const { data: row } = await db.from("notify_prefs").select("person_id, telegram_code_at").eq("telegram_code", code).maybeSingle();
    const fresh = row && row.telegram_code_at && Date.now() - new Date(row.telegram_code_at).getTime() < 15 * 60 * 1000;
    if (!row || !fresh) { await say(chat, "That link has expired. Go back to <b>Settings → Notifications</b> in MR Tracker and press <b>Connect Telegram</b> again."); return new Response("ok"); }
    await db.from("notify_prefs").update({ telegram_chat_id: chat, telegram_code: null, telegram_code_at: null }).eq("person_id", row.person_id);
    await say(chat, "✅ <b>Connected!</b>\nYou will get MR Tracker notifications here. Choose which ones in <b>Settings → Notifications</b>.\n\nSend /stop any time to turn this off.");
  } else if (/^\/stop$/i.test(cmd[0])) {
    await db.from("notify_prefs").update({ telegram_chat_id: null }).eq("telegram_chat_id", chat);
    await say(chat, "Notifications turned off. You can turn them on again in MR Tracker → Settings → Notifications.");
  } else {
    await say(chat, "Hi! I send MR Tracker notifications. To connect, open <b>Settings → Notifications</b> in MR Tracker and press <b>Connect Telegram</b>.");
  }
  return new Response("ok");
});
