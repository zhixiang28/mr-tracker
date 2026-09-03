-- ============================================================
-- SPACElogic Materials Requisition — Supabase schema
-- Run this once in your Supabase project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste all → Run)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Sequence for human-readable tracking numbers ----------
create sequence if not exists requisition_seq start 1;

-- ---------- Main requisition (header) table ----------
create table if not exists requisitions (
  id uuid primary key default gen_random_uuid(),
  tracking_no text unique,

  project_name text,
  project_location text,
  request_by text,
  supply_date date,
  form_date date,
  pc_no text,
  pm_incharge text,

  manager_name text,
  approve_by text,
  purchase_by text,
  received_by text,

  materials_subtotal numeric default 0,
  delivery_tax_subtotal numeric default 0,
  grand_total numeric default 0,

  status text not null default 'Submitted'
    check (status in ('Submitted','Manager Approved','Procurement Approved','Purchased','Received')),

  manager_approved_at timestamptz,
  procurement_approved_at timestamptz,
  purchased_at timestamptz,
  received_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- Line items table ----------
create table if not exists requisition_items (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid references requisitions(id) on delete cascade,
  sn int,
  name text,
  description text,
  qty numeric default 0,
  unit_price numeric default 0,
  delivery_tax numeric default 0,
  link text,
  total numeric default 0,
  received boolean default false,
  received_at timestamptz
);

create index if not exists idx_items_requisition on requisition_items(requisition_id);

-- ---------- Auto-generate tracking numbers like REQ-00001 ----------
create or replace function set_tracking_no()
returns trigger as $$
begin
  if new.tracking_no is null then
    new.tracking_no := 'REQ-' || lpad(nextval('requisition_seq')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_tracking_no on requisitions;
create trigger trg_set_tracking_no
before insert on requisitions
for each row execute function set_tracking_no();

-- ---------- Keep updated_at current ----------
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_updated_at on requisitions;
create trigger trg_touch_updated_at
before update on requisitions
for each row execute function touch_updated_at();

-- ============================================================
-- Row Level Security
-- You chose "anyone with the dashboard link" access, so these
-- policies allow the public anon key to read/insert/update.
-- There is no per-user login — treat the link itself as the
-- access control (don't publish it outside your team).
-- ============================================================
alter table requisitions enable row level security;
alter table requisition_items enable row level security;

drop policy if exists "public read requisitions" on requisitions;
create policy "public read requisitions" on requisitions for select using (true);

drop policy if exists "public insert requisitions" on requisitions;
create policy "public insert requisitions" on requisitions for insert with check (true);

drop policy if exists "public update requisitions" on requisitions;
create policy "public update requisitions" on requisitions for update using (true);

drop policy if exists "public read items" on requisition_items;
create policy "public read items" on requisition_items for select using (true);

drop policy if exists "public insert items" on requisition_items;
create policy "public insert items" on requisition_items for insert with check (true);

drop policy if exists "public update items" on requisition_items;
create policy "public update items" on requisition_items for update using (true);

drop policy if exists "public delete items" on requisition_items;
create policy "public delete items" on requisition_items for delete using (true);
