-- ============================================================
-- SPACElogic MR Tracker — hand-drawn e-sign PDF page (hybrid mode)
-- Run AFTER supabase-setup.sql and esignature-upgrade.sql.
-- Additive only: nothing existing is changed or removed.
-- ============================================================

alter table approval_steps
  add column if not exists signature_data text,
  add column if not exists signed_via text;   -- 'pin' (default flow) or 'esign' (drawn signature page)

-- ---------- Load a document for the e-sign page (any step token of the requisition works as the link key) ----------
-- Never returns step tokens or other people's PIN data.
create or replace function get_esign_doc(p_token text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_req_id uuid;
  v_req json;
  v_steps json;
begin
  select requisition_id into v_req_id from approval_steps where token = p_token;
  if v_req_id is null then
    return json_build_object('success', false, 'error', 'Invalid link.');
  end if;

  select row_to_json(rr) into v_req from (
    select r.id, r.tracking_no, r.project_name, r.project_location, r.request_by, r.supply_date, r.form_date,
           r.pc_no, r.pm_incharge, r.materials_subtotal, r.delivery_tax_subtotal, r.grand_total, r.status,
           (select coalesce(json_agg(row_to_json(i) order by i.sn), '[]'::json)
              from (select sn, name, description, qty, unit_price, delivery_tax, link, total
                    from requisition_items where requisition_id = r.id) i) as requisition_items
    from requisitions r where r.id = v_req_id
  ) rr;

  select coalesce(json_agg(row_to_json(s) order by s.step_order), '[]'::json) into v_steps from (
    select step_order, stage_name, status, assigned_person_name, signed_at, signature_data, signed_via,
           declined_at, decline_reason
    from approval_steps where requisition_id = v_req_id
  ) s;

  return json_build_object('success', true, 'requisition', v_req, 'steps', v_steps);
end;
$$;
revoke all on function get_esign_doc(text) from public;
grant execute on function get_esign_doc(text) to anon, authenticated;

-- ---------- Sign one slot with a drawn signature ----------
create or replace function esign_sign_step(p_token text, p_step_order int, p_name text, p_signature text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_req_id uuid;
  v_req_status text;
  v_step approval_steps%rowtype;
  v_prev_status text;
  v_name text := trim(coalesce(p_name,''));
begin
  select requisition_id into v_req_id from approval_steps where token = p_token;
  if v_req_id is null then
    return json_build_object('success', false, 'error', 'Invalid link.');
  end if;
  if v_name = '' or length(v_name) > 80 then
    return json_build_object('success', false, 'error', 'Please type your name.');
  end if;
  if p_signature is null or p_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(p_signature) > 300000 then
    return json_build_object('success', false, 'error', 'Please draw your signature.');
  end if;

  select status into v_req_status from requisitions where id = v_req_id for update;
  if v_req_status in ('Declined','Withdrawn') then
    return json_build_object('success', false, 'error', 'This requisition is ' || lower(v_req_status) || ' and can no longer be signed.');
  end if;

  select * into v_step from approval_steps where requisition_id = v_req_id and step_order = p_step_order for update;
  if not found then
    return json_build_object('success', false, 'error', 'Unknown signing slot.');
  end if;
  if v_step.status <> 'Pending' then
    return json_build_object('success', false, 'error', 'This slot is already ' || lower(v_step.status) || '.');
  end if;
  if v_step.step_order > 1 then
    select status into v_prev_status from approval_steps
      where requisition_id = v_req_id and step_order = v_step.step_order - 1;
    if v_prev_status is distinct from 'Signed' then
      return json_build_object('success', false, 'error', 'The previous signature is not completed yet.');
    end if;
  end if;

  update approval_steps
     set status = 'Signed', signed_at = now(), assigned_person_name = v_name,
         signature_data = p_signature, signed_via = 'esign', failed_attempts = 0
   where id = v_step.id;
  update requisitions set status = v_step.result_status where id = v_req_id;

  return json_build_object('success', true, 'stage', v_step.stage_name, 'signed_by', v_name);
end;
$$;
revoke all on function esign_sign_step(text, int, text, text) from public;
grant execute on function esign_sign_step(text, int, text, text) to anon, authenticated;
