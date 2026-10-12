-- STATUS: sign_step and decline_step (part 1) are applied to the live project. requester_resubmit (part 2, contains a DELETE)
-- timed out through the tool and still needs to be run once in the Supabase SQL editor.
-- ============================================================
-- SPACElogic MR Tracker — hardening for the PIN + PDF e-sign flows
-- Run AFTER esign-pdf-upgrade.sql. Replaces three existing functions
-- (CREATE OR REPLACE), keeping their behaviour and adding guards.
-- ============================================================

-- 1) A withdrawn/declined requisition can no longer be signed or declined through an
--    already-claimed link (before, signing a withdrawn requisition silently un-withdrew it).
create or replace function sign_step(p_token text, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_step approval_steps%rowtype;
  v_req_status text;
  v_prev_status text;
  v_ok boolean;
  v_next_token text;
  v_next_stage text;
begin
  select * into v_step from approval_steps where token = p_token;
  if not found then
    return json_build_object('success', false, 'error', 'Invalid link.');
  end if;
  select status into v_req_status from requisitions where id = v_step.requisition_id;
  if v_req_status in ('Withdrawn','Declined') then
    return json_build_object('success', false, 'error', 'This requisition has been ' || lower(v_req_status) || ' and can no longer be signed.');
  end if;
  if v_step.status <> 'Pending' then
    return json_build_object('success', false, 'error', 'This step is already ' || v_step.status || '.');
  end if;
  if v_step.locked_until is not null and v_step.locked_until > now() then
    return json_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
  end if;
  if v_step.step_order > 1 then
    select status into v_prev_status from approval_steps
      where requisition_id = v_step.requisition_id and step_order = v_step.step_order - 1;
    if v_prev_status is distinct from 'Signed' then
      return json_build_object('success', false, 'error', 'The previous approval step is not completed yet.');
    end if;
  end if;

  v_ok := verify_pin(v_step.assigned_person_id, p_pin);
  if not v_ok then
    update approval_steps
      set failed_attempts = failed_attempts + 1,
          locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end
      where id = v_step.id;
    return json_build_object('success', false, 'error', 'Incorrect PIN.');
  end if;

  update approval_steps set status='Signed', signed_at=now(), signed_via='pin', failed_attempts=0 where id = v_step.id;
  update requisitions set status = v_step.result_status where id = v_step.requisition_id;

  select token, stage_name into v_next_token, v_next_stage from approval_steps
    where requisition_id = v_step.requisition_id and step_order = v_step.step_order + 1;

  return json_build_object(
    'success', true, 'requisition_id', v_step.requisition_id,
    'stage', v_step.stage_name, 'signed_by', v_step.assigned_person_name, 'signed_by_id', v_step.assigned_person_id,
    'next_token', v_next_token, 'next_stage', v_next_stage
  );
end;
$$;

create or replace function decline_step(p_token text, p_pin text, p_reason text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_step approval_steps%rowtype;
  v_req_status text;
  v_ok boolean;
begin
  select * into v_step from approval_steps where token = p_token;
  if not found then
    return json_build_object('success', false, 'error', 'Invalid link.');
  end if;
  select status into v_req_status from requisitions where id = v_step.requisition_id;
  if v_req_status in ('Withdrawn','Declined') then
    return json_build_object('success', false, 'error', 'This requisition has been ' || lower(v_req_status) || ' and can no longer be changed.');
  end if;
  if v_step.status <> 'Pending' then
    return json_build_object('success', false, 'error', 'This step is already ' || v_step.status || '.');
  end if;
  if v_step.locked_until is not null and v_step.locked_until > now() then
    return json_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
  end if;

  v_ok := verify_pin(v_step.assigned_person_id, p_pin);
  if not v_ok then
    update approval_steps
      set failed_attempts = failed_attempts + 1,
          locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end
      where id = v_step.id;
    return json_build_object('success', false, 'error', 'Incorrect PIN.');
  end if;

  update approval_steps set status='Declined', declined_at=now(), decline_reason=p_reason, failed_attempts=0 where id = v_step.id;
  update requisitions set status='Declined', declined_at=now(), declined_by=v_step.assigned_person_name, decline_reason=p_reason
    where id = v_step.requisition_id;

  return json_build_object('success', true, 'requisition_id', v_step.requisition_id, 'stage', v_step.stage_name,
    'declined_by', v_step.assigned_person_name, 'declined_by_id', v_step.assigned_person_id);
end;
$$;

-- 2) Resubmitting a declined requisition fully resets drawn signatures too, and forgets names that were
--    only typed on the e-sign page (so steps don't show "Waiting for <old name>").
create or replace function requester_resubmit(p_person_id uuid, p_pin text, p_requisition_id uuid, p_header json, p_items json)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_status text;
  v_requester uuid;
  v_materials numeric := 0;
  v_dtax numeric := 0;
  v_item json;
  v_qty numeric; v_price numeric; v_dtaxv numeric;
  v_first_token text;
begin
  if not verify_pin(p_person_id, p_pin) then
    return json_build_object('success', false, 'error', 'Incorrect PIN.');
  end if;

  select status, requester_person_id into v_status, v_requester from requisitions where id = p_requisition_id;
  if v_requester is distinct from p_person_id then
    return json_build_object('success', false, 'error', 'You can only revise requisitions you submitted.');
  end if;
  if v_status is distinct from 'Declined' then
    return json_build_object('success', false, 'error', 'This requisition is not currently declined.');
  end if;

  update requisitions set
    project_name = coalesce(p_header->>'project_name', project_name),
    project_location = coalesce(p_header->>'project_location', project_location),
    supply_date = coalesce(nullif(p_header->>'supply_date','')::date, supply_date),
    form_date = coalesce(nullif(p_header->>'form_date','')::date, form_date),
    pc_no = coalesce(p_header->>'pc_no', pc_no),
    pm_incharge = coalesce(p_header->>'pm_incharge', pm_incharge)
  where id = p_requisition_id;

  delete from requisition_items where requisition_id = p_requisition_id;
  for v_item in select * from json_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'qty')::numeric,0);
    v_price := coalesce((v_item->>'unit_price')::numeric,0);
    v_dtaxv := coalesce((v_item->>'delivery_tax')::numeric,0);
    insert into requisition_items(requisition_id, sn, name, description, qty, unit_price, delivery_tax, link, total)
    values (p_requisition_id, (v_item->>'sn')::int, v_item->>'name', v_item->>'description', v_qty, v_price, v_dtaxv, v_item->>'link', v_qty*v_price);
    v_materials := v_materials + (v_qty*v_price);
    v_dtax := v_dtax + v_dtaxv;
  end loop;
  update requisitions set materials_subtotal = v_materials, delivery_tax_subtotal = v_dtax, grand_total = v_materials + v_dtax
  where id = p_requisition_id;

  -- Full restart: every step goes back to Pending, keeping who was assigned (PIN signers) so the
  -- same people can re-approve using the link they already have.
  update approval_steps
    set status = 'Pending', signed_at = null, decline_reason = null, declined_at = null,
        failed_attempts = 0, locked_until = null, is_override = false, override_by = null,
        signature_data = null, signed_via = null,
        assigned_person_name = case when assigned_person_id is null then null else assigned_person_name end
    where requisition_id = p_requisition_id;

  update requisitions
    set status = 'Submitted', declined_at = null, declined_by = null, decline_reason = null
    where id = p_requisition_id;

  select token into v_first_token from approval_steps where requisition_id = p_requisition_id and step_order = 1;

  return json_build_object('success', true, 'new_status', 'Submitted', 'first_token', v_first_token);
end;
$$;
