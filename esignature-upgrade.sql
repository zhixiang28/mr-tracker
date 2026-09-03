-- ============================================================
-- SPACElogic MR Tracker — e-Signature upgrade
-- Run this AFTER supabase-setup.sql, in the SQL Editor.
-- (Already applied to the live "mr-tracker" project — only needed
-- if you're setting up a separate/new Supabase project.)
-- ============================================================

-- ---------- People directory (hashed PINs) ----------
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  pin text,
  pin_hash text,
  created_at timestamptz default now()
);

create or replace function hash_person_pin()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.pin is not null then
    new.pin_hash := crypt(new.pin, gen_salt('bf'));
    new.pin := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hash_person_pin on people;
create trigger trg_hash_person_pin
before insert or update on people
for each row execute function hash_person_pin();

alter table people enable row level security;
-- deliberately NO select/insert/update policy for anon on the base table —
-- all writes go through register_person(), all reads through people_public.

create or replace view people_public as
  select id, name, created_at from people order by name;
grant select on people_public to anon, authenticated;

create or replace function verify_pin(p_person_id uuid, p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  select pin_hash into v_hash from people where id = p_person_id;
  if v_hash is null then return false; end if;
  return v_hash = crypt(p_pin, v_hash);
end;
$$;
revoke all on function verify_pin(uuid, text) from public;
grant execute on function verify_pin(uuid, text) to anon, authenticated;

create or replace function register_person(p_name text, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_name is null or trim(p_name) = '' then
    return json_build_object('success', false, 'error', 'Name is required.');
  end if;
  if p_pin !~ '^\d{4}$' then
    return json_build_object('success', false, 'error', 'PIN must be exactly 4 digits.');
  end if;
  insert into people(name, pin) values (trim(p_name), p_pin) returning id into v_id;
  return json_build_object('success', true, 'id', v_id, 'name', trim(p_name));
exception
  when unique_violation then
    return json_build_object('success', false, 'error', 'That name is already registered.');
end;
$$;
revoke all on function register_person(text, text) from public;
grant execute on function register_person(text, text) to anon, authenticated;

-- ---------- Extend requisitions ----------
alter table requisitions
  add column if not exists manager_person_id uuid references people(id),
  add column if not exists approve_person_id uuid references people(id),
  add column if not exists purchase_person_id uuid references people(id),
  add column if not exists received_person_id uuid references people(id),
  add column if not exists declined_at timestamptz,
  add column if not exists declined_by text,
  add column if not exists decline_reason text;

alter table requisitions drop constraint if exists requisitions_status_check;
alter table requisitions add constraint requisitions_status_check
  check (status in ('Submitted','Manager Approved','Procurement Approved','Purchased','Received','Declined'));

grant select, insert on requisitions to anon, authenticated;
grant select, insert on requisition_items to anon, authenticated;

-- ---------- Approval steps (sequential signing chain) ----------
create table if not exists approval_steps (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid references requisitions(id) on delete cascade,
  step_order int not null,
  stage_name text not null,
  result_status text not null,
  assigned_person_id uuid references people(id),
  assigned_person_name text,
  token text unique not null default encode(gen_random_bytes(16),'hex'),
  status text not null default 'Pending' check (status in ('Pending','Signed','Declined')),
  signed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz default now(),
  unique(requisition_id, step_order)
);

alter table approval_steps enable row level security;
drop policy if exists "public read steps" on approval_steps;
create policy "public read steps" on approval_steps for select using (true);
drop policy if exists "public insert steps" on approval_steps;
create policy "public insert steps" on approval_steps for insert with check (true);
grant select, insert on approval_steps to anon, authenticated;

-- ---------- Sign a step ----------
create or replace function sign_step(p_token text, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_step approval_steps%rowtype;
  v_prev_status text;
  v_ok boolean;
  v_next_token text;
begin
  select * into v_step from approval_steps where token = p_token;
  if not found then
    return json_build_object('success', false, 'error', 'Invalid link.');
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

  update approval_steps set status='Signed', signed_at=now(), failed_attempts=0 where id = v_step.id;
  update requisitions set status = v_step.result_status where id = v_step.requisition_id;

  select token into v_next_token from approval_steps
    where requisition_id = v_step.requisition_id and step_order = v_step.step_order + 1;

  return json_build_object(
    'success', true, 'requisition_id', v_step.requisition_id,
    'stage', v_step.stage_name, 'signed_by', v_step.assigned_person_name, 'next_token', v_next_token
  );
end;
$$;
revoke all on function sign_step(text, text) from public;
grant execute on function sign_step(text, text) to anon, authenticated;

-- ---------- Decline a step ----------
create or replace function decline_step(p_token text, p_pin text, p_reason text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_step approval_steps%rowtype;
  v_ok boolean;
begin
  select * into v_step from approval_steps where token = p_token;
  if not found then
    return json_build_object('success', false, 'error', 'Invalid link.');
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

  return json_build_object('success', true, 'stage', v_step.stage_name, 'declined_by', v_step.assigned_person_name);
end;
$$;
revoke all on function decline_step(text, text, text) from public;
grant execute on function decline_step(text, text, text) to anon, authenticated;

-- ---------- Create requisition + items + 4-step approval chain atomically ----------
create or replace function create_requisition(p_header json, p_items json, p_signers json)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_req_id uuid;
  v_tracking_no text;
  v_item json;
  v_signer json;
  v_stage_names text[] := array['Manager Approval','Procurement Approval','Purchase','Received'];
  v_result_statuses text[] := array['Manager Approved','Procurement Approved','Purchased','Received'];
  i int;
  v_person_id uuid;
  v_person_name text;
  v_first_token text;
  v_tok text;
begin
  insert into requisitions (
    project_name, project_location, request_by, supply_date, form_date, pc_no, pm_incharge,
    manager_name, approve_by, purchase_by, received_by,
    manager_person_id, approve_person_id, purchase_person_id, received_person_id,
    materials_subtotal, delivery_tax_subtotal, grand_total
  ) values (
    p_header->>'project_name', p_header->>'project_location', p_header->>'request_by',
    nullif(p_header->>'supply_date','')::date, nullif(p_header->>'form_date','')::date,
    p_header->>'pc_no', p_header->>'pm_incharge',
    p_header->>'manager_name', p_header->>'approve_by', p_header->>'purchase_by', p_header->>'received_by',
    nullif(p_header->>'manager_person_id','')::uuid, nullif(p_header->>'approve_person_id','')::uuid,
    nullif(p_header->>'purchase_person_id','')::uuid, nullif(p_header->>'received_person_id','')::uuid,
    coalesce((p_header->>'materials_subtotal')::numeric,0), coalesce((p_header->>'delivery_tax_subtotal')::numeric,0), coalesce((p_header->>'grand_total')::numeric,0)
  ) returning id, tracking_no into v_req_id, v_tracking_no;

  for v_item in select * from json_array_elements(p_items) loop
    insert into requisition_items(requisition_id, sn, name, description, qty, unit_price, delivery_tax, link, total)
    values (
      v_req_id, (v_item->>'sn')::int, v_item->>'name', v_item->>'description',
      coalesce((v_item->>'qty')::numeric,0), coalesce((v_item->>'unit_price')::numeric,0), coalesce((v_item->>'delivery_tax')::numeric,0),
      v_item->>'link', coalesce((v_item->>'qty')::numeric,0) * coalesce((v_item->>'unit_price')::numeric,0)
    );
  end loop;

  for i in 1..4 loop
    v_signer := p_signers->(i-1);
    v_person_id := nullif(v_signer->>'person_id','')::uuid;
    v_person_name := v_signer->>'name';
    insert into approval_steps(requisition_id, step_order, stage_name, result_status, assigned_person_id, assigned_person_name)
    values (v_req_id, i, v_stage_names[i], v_result_statuses[i], v_person_id, v_person_name)
    returning token into v_tok;
    if i = 1 then v_first_token := v_tok; end if;
  end loop;

  return json_build_object('success', true, 'requisition_id', v_req_id, 'tracking_no', v_tracking_no, 'first_token', v_first_token);
end;
$$;
revoke all on function create_requisition(json, json, json) from public;
grant execute on function create_requisition(json, json, json) to anon, authenticated;
