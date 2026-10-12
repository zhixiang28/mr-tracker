-- Company-wide list of purchased line items (for the Purchase History page, available to every logged-in person).
-- Returns item name/description/qty/price/link plus the requisition's tracking no., project, requester, status and date.
-- Withdrawn and declined requisitions are left out. Already applied to the live project.
create or replace function list_purchase_history(p_person_id uuid, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_items json;
begin
  if not verify_pin(p_person_id, p_pin) then
    return json_build_object('success', false, 'error', 'Incorrect PIN.');
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.item_date desc nulls last, t.tracking_no desc), '[]'::json) into v_items
  from (
    select i.id as item_id, i.name, i.description, i.qty, i.unit_price, i.delivery_tax, i.link,
           r.id as requisition_id, r.tracking_no, r.project_name, r.request_by, r.status,
           coalesce(r.form_date, r.created_at::date) as item_date
    from requisition_items i
    join requisitions r on r.id = i.requisition_id
    where r.status not in ('Withdrawn', 'Declined')
      and coalesce(trim(i.name), '') <> ''
  ) t;

  return json_build_object('success', true, 'items', v_items);
end;
$$;
revoke all on function list_purchase_history(uuid, text) from public;
grant execute on function list_purchase_history(uuid, text) to anon, authenticated;
