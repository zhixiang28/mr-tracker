-- Telegram + browser/phone (PWA) push notifications.  Run once in the Supabase SQL editor (already applied to the live project).
-- Delivery itself is done by the Edge Functions `notify-dispatch` and `telegram-webhook`.

-- ---------- tables (no direct access for the browser: everything goes through the RPCs below) ----------
create table if not exists public.notify_prefs (
  person_id        uuid primary key references public.people(id) on delete cascade,
  events           jsonb not null default '{"action":true,"progress":true,"declined":true,"reminder":true}'::jsonb,
  telegram_chat_id bigint,
  telegram_code    text,
  telegram_code_at timestamptz,
  prompted         boolean not null default false,
  updated_at       timestamptz not null default now()
);
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  person_id  uuid not null references public.people(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  label      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.notify_config (key text primary key, value text not null);   -- public settings: bot username, VAPID public key, site url
create table if not exists public.reminder_sent (step_id uuid primary key, sent_at timestamptz not null default now());
alter table public.notify_prefs        enable row level security;
alter table public.push_subscriptions  enable row level security;
alter table public.notify_config       enable row level security;
alter table public.reminder_sent       enable row level security;
revoke all on public.notify_prefs, public.push_subscriptions, public.notify_config, public.reminder_sent from anon, authenticated;

-- ---------- what the settings page reads / writes ----------
create or replace function public.get_my_notify_prefs(p_person_id uuid, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare r public.notify_prefs; devs json;
begin
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false, 'error', 'Incorrect PIN.'); end if;
  select * into r from notify_prefs where person_id = p_person_id;
  select coalesce(json_agg(json_build_object('endpoint', endpoint, 'label', label, 'added', created_at) order by created_at), '[]'::json)
    into devs from push_subscriptions where person_id = p_person_id and active;
  return json_build_object('success', true,
    'events', coalesce(r.events, '{"action":true,"progress":true,"declined":true,"reminder":true}'::jsonb),
    'telegram', r.telegram_chat_id is not null,
    'prompted', coalesce(r.prompted, false),
    'devices', devs,
    'bot', (select value from notify_config where key = 'telegram_bot'),
    'vapid', (select value from notify_config where key = 'vapid_public'));
end $$;

create or replace function public.save_my_notify_prefs(p_person_id uuid, p_pin text, p_events jsonb) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare clean jsonb := '{}'::jsonb; k text;
begin
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false, 'error', 'Incorrect PIN.'); end if;
  foreach k in array array['action','progress','declined','reminder'] loop
    clean := clean || jsonb_build_object(k, coalesce((p_events ->> k)::boolean, true));
  end loop;
  insert into notify_prefs(person_id, events, prompted) values (p_person_id, clean, true)
  on conflict (person_id) do update set events = excluded.events, prompted = true, updated_at = now();
  return json_build_object('success', true);
end $$;

create or replace function public.mark_notify_prompted(p_person_id uuid, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false); end if;
  insert into notify_prefs(person_id, prompted) values (p_person_id, true)
  on conflict (person_id) do update set prompted = true;
  return json_build_object('success', true);
end $$;

create or replace function public.new_telegram_link_code(p_person_id uuid, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare c text := upper(encode(gen_random_bytes(5), 'hex'));
begin
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false, 'error', 'Incorrect PIN.'); end if;
  insert into notify_prefs(person_id, telegram_code, telegram_code_at) values (p_person_id, c, now())
  on conflict (person_id) do update set telegram_code = c, telegram_code_at = now();
  return json_build_object('success', true, 'code', c, 'bot', (select value from notify_config where key = 'telegram_bot'));
end $$;

create or replace function public.disconnect_telegram(p_person_id uuid, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false, 'error', 'Incorrect PIN.'); end if;
  update notify_prefs set telegram_chat_id = null, telegram_code = null, telegram_code_at = null where person_id = p_person_id;
  return json_build_object('success', true);
end $$;

create or replace function public.save_push_subscription(p_person_id uuid, p_pin text, p_endpoint text, p_p256dh text, p_auth text, p_label text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false, 'error', 'Incorrect PIN.'); end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    return json_build_object('success', false, 'error', 'Invalid subscription.');
  end if;
  insert into push_subscriptions(endpoint, person_id, p256dh, auth, label, active)
  values (p_endpoint, p_person_id, p_p256dh, p_auth, left(coalesce(p_label, ''), 60), true)
  on conflict (endpoint) do update set person_id = excluded.person_id, p256dh = excluded.p256dh, auth = excluded.auth, label = excluded.label, active = true;
  insert into notify_prefs(person_id) values (p_person_id) on conflict (person_id) do nothing;
  return json_build_object('success', true);
end $$;

create or replace function public.remove_push_subscription(p_person_id uuid, p_pin text, p_endpoint text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false, 'error', 'Incorrect PIN.'); end if;
  update push_subscriptions set active = false where endpoint = p_endpoint and person_id = p_person_id;
  return json_build_object('success', true);
end $$;

grant execute on function public.get_my_notify_prefs(uuid, text), public.save_my_notify_prefs(uuid, text, jsonb), public.mark_notify_prompted(uuid, text),
  public.new_telegram_link_code(uuid, text), public.disconnect_telegram(uuid, text),
  public.save_push_subscription(uuid, text, text, text, text, text), public.remove_push_subscription(uuid, text, text) to anon, authenticated;

-- ---------- sending: a trigger posts to the Edge Function (shared secret kept in Vault, never in this file) ----------
-- Before running, create the secret once:   select vault.create_secret('<random text>', 'notify_secret');
-- and give the SAME text to the Edge Functions as the NOTIFY_SECRET secret.
create or replace function public.notify_person(p_person uuid, p_event text, p_title text, p_body text, p_path text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare pr public.notify_prefs; sec text; base text; has_push boolean;
begin
  if p_person is null then return; end if;
  select * into pr from notify_prefs where person_id = p_person;
  if pr.person_id is null then return; end if;
  if coalesce((pr.events ->> p_event)::boolean, true) is not true then return; end if;
  select exists(select 1 from push_subscriptions where person_id = p_person and active) into has_push;
  if pr.telegram_chat_id is null and not has_push then return; end if;
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'notify_secret';
  select value into base from notify_config where key = 'site_url';
  if sec is null then return; end if;
  perform net.http_post(
    url := 'https://ogxuwchojexznsxvvdhi.supabase.co/functions/v1/notify-dispatch',
    headers := jsonb_build_object('content-type', 'application/json', 'x-notify-secret', sec),
    body := jsonb_build_object('person_id', p_person, 'event', p_event, 'title', p_title, 'body', p_body, 'url', coalesce(base, '') || p_path));
exception when others then null;     -- a notification problem must never block signing
end $$;
revoke all on function public.notify_person(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public.trg_notify_steps() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare rq record; nxt record; who text;
begin
  select tracking_no, project_name, requester_person_id into rq from requisitions where id = new.requisition_id;
  if rq.tracking_no is null then return new; end if;

  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.status = 'Pending' and old.status <> 'Pending') then
    -- a new or re-opened request: the first approver is up
    if new.step_order = 1 and new.status = 'Pending' then
      perform notify_person(new.assigned_person_id, 'action', rq.tracking_no || ' needs your sign-off',
        coalesce(rq.project_name, '') || ' · ' || new.stage_name, 'esign.html?token=' || new.token);
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status = 'Signed' and old.status <> 'Signed' then
    who := coalesce(new.assigned_person_name, 'Someone');
    if new.assigned_person_id is distinct from rq.requester_person_id then
      perform notify_person(rq.requester_person_id, 'progress', rq.tracking_no || ': ' || new.stage_name || ' signed',
        coalesce(rq.project_name, '') || ' · by ' || who, 'dashboard.html');
    end if;
    select * into nxt from approval_steps where requisition_id = new.requisition_id and step_order = new.step_order + 1;
    if nxt.id is not null and nxt.status = 'Pending' then
      perform notify_person(nxt.assigned_person_id, 'action', rq.tracking_no || ' needs your ' || lower(nxt.stage_name),
        coalesce(rq.project_name, '') || ' · ready for you', 'esign.html?token=' || nxt.token);
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status = 'Declined' and old.status <> 'Declined' then
    perform notify_person(rq.requester_person_id, 'declined', rq.tracking_no || ' was declined',
      coalesce(rq.project_name, '') || ' · ' || coalesce(nullif(new.decline_reason, ''), 'no reason given'), 'dashboard.html');
    return new;
  end if;

  -- an admin handed the current step to someone else
  if tg_op = 'UPDATE' and new.status = 'Pending' and new.assigned_person_id is distinct from old.assigned_person_id and new.assigned_person_id is not null then
    if not exists (select 1 from approval_steps s where s.requisition_id = new.requisition_id and s.step_order < new.step_order and s.status <> 'Signed') then
      perform notify_person(new.assigned_person_id, 'action', rq.tracking_no || ' needs your ' || lower(new.stage_name),
        coalesce(rq.project_name, ''), 'esign.html?token=' || new.token);
    end if;
  end if;
  return new;
exception when others then
  return new;
end $$;

create or replace trigger notify_steps after insert or update on public.approval_steps for each row execute function public.trg_notify_steps();

-- ---------- overdue reminders (hourly): uses the same thresholds as Reminder Settings, once per waiting step ----------
create or replace function public.notify_run_reminders() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare r record; n integer := 0; hrs integer; ref timestamptz; waited numeric;
begin
  for r in
    select q.id as req_id, q.tracking_no, q.project_name, q.requester_person_id, q.created_at,
           s.id as step_id, s.step_order, s.stage_name,
           (select max(p.signed_at) from approval_steps p where p.requisition_id = q.id and p.step_order = s.step_order - 1) as prev_signed,
           pe.remind_manager_hours, pe.remind_procurement_hours, pe.remind_purchase_hours, pe.remind_received_hours
    from requisitions q
    join people pe on pe.id = q.requester_person_id
    join lateral (select * from approval_steps x where x.requisition_id = q.id and x.status <> 'Signed' order by x.step_order limit 1) s on true
    where q.status not in ('Declined', 'Withdrawn', 'Received')
      and not exists (select 1 from reminder_sent rs where rs.step_id = s.id)
  loop
    hrs := case r.stage_name when 'Manager Approval' then r.remind_manager_hours when 'Procurement Approval' then r.remind_procurement_hours
                             when 'Purchase' then r.remind_purchase_hours when 'Received' then r.remind_received_hours end;
    continue when hrs is null;
    ref := case when r.step_order = 1 then r.created_at else r.prev_signed end;
    continue when ref is null;
    waited := extract(epoch from (now() - ref)) / 3600;
    if waited > hrs then
      insert into reminder_sent(step_id) values (r.step_id) on conflict do nothing;
      perform notify_person(r.requester_person_id, 'reminder', r.tracking_no || ' is overdue',
        coalesce(r.project_name, '') || ' · waiting at ' || r.stage_name || ' for ' ||
        case when waited >= 48 then round(waited / 24) || ' days' else round(waited) || ' hours' end, 'dashboard.html');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.notify_run_reminders() from public, anon, authenticated;
select cron.schedule('notify-reminders', '0 * * * *', 'select public.notify_run_reminders()');

-- ---------- applied separately (values not stored in the repo) ----------
-- select vault.create_secret('<random>', 'notify_secret');  select vault.create_secret('<VAPID private key>', 'vapid_private');  select vault.create_secret('<random>', 'telegram_webhook_secret');
-- insert into notify_config(key,value) values ('vapid_public','<VAPID public key>'), ('site_url','https://<user>.github.io/<repo>/'), ('telegram_bot','<bot username>');
create or replace function public.notify_server_secrets() returns json language sql security definer set search_path=public,extensions as $$
  select json_object_agg(name, decrypted_secret) from vault.decrypted_secrets where name in ('notify_secret','vapid_private','telegram_webhook_secret') $$;
revoke all on function public.notify_server_secrets() from public, anon, authenticated;
grant execute on function public.notify_server_secrets() to service_role;

create or replace function public.send_test_notification(p_person_id uuid, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false, 'error', 'Incorrect PIN.'); end if;
  perform notify_person(p_person_id, 'test', 'Test notification', 'It works. You will get alerts like this from MR Tracker.', 'dashboard.html');
  return json_build_object('success', true);
end $$;
revoke all on function public.send_test_notification(uuid, text) from public;
grant execute on function public.send_test_notification(uuid, text) to anon, authenticated;

-- ---------- email channel (opt-in; sent through the send-email function) ----------
alter table public.notify_prefs add column if not exists email_on boolean not null default false;
-- get_my_notify_prefs now also returns email_on and the person's email; notify_person also sends when email_on is true.
create or replace function public.set_email_notifications(p_person_id uuid, p_pin text, p_on boolean) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false, 'error', 'Incorrect PIN.'); end if;
  insert into notify_prefs(person_id, email_on) values (p_person_id, coalesce(p_on, false))
  on conflict (person_id) do update set email_on = coalesce(p_on, false), updated_at = now();
  return json_build_object('success', true);
end $$;
revoke all on function public.set_email_notifications(uuid, text, boolean) from public;
grant execute on function public.set_email_notifications(uuid, text, boolean) to anon, authenticated;

-- ---------- the old automatic emails are retired (applied live) ----------
-- alter function get_esign_notification(text,text) rename to get_esign_notification_legacy;  (same for get_notification_target)
-- both names now return {"success": false} so no automatic email is sent; people opt in to email in Settings instead.
-- trg_notify_steps also tells the purchaser ('progress') when step 4 (Received) is signed.
