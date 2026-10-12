-- Lets an admin withdraw any requisition that isn't Purchased / Received / Withdrawn yet.
-- (Requesters keep using requester_withdraw for their own.) Already applied to the live project.
create or replace function admin_withdraw_requisition(p_admin_id uuid, p_admin_pin text, p_requisition_id uuid)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_status text;
begin
  if not verify_admin(p_admin_id, p_admin_pin) then
    return json_build_object('success', false, 'error', 'Not authorized — admin PIN check failed.');
  end if;
  select status into v_status from requisitions where id = p_requisition_id;
  if not found then
    return json_build_object('success', false, 'error', 'Requisition not found.');
  end if;
  if v_status in ('Purchased','Received','Withdrawn') then
    return json_build_object('success', false, 'error', 'This requisition is already ' || lower(v_status) || ' and can no longer be withdrawn.');
  end if;
  update requisitions set status = 'Withdrawn', withdrawn_at = now() where id = p_requisition_id;
  return json_build_object('success', true);
end;
$$;
revoke all on function admin_withdraw_requisition(uuid, text, uuid) from public;
grant execute on function admin_withdraw_requisition(uuid, text, uuid) to anon, authenticated;
