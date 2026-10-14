-- Appointment levels, verifier choice, vendor-quote / PO / LOA details, and supply-date reminders (applied live).

-- ---------- who may verify: appointment per person (set by an admin) ----------
alter table public.people add column if not exists appointment text
  check (appointment is null or appointment in ('Section Manager','Team Manager','Division Head','Top Management'));
alter table public.requisitions add column if not exists vendor_quote_ref text, add column if not exists po_no text,
  add column if not exists loa_no text, add column if not exists loa_exempt boolean not null default false;

create or replace function public.appointment_rank(p text) returns int language sql immutable as $$
  select case p when 'Section Manager' then 1 when 'Team Manager' then 2 when 'Division Head' then 3 when 'Top Management' then 4 else 0 end $$;
create or replace function public.required_rank(p_total numeric) returns int language sql immutable as $$
  select case when coalesce(p_total,0) <= 300 then 1 when p_total <= 500 then 2 when p_total <= 1000 then 3 else 4 end $$;
create or replace function public.rank_name(p int) returns text language sql immutable as $$
  select case p when 1 then 'Section Manager' when 2 then 'Team Manager' when 3 then 'Division Head' else 'Top Management' end $$;

-- app-wide switch (kept in notify_config): enforce appointment levels when signing the verification step
create or replace function public.get_app_flags() returns json language sql security definer set search_path = public as $$
  select json_build_object('enforce_appointment', coalesce((select value = 'true' from notify_config where key = 'enforce_appointment'), false)) $$;
create or replace function public.admin_set_enforce(p_admin_id uuid, p_admin_pin text, p_on boolean) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not verify_admin(p_admin_id, p_admin_pin) then return json_build_object('success', false, 'error', 'Not authorized — admin PIN check failed.'); end if;
  insert into notify_config(key, value) values ('enforce_appointment', case when p_on then 'true' else 'false' end)
  on conflict (key) do update set value = excluded.value;
  return json_build_object('success', true);
end $$;
create or replace function public.admin_set_appointment(p_admin_id uuid, p_admin_pin text, p_person_id uuid, p_level text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not verify_admin(p_admin_id, p_admin_pin) then return json_build_object('success', false, 'error', 'Not authorized — admin PIN check failed.'); end if;
  if p_level is not null and p_level not in ('Section Manager','Team Manager','Division Head','Top Management') then
    return json_build_object('success', false, 'error', 'Unknown appointment.'); end if;
  update people set appointment = nullif(p_level, '') where id = p_person_id;
  return json_build_object('success', true);
end $$;
revoke all on function public.get_app_flags(), public.admin_set_enforce(uuid, text, boolean), public.admin_set_appointment(uuid, text, uuid, text) from public;
grant execute on function public.get_app_flags(), public.admin_set_enforce(uuid, text, boolean), public.admin_set_appointment(uuid, text, uuid, text) to anon, authenticated;

create or replace function public.admin_list_people(p_admin_id uuid, p_admin_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_result json;
begin
  if not verify_admin(p_admin_id, p_admin_pin) then
    return json_build_object('success', false, 'error', 'Not authorized — admin PIN check failed.');
  end if;
  select coalesce(json_agg(row_to_json(t) order by t.name), '[]'::json) into v_result
  from (
    select p.id, p.name, p.email, p.position, p.department, p.is_admin, p.created_at, p.appointment,
      (select count(*) from requisitions r where r.requester_person_id = p.id) as submissions_count,
      (select count(*) from approval_steps s where s.assigned_person_id = p.id and s.status = 'Signed') as signed_count
    from people p
  ) t;
  return json_build_object('success', true, 'people', v_result);
end $$;

create or replace function public.get_my_profile(p_person_id uuid, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_p record;
begin
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false, 'error', 'Incorrect PIN.'); end if;
  select name, position, department, email, is_admin, appointment into v_p from people where id = p_person_id;
  return json_build_object('success', true, 'name', v_p.name, 'position', v_p.position, 'department', v_p.department,
    'email', v_p.email, 'is_admin', v_p.is_admin, 'appointment', v_p.appointment);
end $$;

-- people who may verify an amount (their appointment is at least the level that amount needs); the asker is not offered
create or replace function public.list_verifiers(p_person_id uuid, p_pin text, p_amount numeric) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false, 'error', 'Incorrect PIN.'); end if;
  return json_build_object('success', true, 'required', rank_name(required_rank(p_amount)), 'people',
    (select coalesce(json_agg(json_build_object('id', p.id, 'name', p.name, 'appointment', p.appointment, 'position', p.position)
        order by appointment_rank(p.appointment), p.name), '[]'::json)
     from people p where p.id <> p_person_id and appointment_rank(p.appointment) >= required_rank(p_amount)));
end $$;
revoke all on function public.list_verifiers(uuid, text, numeric) from public;
grant execute on function public.list_verifiers(uuid, text, numeric) to anon, authenticated;

-- ---------- enforcement at signing ----------
create or replace function public.verifier_problem(p_step_id uuid, p_person uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s approval_steps%rowtype; r requisitions%rowtype; ap text; need int;
begin
  select * into s from approval_steps where id = p_step_id;
  if s.result_status is distinct from 'Manager Approved' then return null; end if;
  if exists (select 1 from approval_steps x where x.requisition_id = s.requisition_id and x.step_order = 4) then return null; end if;   -- older 4-step requisitions
  if not coalesce((select value = 'true' from notify_config where key = 'enforce_appointment'), false) then return null; end if;
  select * into r from requisitions where id = s.requisition_id;
  need := required_rank(r.grand_total);
  if p_person is null then
    return 'Verifying $' || trim(to_char(r.grand_total, 'FM999,999,990.00')) || ' needs ' || rank_name(need) || (case when need < 4 then ' or above' else '' end) || '. Please sign in with your account to sign.';
  end if;
  select appointment into ap from people where id = p_person;
  if appointment_rank(ap) < need then
    return 'Verifying $' || trim(to_char(r.grand_total, 'FM999,999,990.00')) || ' needs ' || rank_name(need) || (case when need < 4 then ' or above' else '' end)
      || '. Your appointment is ' || coalesce(ap, 'not set') || ' — an admin can set it in Admin → People.';
  end if;
  return null;
end $$;
revoke all on function public.verifier_problem(uuid, uuid) from public, anon, authenticated;

create or replace function public.esign_sign_step_as(p_token text, p_step_order integer, p_person_id uuid, p_pin text, p_signature text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_req_id uuid; v_req_status text; v_step approval_steps%rowtype; v_prev_status text; v_name text; v_sig text := p_signature; v_prob text;
begin
  select requisition_id into v_req_id from approval_steps where token = p_token;
  if v_req_id is null then return json_build_object('success', false, 'error', 'Invalid link.'); end if;
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false, 'error', 'Incorrect PIN.'); end if;
  select name, coalesce(v_sig, saved_signature) into v_name, v_sig from people where id = p_person_id;
  if v_sig is null or v_sig !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(v_sig) > 300000 then
    return json_build_object('success', false, 'error', 'Please draw your signature.');
  end if;
  select status into v_req_status from requisitions where id = v_req_id for update;
  if v_req_status in ('Declined','Withdrawn') then
    return json_build_object('success', false, 'error', 'This requisition is ' || lower(v_req_status) || ' and can no longer be signed.');
  end if;
  select * into v_step from approval_steps where requisition_id = v_req_id and step_order = p_step_order for update;
  if not found then return json_build_object('success', false, 'error', 'Unknown signing slot.'); end if;
  if v_step.status <> 'Pending' then return json_build_object('success', false, 'error', 'This slot is already ' || lower(v_step.status) || '.'); end if;
  if v_step.assigned_person_id is not null and v_step.assigned_person_id <> p_person_id then
    return json_build_object('success', false, 'error', 'This step is assigned to ' || coalesce(v_step.assigned_person_name, 'someone else') || '.');
  end if;
  if v_step.step_order > 1 then
    select status into v_prev_status from approval_steps where requisition_id = v_req_id and step_order = v_step.step_order - 1;
    if v_prev_status is distinct from 'Signed' then return json_build_object('success', false, 'error', 'The previous signature is not completed yet.'); end if;
  end if;
  v_prob := verifier_problem(v_step.id, p_person_id);
  if v_prob is not null then return json_build_object('success', false, 'error', v_prob); end if;
  update approval_steps set status = 'Signed', signed_at = now(), assigned_person_id = p_person_id, assigned_person_name = v_name,
         signature_data = v_sig, signed_via = 'esign', failed_attempts = 0 where id = v_step.id;
  update requisitions set status = v_step.result_status where id = v_req_id;
  return json_build_object('success', true, 'stage', v_step.stage_name, 'signed_by', v_name);
end $$;

create or replace function public.esign_sign_step(p_token text, p_step_order integer, p_name text, p_signature text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_req_id uuid; v_req_status text; v_step approval_steps%rowtype; v_prev_status text; v_name text := trim(coalesce(p_name,'')); v_prob text;
begin
  select requisition_id into v_req_id from approval_steps where token = p_token;
  if v_req_id is null then return json_build_object('success', false, 'error', 'Invalid link.'); end if;
  if v_name = '' or length(v_name) > 80 then return json_build_object('success', false, 'error', 'Please type your name.'); end if;
  if p_signature is null or p_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(p_signature) > 300000 then
    return json_build_object('success', false, 'error', 'Please draw your signature.');
  end if;
  select status into v_req_status from requisitions where id = v_req_id for update;
  if v_req_status in ('Declined','Withdrawn') then
    return json_build_object('success', false, 'error', 'This requisition is ' || lower(v_req_status) || ' and can no longer be signed.');
  end if;
  select * into v_step from approval_steps where requisition_id = v_req_id and step_order = p_step_order for update;
  if not found then return json_build_object('success', false, 'error', 'Unknown signing slot.'); end if;
  if v_step.status <> 'Pending' then return json_build_object('success', false, 'error', 'This slot is already ' || lower(v_step.status) || '.'); end if;
  if v_step.assigned_person_id is not null then
    return json_build_object('success', false, 'error', 'This step is assigned to ' || coalesce(v_step.assigned_person_name,'an account') || '. Please sign in as them to sign it.');
  end if;
  if v_step.step_order > 1 then
    select status into v_prev_status from approval_steps where requisition_id = v_req_id and step_order = v_step.step_order - 1;
    if v_prev_status is distinct from 'Signed' then return json_build_object('success', false, 'error', 'The previous signature is not completed yet.'); end if;
  end if;
  v_prob := verifier_problem(v_step.id, null);
  if v_prob is not null then return json_build_object('success', false, 'error', v_prob); end if;
  update approval_steps set status = 'Signed', signed_at = now(), assigned_person_name = v_name,
         signature_data = p_signature, signed_via = 'esign', failed_attempts = 0 where id = v_step.id;
  update requisitions set status = v_step.result_status where id = v_req_id;
  return json_build_object('success', true, 'stage', v_step.stage_name, 'signed_by', v_name);
end $$;

-- ---------- creating a requisition: optional chosen verifier, and the quote / PO / LOA details ----------
-- the chosen verifier travels in the header as verifier_id (same signature as before, so existing callers keep working)
create or replace function public.create_requisition(p_header json, p_items json, p_requester_person_id uuid default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_req_id uuid; v_tracking_no text; v_item json;
  v_stage_names text[] := array['Manager Approval','Procurement','Received'];
  v_result_statuses text[] := array['Manager Approved','Purchased','Received'];
  i int; v_first_token text; v_tok text; v_requester_name text; v_grand numeric := coalesce((p_header->>'grand_total')::numeric, 0);
  v_vname text; v_exempt boolean := coalesce((p_header->>'loa_exempt')::boolean, false); p_verifier uuid := nullif(p_header->>'verifier_id', '')::uuid;
begin
  if v_grand >= 50000 and (coalesce(trim(p_header->>'vendor_quote_ref'), '') = '' or coalesce(trim(p_header->>'po_no'), '') = '') then
    return json_build_object('success', false, 'error', 'Orders of $50,000 and above need the vendor quotation reference and the PO number.');
  end if;
  if v_grand >= 150000 and not v_exempt and coalesce(trim(p_header->>'loa_no'), '') = '' then
    return json_build_object('success', false, 'error', 'Orders of $150,000 and above need an LOA number (unless it is supply of goods only).');
  end if;
  if p_requester_person_id is not null then select name into v_requester_name from people where id = p_requester_person_id; end if;
  if p_verifier is not null then
    select name into v_vname from people where id = p_verifier and appointment_rank(appointment) >= required_rank(v_grand);
    if v_vname is null then return json_build_object('success', false, 'error', 'That person cannot verify this amount.'); end if;
  end if;

  insert into requisitions (
    project_name, project_location, request_by, supply_date, form_date, pc_no, pm_incharge,
    materials_subtotal, delivery_tax_subtotal, grand_total, requester_person_id, vendor_quote_ref, po_no, loa_no, loa_exempt
  ) values (
    p_header->>'project_name', p_header->>'project_location', coalesce(v_requester_name, p_header->>'request_by'),
    nullif(p_header->>'supply_date','')::date, nullif(p_header->>'form_date','')::date, p_header->>'pc_no', p_header->>'pm_incharge',
    coalesce((p_header->>'materials_subtotal')::numeric,0), coalesce((p_header->>'delivery_tax_subtotal')::numeric,0), v_grand, p_requester_person_id,
    nullif(trim(p_header->>'vendor_quote_ref'), ''), nullif(trim(p_header->>'po_no'), ''), nullif(trim(p_header->>'loa_no'), ''), v_exempt
  ) returning id, tracking_no into v_req_id, v_tracking_no;

  for v_item in select * from json_array_elements(p_items) loop
    insert into requisition_items(requisition_id, sn, name, description, qty, unit_price, delivery_tax, link, total)
    values (v_req_id, (v_item->>'sn')::int, v_item->>'name', v_item->>'description',
      coalesce((v_item->>'qty')::numeric,0), coalesce((v_item->>'unit_price')::numeric,0), coalesce((v_item->>'delivery_tax')::numeric,0),
      v_item->>'link', coalesce((v_item->>'qty')::numeric,0) * coalesce((v_item->>'unit_price')::numeric,0));
  end loop;

  for i in 1..3 loop
    insert into approval_steps(requisition_id, step_order, stage_name, result_status, assigned_person_id, assigned_person_name)
    values (v_req_id, i, v_stage_names[i], v_result_statuses[i], case when i = 1 then p_verifier end, case when i = 1 then v_vname end)
    returning token into v_tok;
    if i = 1 then v_first_token := v_tok; end if;
  end loop;

  return json_build_object('success', true, 'requisition_id', v_req_id, 'tracking_no', v_tracking_no, 'first_token', v_first_token, 'verifier', v_vname);
end $$;

-- ---------- revising a declined requisition: the quote / PO / LOA details are checked and saved just before resubmitting ----------
-- (requester_resubmit itself is unchanged; the form calls this first)
create or replace function public.set_requisition_details(p_person_id uuid, p_pin text, p_requisition_id uuid, p_header json) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_requester uuid; v_status text; v_grand numeric := coalesce((p_header->>'grand_total')::numeric, 0); v_exempt boolean := coalesce((p_header->>'loa_exempt')::boolean, false);
begin
  if not verify_pin(p_person_id, p_pin) then return json_build_object('success', false, 'error', 'Incorrect PIN.'); end if;
  select requester_person_id, status into v_requester, v_status from requisitions where id = p_requisition_id;
  if v_requester is distinct from p_person_id then return json_build_object('success', false, 'error', 'You can only revise requisitions you submitted.'); end if;
  if v_status not in ('Declined', 'Submitted') then return json_build_object('success', false, 'error', 'This requisition can no longer be changed.'); end if;
  if v_grand >= 50000 and (coalesce(trim(p_header->>'vendor_quote_ref'), '') = '' or coalesce(trim(p_header->>'po_no'), '') = '') then
    return json_build_object('success', false, 'error', 'Orders of $50,000 and above need the vendor quotation reference and the PO number.');
  end if;
  if v_grand >= 150000 and not v_exempt and coalesce(trim(p_header->>'loa_no'), '') = '' then
    return json_build_object('success', false, 'error', 'Orders of $150,000 and above need an LOA number (unless it is supply of goods only).');
  end if;
  update requisitions set vendor_quote_ref = nullif(trim(p_header->>'vendor_quote_ref'), ''), po_no = nullif(trim(p_header->>'po_no'), ''),
         loa_no = nullif(trim(p_header->>'loa_no'), ''), loa_exempt = v_exempt where id = p_requisition_id;
  return json_build_object('success', true);
end $$;
revoke all on function public.set_requisition_details(uuid, text, uuid, json) from public;
grant execute on function public.set_requisition_details(uuid, text, uuid, json) to anon, authenticated;

-- ---------- hourly: overdue stages (as before) + supply date reached and nothing received ----------
create or replace function public.notify_run_reminders() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare r record; n integer := 0; hrs integer; ref timestamptz; waited numeric; d int;
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
    hrs := case r.stage_name when 'Manager Approval' then r.remind_manager_hours
                             when 'Procurement' then r.remind_procurement_hours when 'Procurement Approval' then r.remind_procurement_hours
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

  -- supply date is tomorrow, today or past and the items have not been received (once per requisition)
  for r in
    select q.id as req_id, q.tracking_no, q.project_name, q.requester_person_id, q.supply_date
    from requisitions q
    where q.status not in ('Declined', 'Withdrawn', 'Received') and q.supply_date is not null
      and q.supply_date <= (now() at time zone 'Asia/Singapore')::date + 1
      and not exists (select 1 from reminder_sent rs where rs.step_id = q.id)
  loop
    d := r.supply_date - (now() at time zone 'Asia/Singapore')::date;
    insert into reminder_sent(step_id) values (r.req_id) on conflict do nothing;
    perform notify_person(r.requester_person_id, 'reminder', r.tracking_no || ' is due ' || case when d = 1 then 'tomorrow' when d = 0 then 'today' else abs(d) || ' day' || (case when abs(d) = 1 then '' else 's' end) || ' ago' end,
      coalesce(r.project_name, '') || ' · supply date ' || to_char(r.supply_date, 'DD/MM/YYYY') || ' and it is not marked received yet', 'dashboard.html');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.notify_run_reminders() from public, anon, authenticated;
