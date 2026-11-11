-- =====================================================================
-- 01_schema.sql
-- The whole database structure for Gidan Kofi: sequences, tables (with their columns,
-- constraints and indexes) and the Realtime settings. No data and no security here.
--
-- Run this FIRST, in the Supabase SQL Editor of an empty project, then 02 to 06 in order.
-- It is safe to run again: everything is created only if it is not there yet.
--
-- Conventions: snake_case names, uuid primary keys, created_at on most tables, money as
-- numeric(10,2) (AED), text columns with CHECK constraints for the fixed lists (roles,
-- statuses...) so a bad value can never get in.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------

-- pgcrypto: bcrypt hashing of the staff PINs (crypt / gen_salt)
create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------------
-- Sequences
-- Permanent codes: MENU-0001... for menu items, STK-0001... for stock items (never reused).
-- ---------------------------------------------------------------------

create sequence if not exists public.menu_code_seq;
create sequence if not exists public.stock_code_seq;


-- ---------------------------------------------------------------------
-- staff: everyone who works at the café. Managers also sign in to the
-- admin panel with Supabase Auth, matched by email.
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  id                      uuid default gen_random_uuid() not null,
  name                    text not null,
  role                    text not null,
  email                   text,
  pin_hash                text,
  permissions             text[] default '{}'::text[] not null,
  status                  text default 'active'::text not null,
  since                   date default current_date not null,
  last_active_at          timestamp with time zone,
  created_at              timestamp with time zone default now() not null,
  is_demo_protected       boolean default false not null,
  is_demo_login           boolean default false not null,
  added_in_demo           boolean default false not null,
  constraint staff_email_check check (email = lower(email)),
  constraint staff_email_managers_only check (role = 'manager' or email is null),
  constraint staff_manager_has_email check (role <> 'manager' or email is not null),
  constraint staff_pkey primary key (id),
  constraint staff_permissions_valid check (permissions <@ array['take_orders', 'reprint', 'apply_codes', 'manual_discounts', 'refunds', 'close_day', 'log_batches', 'update_stock_counts', 'edit_menu_prices', 'view_reports', 'manage_staff']),
  constraint staff_role_check check (role = any (array['manager', 'barista', 'pastry_chef', 'cleaner'])),
  constraint staff_status_check check (status = any (array['active', 'inactive']))
);

create unique index if not exists staff_email_key on public.staff (email);
create index if not exists staff_role_status_idx on public.staff (role, status);


-- ---------------------------------------------------------------------
-- counters: the POS devices (Counter 1, Counter 2...)
-- ---------------------------------------------------------------------
create table if not exists public.counters (
  id                      uuid default gen_random_uuid() not null,
  number                  integer not null,
  name                    text not null,
  device_name             text,
  printer                 text,
  status                  text default 'offline'::text not null,
  last_synced_at          timestamp with time zone,
  pairing_code            text,
  created_at              timestamp with time zone default now() not null,
  constraint counters_pkey primary key (id),
  constraint counters_number_key unique (number),
  constraint counters_number_check check (number > 0),
  constraint counters_status_check check (status = any (array['online', 'offline']))
);



-- ---------------------------------------------------------------------
-- categories: the groups on the menu (Drinks, Pastries & sweets, Grab & go)
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id                      uuid default gen_random_uuid() not null,
  name                    text not null,
  colour                  text not null,
  sort_order              integer default 0 not null,
  created_at              timestamp with time zone default now() not null,
  constraint categories_colour_check check (colour ~* '^#[0-9a-f]{6}$'),
  constraint categories_name_key unique (name),
  constraint categories_pkey primary key (id)
);



-- ---------------------------------------------------------------------
-- menu_items: one row per item on the menu. tracking says how it is counted: none, made_daily or stock.
-- ---------------------------------------------------------------------
create table if not exists public.menu_items (
  id                      uuid default gen_random_uuid() not null,
  code                    text default ('MENU-'::text || lpad((nextval('menu_code_seq'::regclass))::text, 4, '0'::text)) not null,
  category_id             uuid not null,
  name                    text not null,
  description             text,
  allergens               text[] default '{}'::text[] not null,
  image_url               text,
  on_menu                 boolean default true not null,
  served                  text,
  cold_extra              numeric(10,2) default 0 not null,
  sort_order              integer default 0 not null,
  created_at              timestamp with time zone default now() not null,
  image_original_url      text,
  image_crop              jsonb,
  tracking                text default 'none'::text not null,
  constraint menu_items_category_id_fkey foreign key (category_id) references categories(id) on delete restrict,
  constraint menu_items_code_key unique (code),
  constraint menu_items_cold_extra_check check (cold_extra >= 0::numeric),
  constraint menu_items_pkey primary key (id),
  constraint menu_items_served_check check (served = any (array['hot', 'cold', 'both'])),
  constraint menu_items_tracking_check check (tracking = any (array['none', 'stock', 'made_daily']))
);

create index if not exists menu_items_category_idx on public.menu_items (category_id, sort_order);


-- ---------------------------------------------------------------------
-- stock_items: what is counted in the Stock view (ingredients, frozen bakery, packaging, retail)
-- ---------------------------------------------------------------------
create table if not exists public.stock_items (
  id                      uuid default gen_random_uuid() not null,
  code                    text default ('STK-'::text || lpad((nextval('stock_code_seq'::regclass))::text, 4, '0'::text)) not null,
  name                    text not null,
  type                    text not null,
  unit                    text not null,
  pack_type               text default 'single'::text not null,
  pack_size               numeric(10,2),
  pack_unit               text,
  quantity                numeric(10,2) default 0 not null,
  low_at                  numeric(10,2) default 0 not null,
  cost                    numeric(10,2),
  supplier                text,
  sku                     text,
  created_at              timestamp with time zone default now() not null,
  constraint stock_items_code_key unique (code),
  constraint stock_items_cost_check check (cost >= 0::numeric),
  constraint stock_items_low_at_check check (low_at >= 0::numeric),
  constraint stock_items_pkey primary key (id),
  constraint stock_items_pack_size_check check (pack_type = 'single' or COALESCE(pack_size, 0::numeric) > 0::numeric),
  constraint stock_items_pack_type_check check (pack_type = any (array['single', 'bag', 'box', 'pack', 'sleeve', 'carton', 'bottle', 'tin', 'tub', 'case', 'tray', 'jar'])),
  constraint stock_items_pack_unit_check check (pack_unit is null or (pack_unit = any (array['pcs', 'l', 'ml', 'kg', 'g', 'bottles', 'tins', 'tubs', 'bags', 'slices']))),
  constraint stock_items_quantity_check check (quantity >= 0::numeric),
  constraint stock_items_type_check check (type = any (array['ingredient', 'frozen_bakery', 'packaging', 'retail'])),
  constraint stock_items_unit_check check (unit = any (array['pcs', 'l', 'ml', 'kg', 'g', 'bottles', 'tins', 'tubs', 'bags', 'slices']))
);

create unique index if not exists stock_items_sku_key on public.stock_items (sku) WHERE (sku IS NOT NULL);
create index if not exists stock_items_type_idx on public.stock_items (type);


-- ---------------------------------------------------------------------
-- One row per size. The "from AED" price on a menu card is the lowest price
-- here, so it is not stored on the item itself.
-- ---------------------------------------------------------------------
create table if not exists public.item_sizes (
  id                      uuid default gen_random_uuid() not null,
  menu_item_id            uuid not null,
  label                   text not null,
  price                   numeric(10,2) not null,
  sort_order              integer default 0 not null,
  created_at              timestamp with time zone default now() not null,
  stock_item_id           uuid,
  constraint item_sizes_pkey primary key (id),
  constraint item_sizes_menu_item_id_label_key unique (menu_item_id, label),
  constraint item_sizes_stock_item_id_key unique (stock_item_id),
  constraint item_sizes_price_check check (price >= 0::numeric),
  constraint item_sizes_menu_item_id_fkey foreign key (menu_item_id) references menu_items(id) on delete cascade,
  constraint item_sizes_stock_item_id_fkey foreign key (stock_item_id) references stock_items(id) on delete set null
);

create index if not exists item_sizes_item_idx on public.item_sizes (menu_item_id);


-- ---------------------------------------------------------------------
-- discounts: codes baristas scan or type on the POS
-- ---------------------------------------------------------------------
create table if not exists public.discounts (
  id                      uuid default gen_random_uuid() not null,
  code                    text not null,
  description             text,
  type                    text not null,
  value                   numeric(10,2) not null,
  applies_to              text default 'order'::text not null,
  category_ids            uuid[] default '{}'::uuid[] not null,
  min_order               numeric(10,2),
  valid_from              date default current_date not null,
  valid_until             date,
  usage_limit             integer,
  used_count              integer default 0 not null,
  active                  boolean default true not null,
  created_at              timestamp with time zone default now() not null,
  constraint discounts_applies_to_check check (applies_to = any (array['order', 'categories'])),
  constraint discounts_code_key unique (code),
  constraint discounts_code_check check (code = upper(code) and code ~ '^[A-Z0-9]{3,20}$'),
  constraint discounts_dates_ordered check (valid_until is null or valid_until >= valid_from),
  constraint discounts_pkey primary key (id),
  constraint discounts_min_order_check check (min_order >= 0::numeric),
  constraint discounts_percent_max check (type <> 'percent' or value <= 100::numeric),
  constraint discounts_type_check check (type = any (array['percent', 'fixed'])),
  constraint discounts_usage_limit_check check (usage_limit > 0),
  constraint discounts_used_count_check check (used_count >= 0),
  constraint discounts_value_check check (value > 0::numeric)
);

create index if not exists discounts_active_idx on public.discounts (active);


-- ---------------------------------------------------------------------
-- orders and order_items: every sale. Totals are saved as they were at the time of the sale.
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id                      uuid default gen_random_uuid() not null,
  counter_id              uuid not null,
  order_number            integer not null,
  order_date              date default ((now() at time zone 'Asia/Dubai') - interval '4 hours')::date not null,
  receipt_number          text not null,
  staff_id                uuid,
  type                    text not null,
  subtotal                numeric(10,2) not null,
  discount_id             uuid,
  discount_amount         numeric(10,2) default 0 not null,
  vat_amount              numeric(10,2) default 0 not null,
  total                   numeric(10,2) not null,
  payment_method          text not null,
  status                  text default 'paid'::text not null,
  created_at              timestamp with time zone default now() not null,
  discount_kind           text,
  discount_type           text,
  discount_value          numeric(10,2),
  discount_label          text,
  manual_discount_reason  text,
  discount_approved_by    uuid,
  cash_amount             numeric(10,2) default 0 not null,
  card_amount             numeric(10,2) default 0 not null,
  cash_received           numeric(10,2),
  change_given            numeric(10,2),
  refunded_at             timestamp with time zone,
  refunded_by             uuid,
  refund_reason           text,
  constraint orders_card_amount_check check (card_amount >= 0::numeric),
  constraint orders_pkey primary key (id),
  constraint orders_receipt_number_key unique (receipt_number),
  constraint orders_cash_amount_check check (cash_amount >= 0::numeric),
  constraint orders_counter_day_number_key unique (counter_id, order_date, order_number),
  constraint orders_cash_received_check check (cash_received >= 0::numeric),
  constraint orders_change_given_check check (change_given >= 0::numeric),
  constraint orders_discount_kind_check check (discount_kind = any (array['code', 'manual'])),
  constraint orders_discount_value_check check (discount_value >= 0::numeric),
  constraint orders_order_number_check check (order_number > 0),
  constraint orders_payment_method_check check (payment_method = any (array['cash', 'card', 'split'])),
  constraint orders_counter_id_fkey foreign key (counter_id) references counters(id) on delete restrict,
  constraint orders_discount_amount_check check (discount_amount >= 0::numeric),
  constraint orders_discount_type_check check (discount_type = any (array['percent', 'fixed'])),
  constraint orders_discount_approved_by_fkey foreign key (discount_approved_by) references staff(id) on delete set null,
  constraint orders_discount_id_fkey foreign key (discount_id) references discounts(id) on delete set null,
  constraint orders_status_check check (status = any (array['paid', 'refunded'])),
  constraint orders_subtotal_check check (subtotal >= 0::numeric),
  constraint orders_total_check check (total >= 0::numeric),
  constraint orders_type_check check (type = any (array['dine_in', 'takeaway'])),
  constraint orders_refunded_by_fkey foreign key (refunded_by) references staff(id) on delete set null,
  constraint orders_staff_id_fkey foreign key (staff_id) references staff(id) on delete set null,
  constraint orders_vat_amount_check check (vat_amount >= 0::numeric)
);

create index if not exists orders_created_at_idx on public.orders (created_at DESC);
create index if not exists orders_discount_approved_by_idx on public.orders (discount_approved_by);
create index if not exists orders_discount_idx on public.orders (discount_id);
create index if not exists orders_order_date_idx on public.orders (order_date);
create index if not exists orders_refunded_by_idx on public.orders (refunded_by);
create index if not exists orders_staff_idx on public.orders (staff_id);


-- ---------------------------------------------------------------------
-- name and size_label are copied from the menu at the time of sale, so old
-- receipts stay correct even if the menu changes later.
-- ---------------------------------------------------------------------
create table if not exists public.order_items (
  id                      uuid default gen_random_uuid() not null,
  order_id                uuid not null,
  menu_item_id            uuid,
  name                    text not null,
  size_label              text,
  options                 jsonb default '{}'::jsonb not null,
  quantity                integer not null,
  unit_price              numeric(10,2) not null,
  line_total              numeric(10,2) not null,
  created_at              timestamp with time zone default now() not null,
  constraint order_items_line_total_check check (line_total >= 0::numeric),
  constraint order_items_menu_item_id_fkey foreign key (menu_item_id) references menu_items(id) on delete set null,
  constraint order_items_order_id_fkey foreign key (order_id) references orders(id) on delete cascade,
  constraint order_items_pkey primary key (id),
  constraint order_items_quantity_check check (quantity > 0),
  constraint order_items_unit_price_check check (unit_price >= 0::numeric)
);

create index if not exists order_items_menu_item_idx on public.order_items (menu_item_id);
create index if not exists order_items_order_idx on public.order_items (order_id);


-- ---------------------------------------------------------------------
-- settings: ONE row. Each jsonb column matches a slice of src/admin/data/settings.js.
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id                      boolean default true not null,
  details                 jsonb default '{}'::jsonb not null,
  opening_hours           jsonb default '{}'::jsonb not null,
  tax                     jsonb default '{}'::jsonb not null,
  receipts                jsonb default '{}'::jsonb not null,
  payments                jsonb default '{}'::jsonb not null,
  discount_rules          jsonb default '{}'::jsonb not null,
  updated_at              timestamp with time zone default now() not null,
  constraint settings_id_check check (id),
  constraint settings_pkey primary key (id)
);



-- ---------------------------------------------------------------------
-- special_days: one-off dates (holidays, early closing) that override the weekly hours
-- ---------------------------------------------------------------------
create table if not exists public.special_days (
  id                      uuid default gen_random_uuid() not null,
  date                    date not null,
  closed                  boolean default true not null,
  opens_at                time without time zone,
  closes_at               time without time zone,
  note                    text,
  created_at              timestamp with time zone default now() not null,
  constraint special_days_date_key unique (date),
  constraint special_days_hours_when_open check (closed or opens_at is not null and closes_at is not null and closes_at > opens_at),
  constraint special_days_pkey primary key (id)
);



-- ---------------------------------------------------------------------
-- stock_bought_as_backup: a leftover record from an old stock pack conversion. Nothing in the app reads it.
-- It is safe to drop: drop table stock_bought_as_backup;
-- ---------------------------------------------------------------------
create table if not exists public.stock_bought_as_backup (
  id                      uuid default gen_random_uuid() not null,
  stock_item_id           uuid,
  name                    text not null,
  old_text                text not null,
  converted               boolean not null,
  note                    text,
  created_at              timestamp with time zone default now() not null,
  constraint stock_bought_as_backup_pkey primary key (id),
  constraint stock_bought_as_backup_stock_item_id_fkey foreign key (stock_item_id) references stock_items(id) on delete cascade
);



-- ---------------------------------------------------------------------
-- modifier_groups: a group of customisation choices on the POS (Milk, Espresso shots, Warmed...)
-- ---------------------------------------------------------------------
create table if not exists public.modifier_groups (
  id                      uuid default gen_random_uuid() not null,
  name                    text not null,
  selection               text not null,
  required                boolean default false not null,
  sort_order              integer default 0 not null,
  counter_min             integer,
  counter_max             integer,
  counter_price           numeric(10,2),
  counter_default         integer,
  created_at              timestamp with time zone default now() not null,
  constraint modifier_groups_check check (counter_max >= counter_min),
  constraint modifier_groups_counter_default_check check (counter_default >= 0),
  constraint modifier_groups_counter_min_check check (counter_min >= 0),
  constraint modifier_groups_counter_price_check check (counter_price >= 0::numeric),
  constraint modifier_groups_name_key unique (name),
  constraint modifier_groups_pkey primary key (id),
  constraint modifier_groups_selection_check check (selection = any (array['single', 'multiple', 'counter']))
);



-- ---------------------------------------------------------------------
-- modifiers: the choices inside a group (Oat, Almond, Soy...)
-- ---------------------------------------------------------------------
create table if not exists public.modifiers (
  id                      uuid default gen_random_uuid() not null,
  group_id                uuid not null,
  name                    text not null,
  extra_price             numeric(10,2) default 0 not null,
  is_default              boolean default false not null,
  available               boolean default true not null,
  sort_order              integer default 0 not null,
  constraint modifiers_extra_price_check check (extra_price >= 0::numeric),
  constraint modifiers_pkey primary key (id),
  constraint modifiers_group_id_name_key unique (group_id, name),
  constraint modifiers_group_id_fkey foreign key (group_id) references modifier_groups(id) on delete cascade
);

create index if not exists modifiers_group_idx on public.modifiers (group_id);


-- ---------------------------------------------------------------------
-- a group is attached to ONE menu item or to a whole category. default_count is the starting number
-- of a counter group for that item (2 shots for a flat white, 1 for an iced latte).
-- ---------------------------------------------------------------------
create table if not exists public.modifier_group_links (
  id                      uuid default gen_random_uuid() not null,
  group_id                uuid not null,
  menu_item_id            uuid,
  category_id             uuid,
  default_count           integer,
  constraint modifier_group_links_default_count_check check (default_count >= 0),
  constraint modifier_group_links_category_id_fkey foreign key (category_id) references categories(id) on delete cascade,
  constraint modifier_group_links_group_id_fkey foreign key (group_id) references modifier_groups(id) on delete cascade,
  constraint modifier_group_links_pkey primary key (id),
  constraint modifier_group_links_one_target check ((menu_item_id is null) <> (category_id is null)),
  constraint modifier_group_links_menu_item_id_fkey foreign key (menu_item_id) references menu_items(id) on delete cascade
);

create unique index if not exists modifier_group_links_category_key on public.modifier_group_links (group_id, category_id) WHERE (category_id IS NOT NULL);
create unique index if not exists modifier_group_links_item_key on public.modifier_group_links (group_id, menu_item_id) WHERE (menu_item_id IS NOT NULL);


-- ---------------------------------------------------------------------
-- daily_counts: today's numbers for "Made daily" items (made, sold, wasted, carried in and over)
-- ---------------------------------------------------------------------
create table if not exists public.daily_counts (
  id                      uuid default gen_random_uuid() not null,
  size_id                 uuid not null,
  day                     date not null,
  made                    integer default 0 not null,
  sold                    integer default 0 not null,
  leftover                integer,
  created_at              timestamp with time zone default now() not null,
  wasted                  integer default 0 not null,
  carried_in              integer default 0 not null,
  carried_over            integer default 0 not null,
  leftovers_saved_at      timestamp with time zone,
  leftovers_by            uuid,
  constraint daily_counts_carried_in_check check (carried_in >= 0),
  constraint daily_counts_carried_over_check check (carried_over >= 0),
  constraint daily_counts_pkey primary key (id),
  constraint daily_counts_size_id_day_key unique (size_id, day),
  constraint daily_counts_leftover_check check (leftover >= 0),
  constraint daily_counts_made_check check (made >= 0),
  constraint daily_counts_sold_check check (sold >= 0),
  constraint daily_counts_leftovers_by_fkey foreign key (leftovers_by) references staff(id) on delete set null,
  constraint daily_counts_size_id_fkey foreign key (size_id) references item_sizes(id) on delete cascade,
  constraint daily_counts_wasted_check check (wasted >= 0)
);

create index if not exists daily_counts_leftovers_by_idx on public.daily_counts (leftovers_by);


-- ---------------------------------------------------------------------
-- day_closings: one row each time a counter closes the day (cash expected, counted and the difference)
-- ---------------------------------------------------------------------
create table if not exists public.day_closings (
  id                      uuid default gen_random_uuid() not null,
  counter_id              uuid not null,
  closing_date            date not null,
  starting_cash           numeric(10,2) not null,
  cash_sales              numeric(10,2) not null,
  cash_refunds            numeric(10,2) not null,
  expected                numeric(10,2) not null,
  counted                 numeric(10,2) not null,
  difference              numeric(10,2) not null,
  closed_at               timestamp with time zone default now() not null,
  closed_by               uuid,
  reopened_at             timestamp with time zone,
  reopened_by             uuid,
  constraint day_closings_cash_refunds_check check (cash_refunds >= 0::numeric),
  constraint day_closings_cash_sales_check check (cash_sales >= 0::numeric),
  constraint day_closings_closed_by_fkey foreign key (closed_by) references staff(id) on delete set null,
  constraint day_closings_counted_check check (counted >= 0::numeric),
  constraint day_closings_counter_id_fkey foreign key (counter_id) references counters(id) on delete restrict,
  constraint day_closings_pkey primary key (id),
  constraint day_closings_starting_cash_check check (starting_cash >= 0::numeric),
  constraint day_closings_reopened_by_fkey foreign key (reopened_by) references staff(id) on delete set null
);

create index if not exists day_closings_closed_by_idx on public.day_closings (closed_by);
create unique index if not exists day_closings_open_day_key on public.day_closings (counter_id, closing_date) WHERE (reopened_at IS NULL);
create index if not exists day_closings_reopened_by_idx on public.day_closings (reopened_by);


-- ---------------------------------------------------------------------
-- shifts: who is signed in on which device. A shift carries the hashed session token and when it expires.
-- ---------------------------------------------------------------------
create table if not exists public.shifts (
  id                      uuid default gen_random_uuid() not null,
  staff_id                uuid not null,
  counter_id              uuid,
  started_at              timestamp with time zone default now() not null,
  ended_at                timestamp with time zone,
  device                  text default 'counter'::text not null,
  token_hash              text,
  expires_at              timestamp with time zone,
  constraint shifts_device_check check (device = any (array['counter', 'kitchen'])),
  constraint shifts_counter_id_fkey foreign key (counter_id) references counters(id) on delete restrict,
  constraint shifts_pkey primary key (id),
  constraint shifts_staff_id_fkey foreign key (staff_id) references staff(id) on delete cascade
);

create index if not exists shifts_counter_idx on public.shifts (counter_id);
create index if not exists shifts_open_idx on public.shifts (counter_id) WHERE (ended_at IS NULL);
create index if not exists shifts_staff_idx on public.shifts (staff_id);
create unique index if not exists shifts_token_hash_key on public.shifts (token_hash) WHERE (token_hash IS NOT NULL);


-- ---------------------------------------------------------------------
-- kitchen_batches: a log of every batch the kitchen made
-- ---------------------------------------------------------------------
create table if not exists public.kitchen_batches (
  id                      uuid default gen_random_uuid() not null,
  size_id                 uuid not null,
  quantity                integer not null,
  staff_id                uuid,
  stock_item_id           uuid,
  created_at              timestamp with time zone default now() not null,
  constraint kitchen_batches_pkey primary key (id),
  constraint kitchen_batches_quantity_check check (quantity > 0),
  constraint kitchen_batches_size_id_fkey foreign key (size_id) references item_sizes(id) on delete cascade,
  constraint kitchen_batches_staff_id_fkey foreign key (staff_id) references staff(id) on delete set null,
  constraint kitchen_batches_stock_item_id_fkey foreign key (stock_item_id) references stock_items(id) on delete set null
);

create index if not exists kitchen_batches_size_idx on public.kitchen_batches (size_id, created_at DESC);
create index if not exists kitchen_batches_staff_idx on public.kitchen_batches (staff_id);
create index if not exists kitchen_batches_stock_idx on public.kitchen_batches (stock_item_id);


-- ---------------------------------------------------------------------
-- one-time manager approvals (only the hash of the token is stored)
-- ---------------------------------------------------------------------
create table if not exists public.approvals (
  id                      uuid default gen_random_uuid() not null,
  token_hash              text not null,
  staff_id                uuid not null,
  shift_id                uuid not null,
  purpose                 text not null,
  expires_at              timestamp with time zone not null,
  used_at                 timestamp with time zone,
  created_at              timestamp with time zone default now() not null,
  constraint approvals_pkey primary key (id),
  constraint approvals_purpose_check check (purpose = any (array['refund', 'manual_discount', 'reopen_day'])),
  constraint approvals_shift_id_fkey foreign key (shift_id) references shifts(id) on delete cascade,
  constraint approvals_staff_id_fkey foreign key (staff_id) references staff(id) on delete cascade,
  constraint approvals_token_hash_key unique (token_hash)
);

create index if not exists approvals_shift_idx on public.approvals (shift_id, created_at);


-- ---------------------------------------------------------------------
-- failed PIN attempts: per device (a counter's id, or "kitchen") for sign-in, per shift for manager PINs
-- ---------------------------------------------------------------------
create table if not exists public.pin_attempts (
  scope                   text not null,
  key                     text not null,
  failed_count            integer default 0 not null,
  locked_until            timestamp with time zone,
  updated_at              timestamp with time zone default now() not null,
  constraint pin_attempts_pkey primary key (scope, key),
  constraint pin_attempts_scope_check check (scope = any (array['device', 'shift']))
);



-- ---------------------------------------------------------------------
-- invalid voucher codes tried on a shift
-- ---------------------------------------------------------------------
create table if not exists public.code_attempts (
  id                      bigint generated always as identity not null,
  shift_id                uuid not null,
  created_at              timestamp with time zone default now() not null,
  constraint code_attempts_pkey primary key (id),
  constraint code_attempts_shift_id_fkey foreign key (shift_id) references shifts(id) on delete cascade
);

create index if not exists code_attempts_shift_idx on public.code_attempts (shift_id, created_at);


-- ---------------------------------------------------------------------
-- Realtime
-- The apps "listen" for changes to these tables, so a price change or a new item shows up on the POS at once.
-- ---------------------------------------------------------------------
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['daily_counts', 'item_sizes', 'menu_items', 'modifier_group_links', 'modifier_groups', 'modifiers', 'stock_items']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
