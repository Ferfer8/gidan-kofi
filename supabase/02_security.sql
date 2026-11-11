-- =====================================================================
-- 02_security.sql
-- Locks the database down with Row Level Security (RLS), and says who may do what.
--
-- Run this SECOND (after 01_schema.sql). Safe to run again.
--
-- The rules:
--   * Nobody who is not signed in can read or write any table. The POS devices are not
--     signed in: they only use the functions in 03_functions.sql (most of which also need a
--     valid session token).
--   * A signed-in MANAGER (email matches an active staff row with role "manager")
--     can read and write everything.
--   * Staff PIN hashes can never be read by the admin panel, only checked by functions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- is_manager()
-- True when the signed-in user is an active manager. SECURITY DEFINER so it can look at the staff table even though that table is protected by RLS itself.
-- Defined here (not in 03) because the policies below use it.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- is_manager(): true when the signed-in user is an active manager.
-- SECURITY DEFINER so it can look at the staff table even though that
-- table is protected by RLS itself.
-- ---------------------------------------------------------------------
create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.staff
    where role = 'manager'
      and status = 'active'
      and email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_manager() from public, anon, authenticated;
grant execute on function public.is_manager() to authenticated;


-- ---------------------------------------------------------------------
-- Row Level Security
-- On for every table. With no policy, a role sees nothing.
-- ---------------------------------------------------------------------

alter table public.staff enable row level security;
alter table public.counters enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.stock_items enable row level security;
alter table public.item_sizes enable row level security;
alter table public.discounts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.settings enable row level security;
alter table public.special_days enable row level security;
alter table public.stock_bought_as_backup enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifiers enable row level security;
alter table public.modifier_group_links enable row level security;
alter table public.daily_counts enable row level security;
alter table public.day_closings enable row level security;
alter table public.shifts enable row level security;
alter table public.kitchen_batches enable row level security;
alter table public.approvals enable row level security;
alter table public.pin_attempts enable row level security;
alter table public.code_attempts enable row level security;


-- ---------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------

drop policy if exists "Managers can do everything" on public.categories;
create policy "Managers can do everything" on public.categories
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.counters;
create policy "Managers can do everything" on public.counters
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.daily_counts;
create policy "Managers can do everything" on public.daily_counts
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.day_closings;
create policy "Managers can do everything" on public.day_closings
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.discounts;
create policy "Managers can do everything" on public.discounts
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.item_sizes;
create policy "Managers can do everything" on public.item_sizes
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.kitchen_batches;
create policy "Managers can do everything" on public.kitchen_batches
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.menu_items;
create policy "Managers can do everything" on public.menu_items
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.modifier_group_links;
create policy "Managers can do everything" on public.modifier_group_links
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.modifier_groups;
create policy "Managers can do everything" on public.modifier_groups
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.modifiers;
create policy "Managers can do everything" on public.modifiers
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.order_items;
create policy "Managers can do everything" on public.order_items
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.orders;
create policy "Managers can do everything" on public.orders
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.settings;
create policy "Managers can do everything" on public.settings
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.shifts;
create policy "Managers can do everything" on public.shifts
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.special_days;
create policy "Managers can do everything" on public.special_days
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.staff;
create policy "Managers can do everything" on public.staff
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.stock_bought_as_backup;
create policy "Managers can do everything" on public.stock_bought_as_backup
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());

drop policy if exists "Managers can do everything" on public.stock_items;
create policy "Managers can do everything" on public.stock_items
  for all
  to authenticated
  using (is_manager())
  with check (is_manager());


-- ---------------------------------------------------------------------
-- Table rights
-- Signed-in users (role "authenticated") get the four basic rights; RLS above then limits them to managers.
-- Not-signed-in users (role "anon") get nothing at all.
-- approvals, pin_attempts and code_attempts (session approvals and guess counters) are for the functions only: nobody gets them directly.
-- ---------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant delete, insert, select, update on public.categories,
  public.counters,
  public.daily_counts,
  public.day_closings,
  public.discounts,
  public.item_sizes,
  public.kitchen_batches,
  public.menu_items,
  public.modifier_group_links,
  public.modifier_groups,
  public.modifiers,
  public.order_items,
  public.orders,
  public.settings,
  public.shifts,
  public.special_days,
  public.stock_bought_as_backup,
  public.stock_items
  to authenticated;

grant delete on public.staff
  to authenticated;

-- Managers can read these staff columns. The PIN hash is never sent to the admin panel and e-mails are read through admin_list_staff().
grant select (created_at, id, last_active_at, name, permissions, role, since, status)
  on public.staff to authenticated;

-- Managers can add staff with these columns (PINs and the demo flags are not set from the admin panel).
grant insert (email, name, permissions, role, since, status)
  on public.staff to authenticated;

-- Managers can change these staff columns (PINs only through reset_staff_pin / set_staff_pin).
grant update (email, last_active_at, name, permissions, role, since, status)
  on public.staff to authenticated;

-- the permanent-code sequences (so a manager can add a menu or stock item)
grant usage, select on sequence public.menu_code_seq, public.stock_code_seq to authenticated;

