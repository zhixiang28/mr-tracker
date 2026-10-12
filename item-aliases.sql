-- Shared "these names are the same item" choices for the Purchase History / Analytics pages.
-- member_key and canonical_key are the page's normalised item keys (see itemmatch.js); a row whose
-- canonical_key equals its member_key means "keep this name on its own — don't auto-merge it".
-- Rows are switched off (active = false) rather than deleted. Already applied to the live project.
create table if not exists item_aliases (
  member_key text primary key,
  canonical_key text not null,
  canonical_name text not null,
  active boolean not null default true,
  created_by uuid references people(id),
  created_at timestamptz default now()
);
alter table item_aliases enable row level security;

create or replace function list_item_aliases(p_person_id uuid, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_pin(p_person_id, p_pin) then
    return json_build_object('success', false, 'error', 'Incorrect PIN.');
  end if;
  return json_build_object('success', true, 'aliases',
    (select coalesce(json_agg(json_build_object('member_key', member_key, 'canonical_key', canonical_key, 'canonical_name', canonical_name)), '[]'::json) from item_aliases where active));
end;
$$;
revoke all on function list_item_aliases(uuid, text) from public;
grant execute on function list_item_aliases(uuid, text) to anon, authenticated;

create or replace function set_item_aliases(p_person_id uuid, p_pin text, p_rows json)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row json;
  v_n int := 0;
begin
  if not verify_pin(p_person_id, p_pin) then
    return json_build_object('success', false, 'error', 'Incorrect PIN.');
  end if;
  if json_typeof(p_rows) is distinct from 'array' or json_array_length(p_rows) > 200 then
    return json_build_object('success', false, 'error', 'Invalid request.');
  end if;
  for v_row in select * from json_array_elements(p_rows) loop
    if coalesce(trim(v_row->>'member_key'), '') = '' or coalesce(trim(v_row->>'canonical_key'), '') = '' then
      continue;
    end if;
    insert into item_aliases(member_key, canonical_key, canonical_name, active, created_by)
    values (left(v_row->>'member_key', 300), left(v_row->>'canonical_key', 300), left(coalesce(nullif(trim(v_row->>'canonical_name'), ''), v_row->>'canonical_key'), 300), true, p_person_id)
    on conflict (member_key) do update
      set canonical_key = excluded.canonical_key, canonical_name = excluded.canonical_name, active = true, created_by = excluded.created_by, created_at = now();
    v_n := v_n + 1;
  end loop;
  return json_build_object('success', true, 'saved', v_n);
end;
$$;
revoke all on function set_item_aliases(uuid, text, json) from public;
grant execute on function set_item_aliases(uuid, text, json) to anon, authenticated;

create or replace function clear_item_alias(p_person_id uuid, p_pin text, p_member_key text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_pin(p_person_id, p_pin) then
    return json_build_object('success', false, 'error', 'Incorrect PIN.');
  end if;
  update item_aliases set active = false where member_key = p_member_key;
  return json_build_object('success', true);
end;
$$;
revoke all on function clear_item_alias(uuid, text, text) from public;
grant execute on function clear_item_alias(uuid, text, text) to anon, authenticated;
