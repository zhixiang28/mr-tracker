-- New Materials Requisition Form flow (applied live):
--   NEW requisitions have 3 signing steps: Manager Approval -> Procurement (approves AND buys = "Processed by") -> Received.
--   Requisitions already in progress keep their 4 steps (Manager, Procurement Approval, Purchase, Received); every function below handles both.

create or replace function public.create_requisition(p_header json, p_items json, p_requester_person_id uuid default null) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_req_id uuid; v_tracking_no text; v_item json;
  v_stage_names text[] := array['Manager Approval','Procurement','Received'];
  v_result_statuses text[] := array['Manager Approved','Purchased','Received'];
  i int; v_first_token text; v_tok text; v_requester_name text;
begin
  if p_requester_person_id is not null then
    select name into v_requester_name from people where id = p_requester_person_id;
  end if;

  insert into requisitions (
    project_name, project_location, request_by, supply_date, form_date, pc_no, pm_incharge,
    materials_subtotal, delivery_tax_subtotal, grand_total, requester_person_id
  ) values (
    p_header->>'project_name', p_header->>'project_location',
    coalesce(v_requester_name, p_header->>'request_by'),
    nullif(p_header->>'supply_date','')::date, nullif(p_header->>'form_date','')::date,
    p_header->>'pc_no', p_header->>'pm_incharge',
    coalesce((p_header->>'materials_subtotal')::numeric,0), coalesce((p_header->>'delivery_tax_subtotal')::numeric,0), coalesce((p_header->>'grand_total')::numeric,0),
    p_requester_person_id
  ) returning id, tracking_no into v_req_id, v_tracking_no;

  for v_item in select * from json_array_elements(p_items) loop
    insert into requisition_items(requisition_id, sn, name, description, qty, unit_price, delivery_tax, link, total)
    values (
      v_req_id, (v_item->>'sn')::int, v_item->>'name', v_item->>'description',
      coalesce((v_item->>'qty')::numeric,0), coalesce((v_item->>'unit_price')::numeric,0), coalesce((v_item->>'delivery_tax')::numeric,0),
      v_item->>'link', coalesce((v_item->>'qty')::numeric,0) * coalesce((v_item->>'unit_price')::numeric,0)
    );
  end loop;

  for i in 1..3 loop
    insert into approval_steps(requisition_id, step_order, stage_name, result_status, assigned_person_id, assigned_person_name)
    values (v_req_id, i, v_stage_names[i], v_result_statuses[i], null, null)
    returning token into v_tok;
    if i = 1 then v_first_token := v_tok; end if;
  end loop;

  return json_build_object('success', true, 'requisition_id', v_req_id, 'tracking_no', v_tracking_no, 'first_token', v_first_token);
end $$;

-- admin "move to stage": find the step by its result status instead of a fixed position, so 3-step and 4-step requisitions both work
create or replace function public.admin_override_stage(p_admin_id uuid, p_admin_pin text, p_requisition_id uuid, p_target_status text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin_name text; v_target_order int;
begin
  if not verify_admin(p_admin_id, p_admin_pin) then
    return json_build_object('success', false, 'error', 'Not authorized — admin PIN check failed.');
  end if;
  select step_order into v_target_order from approval_steps where requisition_id = p_requisition_id and result_status = p_target_status;
  if v_target_order is null then
    return json_build_object('success', false, 'error', 'Invalid target stage.');
  end if;
  select name into v_admin_name from people where id = p_admin_id;

  update approval_steps
    set status = 'Signed', signed_at = coalesce(signed_at, now()), decline_reason = null, declined_at = null,
        failed_attempts = 0, locked_until = null, is_override = true, override_by = v_admin_name
    where requisition_id = p_requisition_id and step_order <= v_target_order and status <> 'Signed';

  update approval_steps
    set status = 'Pending', signed_at = null, decline_reason = null, declined_at = null,
        failed_attempts = 0, locked_until = null, is_override = false, override_by = null
    where requisition_id = p_requisition_id and step_order > v_target_order;

  update requisitions
    set status = p_target_status, declined_at = null, declined_by = null, decline_reason = null
    where id = p_requisition_id;

  return json_build_object('success', true, 'new_status', p_target_status, 'overridden_by', v_admin_name);
end $$;

-- hourly overdue check: the new "Procurement" stage uses the Procurement limit
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
  return n;
end $$;
revoke all on function public.notify_run_reminders() from public, anon, authenticated;

-- notifications: when the Received step is signed, tell whoever bought it (the step whose result is 'Purchased')
create or replace function public.trg_notify_steps() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare rq record; nxt record; who text; buyer record;
begin
  select tracking_no, project_name, requester_person_id into rq from requisitions where id = new.requisition_id;
  if rq.tracking_no is null then return new; end if;

  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.status = 'Pending' and old.status <> 'Pending') then
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
    if new.result_status = 'Received' then
      select assigned_person_id into buyer from approval_steps where requisition_id = new.requisition_id and result_status = 'Purchased';
      if buyer.assigned_person_id is not null and buyer.assigned_person_id is distinct from rq.requester_person_id
         and buyer.assigned_person_id is distinct from new.assigned_person_id then
        perform notify_person(buyer.assigned_person_id, 'progress', rq.tracking_no || ': items received',
          coalesce(rq.project_name, '') || ' · the items you purchased were marked received', 'dashboard.html');
      end if;
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
