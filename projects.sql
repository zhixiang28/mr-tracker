-- Shared project list (project name, location, PC no., PM in-charge) managed by admins on projects.html and
-- offered to everyone as they type on the requisition form. Archiving hides a project instead of deleting it.
-- Already applied to the live project.
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  pc_no text,
  pm_incharge text,
  active boolean not null default true,
  created_by uuid references people(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table projects enable row level security;
create unique index if not exists projects_name_pc_uniq on projects (lower(name), coalesce(lower(pc_no), ''));

create or replace function list_projects(p_person_id uuid, p_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_pin(p_person_id, p_pin) then
    return json_build_object('success', false, 'error', 'Incorrect PIN.');
  end if;
  return json_build_object('success', true, 'projects',
    (select coalesce(json_agg(json_build_object('id', id, 'name', name, 'location', location, 'pc_no', pc_no, 'pm_incharge', pm_incharge) order by lower(name), pc_no), '[]'::json)
       from projects where active));
end;
$$;
revoke all on function list_projects(uuid, text) from public;
grant execute on function list_projects(uuid, text) to anon, authenticated;

create or replace function admin_list_projects(p_admin_id uuid, p_admin_pin text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not verify_admin(p_admin_id, p_admin_pin) then
    return json_build_object('success', false, 'error', 'Not authorized — admin PIN check failed.');
  end if;
  return json_build_object('success', true, 'projects',
    (select coalesce(json_agg(json_build_object('id', id, 'name', name, 'location', location, 'pc_no', pc_no, 'pm_incharge', pm_incharge, 'active', active) order by active desc, lower(name), pc_no), '[]'::json)
       from projects));
end;
$$;
revoke all on function admin_list_projects(uuid, text) from public;
grant execute on function admin_list_projects(uuid, text) to anon, authenticated;

-- p_id null = add a new project; otherwise edit it. p_active false = archive, true = restore.
create or replace function admin_save_project(p_admin_id uuid, p_admin_pin text, p_id uuid, p_name text, p_location text, p_pc_no text, p_pm text, p_active boolean)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if not verify_admin(p_admin_id, p_admin_pin) then
    return json_build_object('success', false, 'error', 'Not authorized — admin PIN check failed.');
  end if;
  if coalesce(trim(p_name), '') = '' then
    return json_build_object('success', false, 'error', 'Project name is required.');
  end if;
  if p_id is null then
    insert into projects(name, location, pc_no, pm_incharge, active, created_by)
    values (left(trim(p_name), 200), nullif(left(trim(coalesce(p_location,'')), 200), ''), nullif(left(trim(coalesce(p_pc_no,'')), 80), ''), nullif(left(trim(coalesce(p_pm,'')), 120), ''), coalesce(p_active, true), p_admin_id)
    returning id into v_id;
  else
    update projects set name = left(trim(p_name), 200),
      location = nullif(left(trim(coalesce(p_location,'')), 200), ''),
      pc_no = nullif(left(trim(coalesce(p_pc_no,'')), 80), ''),
      pm_incharge = nullif(left(trim(coalesce(p_pm,'')), 120), ''),
      active = coalesce(p_active, true), updated_at = now()
    where id = p_id returning id into v_id;
    if v_id is null then
      return json_build_object('success', false, 'error', 'Project not found.');
    end if;
  end if;
  return json_build_object('success', true, 'id', v_id);
exception
  when unique_violation then
    return json_build_object('success', false, 'error', 'A project with that name and PC no. already exists.');
end;
$$;
revoke all on function admin_save_project(uuid, text, uuid, text, text, text, text, boolean) from public;
grant execute on function admin_save_project(uuid, text, uuid, text, text, text, text, boolean) to anon, authenticated;
