-- Lets an admin reject (decline) a requisition that isn't Declined / Purchased / Received / Withdrawn yet.
-- The waiting step is marked Declined with the admin's reason; the requester can then revise and resubmit as usual.
-- Already applied to the live project.
create or replace function admin_reject_requisition(p_admin_id uuid, p_admin_pin text, p_requisition_id uuid, p_reason text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_status text;
  v_admin_name text;
  v_reason text := trim(coalesce(p_reason, ''));
  v_step_id uuid;
begin
  if not verify_admin(p_admin_id, p_admin_pin) then
    return json_build_object('success', false, 'error', 'Not authorized — admin PIN check failed.');
  end if;
  if v_reason = '' then
    return json_build_object('success', false, 'error', 'Please give a reason for rejecting.');
  end if;
  select status into v_status from requisitions where id = p_requisition_id for update;
  if not found then
    return json_build_object('success', false, 'error', 'Requisition not found.');
  end if;
  if v_status in ('Declined','Purchased','Received','Withdrawn') then
    return json_build_object('success', false, 'error', 'This requisition is already ' || lower(v_status) || ' and can no longer be rejected.');
  end if;

  select name into v_admin_name from people where id = p_admin_id;

  select id into v_step_id from approval_steps
    where requisition_id = p_requisition_id and status = 'Pending'
    order by step_order limit 1;
  if v_step_id is not null then
    update approval_steps
       set status = 'Declined', declined_at = now(), decline_reason = v_reason
     where id = v_step_id;
  end if;

  update requisitions
     set status = 'Declined', declined_at = now(), declined_by = v_admin_name || ' (admin)', decline_reason = v_reason
   where id = p_requisition_id;

  return json_build_object('success', true);
end;
$$;
revoke all on function admin_reject_requisition(uuid, text, uuid, text) from public;
grant execute on function admin_reject_requisition(uuid, text, uuid, text) to anon, authenticated;
