-- =====================================================================
-- 07_security_tightening.sql
-- Makes the DATABASE enforce the POS rules, instead of trusting what the app sends.
--
-- Run this on a database that was set up with the earlier versions of 01 to 06. It is safe
-- to run more than once. (A new setup does not need it: 01_schema.sql, 02_security.sql and
-- 03_functions.sql already contain everything in this file.)
--
-- What changes:
--   1. SESSION TOKENS. Signing in with a PIN starts a shift and returns a secret random
--      token. Only a hash of it is stored (on the shift). Every POS function takes that token
--      as its first argument and finds out who is asking, and on which counter, from the
--      token (require_session), never from ids the app sends. A shift ends at the end of the
--      business day, or after 16 hours, or when the person signs out.
--   2. ONE-TIME APPROVALS. A manager PIN (refund, manual discount, reopening the day) gives a
--      one-time approval token that lasts 2 minutes. refund_order, reopen_day and complete_order
--      (with a manual discount) need it, use it up, and save the approving manager from it.
--   3. PIN GUESSING LIMITS in the database: 5 wrong PINs lock that device's PIN entry for 5
--      minutes (a manager PIN: per shift); 10 invalid voucher codes in 10 minutes pause code
--      checks on that shift for 5 minutes.
--   4. WHO CAN CALL WHAT. Not-signed-in callers (role anon) can only call get_pos_menu, ping,
--      get_pos_counters, sign_in_with_pin, and the POS functions below, which refuse to do
--      anything without a valid session token. Everything else is closed to them, and they
--      can no longer read any table directly.
--
-- The app sends the token with every call (src/pos/lib/). A call with a missing, wrong, ended
-- or expired token fails with the error code PT401 ("Your session has ended...").
-- Other error codes: PT402 (approval missing, used or expired), PT403 (no permission).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tables and columns
-- ---------------------------------------------------------------------

-- the shift carries the (hashed) session token and when it stops working
alter table public.shifts add column if not exists token_hash text;
alter table public.shifts add column if not exists expires_at timestamptz;
create unique index if not exists shifts_token_hash_key on public.shifts (token_hash) where token_hash is not null;

-- shifts that were open before this file have no token and could not be used any more
update public.shifts set ended_at = now() where ended_at is null and token_hash is null;

-- one-time manager approvals (only the hash of the token is stored)
create table if not exists public.approvals (
  id         uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  staff_id   uuid not null references public.staff (id) on delete cascade,    -- the approving manager
  shift_id   uuid not null references public.shifts (id) on delete cascade,   -- the shift that asked
  purpose    text not null check (purpose in ('refund', 'manual_discount', 'reopen_day')),
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists approvals_shift_idx on public.approvals (shift_id, created_at);

-- failed PIN attempts: per device (a counter's id, or "kitchen") for sign-in, per shift for manager PINs
create table if not exists public.pin_attempts (
  scope        text not null check (scope in ('device', 'shift')),
  key          text not null,
  failed_count integer not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (scope, key)
);

-- invalid voucher codes tried on a shift
create table if not exists public.code_attempts (
  id         bigint generated always as identity primary key,
  shift_id   uuid not null references public.shifts (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists code_attempts_shift_idx on public.code_attempts (shift_id, created_at);

alter table public.approvals enable row level security;
alter table public.pin_attempts enable row level security;
alter table public.code_attempts enable row level security;
revoke all on public.approvals, public.pin_attempts, public.code_attempts from anon, authenticated;

-- (the old global PIN counter is replaced by pin_attempts; the old functions that used it are dropped below)


-- ---------------------------------------------------------------------
-- 2. The old versions of the POS functions (they trusted the ids the app sent)
-- ---------------------------------------------------------------------
drop function if exists public.verify_refund_pin(text);
drop function if exists public.verify_reopen_pin(text);
drop function if exists public.verify_manager_pin(text);
drop function if exists public.start_shift(uuid, uuid, text);
drop function if exists public.end_shift(uuid);
drop function if exists public.counter_heartbeat(uuid);
drop function if exists public.check_discount_code(text, jsonb);
drop function if exists public.complete_order(jsonb, uuid, uuid);
drop function if exists public.get_pos_orders_today(uuid);
drop function if exists public.refund_order(uuid, uuid, text);
drop function if exists public.get_pos_day_summary(uuid);
drop function if exists public.close_day(numeric, uuid, uuid);
drop function if exists public.reopen_day(uuid, uuid);
drop function if exists public.get_kitchen_today();
drop function if exists public.log_batch(uuid, integer, uuid);
drop function if exists public.save_leftovers(jsonb, uuid);

drop table if exists public.pin_failures;


-- ---------------------------------------------------------------------
-- 3. Helpers (nobody can call these directly; the POS functions use them)
-- ---------------------------------------------------------------------

-- require_session(token, permission, device)
--   Who is asking? Finds the open, unexpired shift for this token and returns the staff member, the
--   counter (null in the kitchen), the device ('counter' or 'kitchen') and the shift. Raises PT401 when
--   the token is missing, wrong, ended or expired (or the person is no longer active), and PT403 when
--   the person lacks the permission or this kind of device is not allowed.
create or replace function public.require_session(p_token text, p_permission text default null, p_device text default null)
returns table (staff_id uuid, staff_name text, role text, permissions text[], counter_id uuid, device text, shift_id uuid)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_row record;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'Your session has ended. Please enter your PIN again.' using errcode = 'PT401';
  end if;

  select sh.id as id, sh.staff_id as staff_id, sh.counter_id as counter_id, sh.device as device,
         st.name as name, st.role as role, st.permissions as permissions
  into v_row
  from public.shifts sh
  join public.staff st on st.id = sh.staff_id
  where sh.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and sh.ended_at is null
    and sh.expires_at > now()
    and st.status = 'active';

  if not found then
    raise exception 'Your session has ended. Please enter your PIN again.' using errcode = 'PT401';
  end if;

  if p_device is not null and v_row.device <> p_device then
    raise exception 'This device can''t do that' using errcode = 'PT403';
  end if;
  if p_permission is not null and not (p_permission = any (v_row.permissions)) then
    raise exception 'You don''t have permission to do that' using errcode = 'PT403';
  end if;

  return query select v_row.staff_id, v_row.name, v_row.role, v_row.permissions, v_row.counter_id, v_row.device, v_row.id;
end;
$$;

revoke all on function public.require_session(text, text, text) from public;

-- use_approval(shift, token, purpose): uses up a one-time approval and returns the approving manager.
-- It must be unused, unexpired, for this purpose, and given to THIS shift. Raises PT402 otherwise.
create or replace function public.use_approval(p_shift_id uuid, p_token text, p_purpose text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff uuid;
begin
  update public.approvals a
  set used_at = now()
  from public.staff st
  where a.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and a.shift_id = p_shift_id
    and a.purpose = p_purpose
    and a.used_at is null
    and a.expires_at > now()
    and st.id = a.staff_id
    and st.status = 'active'
  returning a.staff_id into v_staff;

  if v_staff is null then
    raise exception 'This manager approval is missing, already used or has expired. Ask a manager to approve again.' using errcode = 'PT402';
  end if;
  return v_staff;
end;
$$;

revoke all on function public.use_approval(uuid, text, text) from public;

-- pin_lock_seconds(scope, key): seconds left of a lock (0 = not locked). A lock that has run out starts fresh.
create or replace function public.pin_lock_seconds(p_scope text, p_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz;
begin
  select locked_until into v_until from public.pin_attempts where scope = p_scope and key = p_key;
  if v_until is null then
    return 0;
  end if;
  if v_until > now() then
    return ceil(extract(epoch from v_until - now()))::integer;
  end if;
  update public.pin_attempts set failed_count = 0, locked_until = null, updated_at = now() where scope = p_scope and key = p_key;
  return 0;
end;
$$;

revoke all on function public.pin_lock_seconds(text, text) from public;

-- pin_attempt_failed(scope, key): counts a wrong PIN. The 5th one locks for 5 minutes.
--   Returns { locked, retry_seconds, attempts_left }
create or replace function public.pin_attempt_failed(p_scope text, p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_until timestamptz;
begin
  insert into public.pin_attempts as a (scope, key, failed_count) values (p_scope, p_key, 1)
  on conflict (scope, key) do update set failed_count = a.failed_count + 1, updated_at = now()
  returning a.failed_count into v_count;

  if v_count >= 5 then
    update public.pin_attempts set locked_until = now() + interval '5 minutes' where scope = p_scope and key = p_key
    returning locked_until into v_until;
    return jsonb_build_object('locked', true, 'retry_seconds', ceil(extract(epoch from v_until - now()))::integer, 'attempts_left', 0);
  end if;
  return jsonb_build_object('locked', false, 'retry_seconds', 0, 'attempts_left', 5 - v_count);
end;
$$;

revoke all on function public.pin_attempt_failed(text, text) from public;

-- pin_attempt_ok(scope, key): a right PIN starts the count again
create or replace function public.pin_attempt_ok(p_scope text, p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.pin_attempts where scope = p_scope and key = p_key;
$$;

revoke all on function public.pin_attempt_ok(text, text) from public;

-- check_code_rules(id, code, subtotal, lines): the rules a voucher code must pass. One place for them, used
-- by check_discount_code (what the cashier sees) and by complete_order (which checks again when charging).
--   p_lines = [{ "category_id": "...", "amount": 12.5 }]   Returns { ok: true, discount } or { ok: false, reason, message }
create or replace function public.check_code_rules(p_discount_id uuid, p_code text, p_subtotal numeric, p_lines jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today    date := public.business_today();
  v_discount public.discounts%rowtype;
  v_eligible numeric;
  v_names    text;
begin
  if p_discount_id is not null then
    select * into v_discount from public.discounts where id = p_discount_id;
  else
    select * into v_discount from public.discounts where code = upper(btrim(coalesce(p_code, '')));
  end if;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found', 'message', 'We couldn''t find that voucher');
  end if;
  if v_discount.valid_from > v_today then
    return jsonb_build_object('ok', false, 'reason', 'not_started', 'message', 'This voucher starts on ' || to_char(v_discount.valid_from, 'FMDD Mon YYYY'));
  end if;
  if v_discount.valid_until is not null and v_discount.valid_until < v_today then
    return jsonb_build_object('ok', false, 'reason', 'expired', 'message', 'This voucher has expired');
  end if;
  if not v_discount.active then
    return jsonb_build_object('ok', false, 'reason', 'inactive', 'message', 'This voucher isn''t active');
  end if;
  if v_discount.usage_limit is not null and v_discount.used_count >= v_discount.usage_limit then
    return jsonb_build_object('ok', false, 'reason', 'limit', 'message', 'This voucher has reached its usage limit');
  end if;
  if v_discount.min_order is not null and coalesce(p_subtotal, 0) < v_discount.min_order then
    return jsonb_build_object('ok', false, 'reason', 'min_order',
      'message', 'This voucher needs an order of at least AED ' || to_char(v_discount.min_order, 'FM999999990.00'));
  end if;

  if v_discount.applies_to = 'categories' then
    select coalesce(sum((l ->> 'amount')::numeric), 0) into v_eligible
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l
    where (l ->> 'category_id')::uuid = any (v_discount.category_ids);

    if v_eligible <= 0 then
      select string_agg(c.name, ' and ' order by c.sort_order) into v_names
      from public.categories c where c.id = any (v_discount.category_ids);
      return jsonb_build_object('ok', false, 'reason', 'no_eligible_items',
        'message', 'This voucher only applies to ' || coalesce(v_names, 'some categories') || ', and there are none in this order');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'discount', jsonb_build_object(
    'id', v_discount.id,
    'code', v_discount.code,
    'type', v_discount.type,
    'value', v_discount.value,
    'applies_to', v_discount.applies_to,
    'category_ids', to_jsonb(v_discount.category_ids),
    'min_order', v_discount.min_order
  ));
end;
$$;

revoke all on function public.check_code_rules(uuid, text, numeric, jsonb) from public;


-- ---------------------------------------------------------------------
-- 4. Signing in and shifts
-- ---------------------------------------------------------------------

-- sign_in_with_pin(pin, counter, device): the only way to get a session token.
--   Returns { ok: true, staff_id, name, role, can_kitchen, token, shift_id, started_at, expires_at }
--   or      { ok: false, reason: 'wrong' | 'locked' | 'no_access', retry_seconds, attempts_left }
--   5 wrong PINs lock this device's PIN entry for 5 minutes (retry_seconds says how long is left).
--   On the counter the person needs "Take orders and payments", in the kitchen "Log kitchen batches".
--   Signing in starts the shift (a shift already open for this person on this device carries on, with a new
--   token) and ends anyone else's open shift on this device and this person's shift anywhere else.
create or replace function public.sign_in_with_pin(p_pin text, p_counter_id uuid default null, p_device text default 'counter')
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_staff   public.staff%rowtype;
  v_needed  text;
  v_counter uuid := case when p_device = 'kitchen' then null else p_counter_id end;
  v_key     text;
  v_left    integer;
  v_fail    jsonb;
  v_token   text;
  v_hash    text;
  v_expires timestamptz;
  v_shift   public.shifts%rowtype;
begin
  if p_device not in ('counter', 'kitchen') then
    raise exception 'Unknown device';
  end if;
  if p_device = 'counter' and not exists (select 1 from public.counters where id = p_counter_id) then
    raise exception 'That counter does not exist';
  end if;
  v_needed := case when p_device = 'kitchen' then 'log_batches' else 'take_orders' end;
  v_key := case when p_device = 'kitchen' then 'kitchen' else p_counter_id::text end;

  -- one attempt at a time per device, so a burst of guesses can't get past the count
  perform pg_advisory_xact_lock(hashtext('pin_attempts:device:' || v_key));

  v_left := public.pin_lock_seconds('device', v_key);
  if v_left > 0 then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'retry_seconds', v_left);
  end if;

  if p_pin ~ '^[0-9]{4}$' then
    select * into v_staff
    from public.staff
    where status = 'active' and pin_hash is not null and pin_hash = crypt(p_pin, pin_hash)
    limit 1;

    if found then
      -- the kitchen is for pastry chefs and managers (who also have the permission)
      if not (v_needed = any (v_staff.permissions)) or (p_device = 'kitchen' and v_staff.role not in ('pastry_chef', 'manager')) then
        -- a right PIN that isn't allowed in still counts as a try, so PINs can't be found out one by one
        v_fail := public.pin_attempt_failed('device', v_key);
        if (v_fail ->> 'locked')::boolean then
          return jsonb_build_object('ok', false, 'reason', 'locked', 'retry_seconds', (v_fail ->> 'retry_seconds')::integer);
        end if;
        return jsonb_build_object('ok', false, 'reason', 'no_access', 'attempts_left', (v_fail ->> 'attempts_left')::integer);
      end if;

      perform public.pin_attempt_ok('device', v_key);

      -- a shift that has run out is over
      update public.shifts set ended_at = least(expires_at, now()) where ended_at is null and expires_at <= now();
      -- this person's open shift anywhere else, and anyone else's on this device, ends
      update public.shifts set ended_at = now(), token_hash = null
      where ended_at is null
        and ((staff_id = v_staff.id and (device <> p_device or counter_id is distinct from v_counter))
          or (staff_id <> v_staff.id and device = p_device and counter_id is not distinct from v_counter));

      -- the shift stops working at the end of the business day, or after 16 hours
      v_expires := least(
        now() + interval '16 hours',
        ((public.business_date(now()) + 1)::timestamp + public.business_day_ends()::interval) at time zone public.business_time_zone()
      );
      v_token := encode(gen_random_bytes(32), 'hex');
      v_hash := encode(digest(v_token, 'sha256'), 'hex');

      select * into v_shift from public.shifts
      where staff_id = v_staff.id and device = p_device and counter_id is not distinct from v_counter and ended_at is null
      order by started_at desc limit 1;

      if found then
        update public.shifts set token_hash = v_hash, expires_at = v_expires where id = v_shift.id returning * into v_shift;
      else
        insert into public.shifts (staff_id, counter_id, device, token_hash, expires_at)
        values (v_staff.id, v_counter, p_device, v_hash, v_expires) returning * into v_shift;
      end if;

      update public.staff set last_active_at = now() where id = v_staff.id;

      return jsonb_build_object('ok', true, 'staff_id', v_staff.id, 'name', v_staff.name, 'role', v_staff.role,
                                'can_kitchen', 'log_batches' = any (v_staff.permissions) and v_staff.role in ('pastry_chef', 'manager'),
                                'token', v_token, 'shift_id', v_shift.id, 'started_at', v_shift.started_at, 'expires_at', v_shift.expires_at);
    end if;
  end if;

  v_fail := public.pin_attempt_failed('device', v_key);
  if (v_fail ->> 'locked')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'retry_seconds', (v_fail ->> 'retry_seconds')::integer);
  end if;
  return jsonb_build_object('ok', false, 'reason', 'wrong', 'attempts_left', (v_fail ->> 'attempts_left')::integer);
end;
$$;

revoke all on function public.sign_in_with_pin(text, uuid, text) from public;
grant execute on function public.sign_in_with_pin(text, uuid, text) to anon, authenticated;

-- start_shift(token): the signed-in person's shift { shift_id, started_at } (the shift itself starts at sign-in)
create or replace function public.start_shift(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s     record;
  v_start timestamptz;
begin
  select * into v_s from public.require_session(p_token);
  update public.staff set last_active_at = now() where id = v_s.staff_id;
  select started_at into v_start from public.shifts where id = v_s.shift_id;
  return jsonb_build_object('shift_id', v_s.shift_id, 'started_at', v_start);
end;
$$;

revoke all on function public.start_shift(text) from public;
grant execute on function public.start_shift(text) to anon, authenticated;

-- end_shift(token): ends the shift and clears its token (nothing happens if it has already ended)
create or replace function public.end_shift(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_token is null or p_token = '' then
    return;
  end if;
  update public.shifts set ended_at = now(), token_hash = null
  where token_hash = encode(digest(p_token, 'sha256'), 'hex') and ended_at is null;
end;
$$;

revoke all on function public.end_shift(text) from public;
grant execute on function public.end_shift(text) to anon, authenticated;

-- counter_heartbeat(token): "this counter is online". The counter comes from the session.
create or replace function public.counter_heartbeat(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s record;
begin
  select * into v_s from public.require_session(p_token);
  if v_s.counter_id is not null then
    update public.counters set last_synced_at = now() where id = v_s.counter_id;
  end if;
end;
$$;

revoke all on function public.counter_heartbeat(text) from public;
grant execute on function public.counter_heartbeat(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. One-time manager approvals
-- ---------------------------------------------------------------------

-- verify_manager_pin(token, pin, purpose)
--   purpose 'refund' needs "Approve refunds", 'manual_discount' needs "Give manual discounts", and
--   'reopen_day' needs a manager who may close the day.
--   Returns { ok: true, staff_id, name, approval_token, expires_in } (the token works once, for 2 minutes, on this shift)
--   or      { ok: false, reason: 'wrong' | 'locked', retry_seconds, attempts_left }
--   5 wrong PINs lock manager approvals on this shift for 5 minutes.
create or replace function public.verify_manager_pin(p_token text, p_pin text, p_purpose text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_s      record;
  v_staff  public.staff%rowtype;
  v_key    text;
  v_left   integer;
  v_fail   jsonb;
  v_token  text;
begin
  select * into v_s from public.require_session(p_token, null, 'counter');
  if p_purpose is null or p_purpose not in ('refund', 'manual_discount', 'reopen_day') then
    raise exception 'Unknown kind of approval';
  end if;
  v_key := v_s.shift_id::text;

  perform pg_advisory_xact_lock(hashtext('pin_attempts:shift:' || v_key));

  v_left := public.pin_lock_seconds('shift', v_key);
  if v_left > 0 then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'retry_seconds', v_left);
  end if;

  if p_pin ~ '^[0-9]{4}$' then
    select * into v_staff
    from public.staff
    where status = 'active'
      and pin_hash is not null
      and pin_hash = crypt(p_pin, pin_hash)
      and case p_purpose
            when 'refund' then 'refunds' = any (permissions)
            when 'manual_discount' then 'manual_discounts' = any (permissions)
            else role = 'manager' and 'close_day' = any (permissions)
          end
    limit 1;

    if found then
      perform public.pin_attempt_ok('shift', v_key);
      delete from public.approvals where created_at < now() - interval '1 day';

      v_token := encode(gen_random_bytes(32), 'hex');
      insert into public.approvals (token_hash, staff_id, shift_id, purpose, expires_at)
      values (encode(digest(v_token, 'sha256'), 'hex'), v_staff.id, v_s.shift_id, p_purpose, now() + interval '2 minutes');

      return jsonb_build_object('ok', true, 'staff_id', v_staff.id, 'name', v_staff.name, 'approval_token', v_token, 'expires_in', 120);
    end if;
  end if;

  v_fail := public.pin_attempt_failed('shift', v_key);
  if (v_fail ->> 'locked')::boolean then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'retry_seconds', (v_fail ->> 'retry_seconds')::integer);
  end if;
  return jsonb_build_object('ok', false, 'reason', 'wrong', 'attempts_left', (v_fail ->> 'attempts_left')::integer);
end;
$$;

revoke all on function public.verify_manager_pin(text, text, text) from public;
grant execute on function public.verify_manager_pin(text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. POS: discount codes, orders and the end of the day (every one needs a session token)
-- ---------------------------------------------------------------------

-- check_discount_code(token, code, order)
--   Needs "Apply promo codes". 10 invalid codes in 10 minutes on a shift pause code checks for 5 minutes.
--   p_order = { "subtotal": 36.5, "lines": [{ "category_id": "...", "amount": 12.5 }] }
create or replace function public.check_discount_code(p_token text, p_code text, p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s      record;
  v_n      integer;
  v_last   timestamptz;
  v_result jsonb;
begin
  select * into v_s from public.require_session(p_token, 'apply_codes', 'counter');

  perform pg_advisory_xact_lock(hashtext('code_attempts:' || v_s.shift_id::text));
  delete from public.code_attempts where created_at < now() - interval '1 hour';

  select count(*), max(created_at) into v_n, v_last
  from public.code_attempts where shift_id = v_s.shift_id and created_at > now() - interval '10 minutes';

  if v_n >= 10 then
    if v_last + interval '5 minutes' > now() then
      return jsonb_build_object('ok', false, 'reason', 'too_many', 'message', 'Too many invalid codes. Try again in a few minutes.',
                                'retry_seconds', ceil(extract(epoch from v_last + interval '5 minutes' - now()))::integer);
    end if;
    delete from public.code_attempts where shift_id = v_s.shift_id;   -- the pause is over: start counting again
  end if;

  v_result := public.check_code_rules(null, p_code, coalesce((p_order ->> 'subtotal')::numeric, 0), p_order -> 'lines');

  -- a code that can't be used counts as invalid (a code that only needs a bigger order, or other items, does not)
  if not (v_result ->> 'ok')::boolean and v_result ->> 'reason' not in ('min_order', 'no_eligible_items') then
    insert into public.code_attempts (shift_id) values (v_s.shift_id);
  end if;

  return v_result;
end;
$$;

revoke all on function public.check_discount_code(text, text, jsonb) from public;
grant execute on function public.check_discount_code(text, text, jsonb) to anon, authenticated;

-- complete_order(token, order)
--   Takes: the session token and the order as JSON: { type, items[], subtotal, discount_amount, vat_amount, total,
--          payment { method, cash_amount, card_amount, cash_received }, discount { kind, id, type, value, reason,
--          approval_token } }.
--   Returns: { order_id, order_number, receipt_number, created_at }. Any problem raises an error and nothing is saved.
--   Steps: 1 who is asking (counter and staff come from the session) · 2 check the items and their prices ·
--          3 work out the discount (voucher rules, or a manual discount with a manager's approval) · 4 work out
--          VAT and the total, which must match what the POS sent · 5 check the payment · 6 under a lock, refuse a
--          closed day and take the next order and receipt number for this counter · 7 take the sold items off the
--          made-daily counts and the stock · 8 save the order and its items.
--   In more detail: the counter and the staff member come from the session (a kitchen session can't take orders; needs
--   "Take orders and payments"). Everything is worked out again here: item prices must not be below the menu
--   price, a voucher passes the same rules as check_discount_code ("Apply promo codes"), a manual discount
--   needs a valid one-time manager approval (order.discount.approval_token) and stays within the highest
--   manual discount in the settings, and the discount, VAT and total are calculated here and must match.
create or replace function public.complete_order(p_token text, p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s          record;
  v_today      date := public.business_today();
  v_counter_id uuid;
  v_counter_no integer;
  v_prefix     text;
  v_type       text := p_order ->> 'type';
  v_subtotal   numeric;
  v_sent_sub   numeric := (p_order ->> 'subtotal')::numeric;
  v_sent_disc  numeric := coalesce((p_order ->> 'discount_amount')::numeric, 0);
  v_sent_vat   numeric := coalesce((p_order ->> 'vat_amount')::numeric, 0);
  v_sent_total numeric := (p_order ->> 'total')::numeric;
  v_discount   numeric := 0;
  v_vat        numeric;
  v_total      numeric;
  v_pay        jsonb := p_order -> 'payment';
  v_method     text := v_pay ->> 'method';
  v_cash       numeric := coalesce((v_pay ->> 'cash_amount')::numeric, 0);
  v_card       numeric := coalesce((v_pay ->> 'card_amount')::numeric, 0);
  v_received   numeric := nullif(v_pay ->> 'cash_received', '')::numeric;
  v_change     numeric;
  v_disc       jsonb := case when jsonb_typeof(p_order -> 'discount') = 'object' then p_order -> 'discount' end;
  v_disc_id    uuid;
  v_disc_type  text;
  v_disc_value numeric;
  v_disc_row   public.discounts%rowtype;
  v_approver   uuid;
  v_eligible   numeric;
  v_lines_json jsonb;
  v_check      jsonb;
  v_tax        jsonb;
  v_rules      jsonb;
  v_vat_rate   numeric;
  v_incl_vat   boolean;
  v_bag_price  numeric;
  v_max_pct    numeric;
  v_reason     text;
  v_number     integer;
  v_receipt_no integer;
  v_receipt    text;
  v_order_id   uuid;
  v_created    timestamptz;
  v_track      record;
  v_stock      record;
  v_have       numeric;
  v_left       integer;
begin
  select * into v_s from public.require_session(p_token, 'take_orders', 'counter');

  select tax, discount_rules into v_tax, v_rules from public.settings limit 1;
  v_vat_rate := coalesce((v_tax ->> 'vatRate')::numeric, 5);
  v_incl_vat := coalesce((v_tax ->> 'pricesIncludeVat')::boolean, false);
  v_bag_price := coalesce((v_tax ->> 'bagPrice')::numeric, 0.5);
  v_max_pct := coalesce((v_rules ->> 'maxManualPercent')::numeric, 50);

  -- ---- check that everything adds up before saving anything
  if v_type is null or v_type not in ('dine_in', 'takeaway') then
    raise exception 'The order must be dine in or takeaway';
  end if;
  if jsonb_typeof(p_order -> 'items') is distinct from 'array' or jsonb_array_length(p_order -> 'items') = 0 then
    raise exception 'The order has no items';
  end if;
  if v_sent_sub is null or v_sent_total is null or v_sent_total < 0 or v_sent_sub < 0 then
    raise exception 'The order totals are missing';
  end if;

  select coalesce(sum((i ->> 'quantity')::numeric * (i ->> 'unit_price')::numeric), 0) into v_subtotal
  from jsonb_array_elements(p_order -> 'items') i;
  if abs(v_subtotal - v_sent_sub) > 0.011 then
    raise exception 'The items add up to % but the subtotal is %', v_subtotal, v_sent_sub;
  end if;
  v_subtotal := round(v_subtotal, 2);
  if exists (
    select 1 from jsonb_array_elements(p_order -> 'items') i
    where coalesce(btrim(i ->> 'name'), '') = '' or (i ->> 'quantity')::int <= 0 or (i ->> 'unit_price')::numeric < 0
       or abs((i ->> 'quantity')::numeric * (i ->> 'unit_price')::numeric - (i ->> 'line_total')::numeric) > 0.011
  ) then
    raise exception 'An item in the order is not valid';
  end if;

  -- a price can't be lower than the menu price (extras only add to it); the only other line is the takeaway bag
  select string_agg(distinct i ->> 'name', ', ') into v_reason
  from jsonb_array_elements(p_order -> 'items') i
  join public.item_sizes s on s.menu_item_id = nullif(i ->> 'menu_item_id', '')::uuid and s.label = i ->> 'size_label'
  where (i ->> 'unit_price')::numeric < s.price - 0.001;
  if v_reason is not null then
    raise exception 'The price of % does not match the menu. Reload the menu and try again.', v_reason;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_order -> 'items') i
    where nullif(i ->> 'menu_item_id', '') is null
      and (i ->> 'name' <> 'Takeaway bag' or (i ->> 'unit_price')::numeric < v_bag_price - 0.001)
  ) then
    raise exception 'An item in the order is not valid';
  end if;

  -- ---- the discount, worked out here
  select coalesce(jsonb_agg(jsonb_build_object('category_id', m.category_id, 'amount', round((i ->> 'quantity')::numeric * (i ->> 'unit_price')::numeric, 2))), '[]'::jsonb)
  into v_lines_json
  from jsonb_array_elements(p_order -> 'items') i
  left join public.menu_items m on m.id = nullif(i ->> 'menu_item_id', '')::uuid;

  if v_disc is not null then
    if v_disc ->> 'kind' not in ('code', 'manual') then raise exception 'Unknown kind of discount'; end if;

    if v_disc ->> 'kind' = 'code' then
      if not ('apply_codes' = any (v_s.permissions)) then
        raise exception 'You don''t have permission to do that' using errcode = 'PT403';
      end if;
      v_disc_id := nullif(v_disc ->> 'id', '')::uuid;
      v_check := public.check_code_rules(v_disc_id, null, v_subtotal, v_lines_json);
      if not (v_check ->> 'ok')::boolean then
        raise exception '%', v_check ->> 'message';
      end if;
      select * into v_disc_row from public.discounts where id = v_disc_id;
      v_disc_type := v_disc_row.type;
      v_disc_value := v_disc_row.value;
      select case when v_disc_row.applies_to = 'categories'
                  then coalesce(sum((l ->> 'amount')::numeric) filter (where (l ->> 'category_id')::uuid = any (v_disc_row.category_ids)), 0)
                  else v_subtotal end
      into v_eligible
      from jsonb_array_elements(v_lines_json) l;
    else
      -- a manual discount: a manager's one-time approval, a value within the highest allowed, a reason when required
      v_disc_type := v_disc ->> 'type';
      v_disc_value := (v_disc ->> 'value')::numeric;
      v_reason := btrim(coalesce(v_disc ->> 'reason', ''));
      if v_disc_type not in ('percent', 'fixed') or v_disc_value is null or v_disc_value <= 0 then
        raise exception 'The manager discount is not valid';
      end if;
      if v_disc_type = 'percent' and v_disc_value > v_max_pct then
        raise exception 'A manager discount can be at most % percent', v_max_pct;
      end if;
      if v_disc_type = 'fixed' and v_disc_value > round(v_subtotal * v_max_pct / 100, 2) + 0.001 then
        raise exception 'A manager discount can be at most % percent of the order', v_max_pct;
      end if;
      if coalesce((v_rules ->> 'reasonRequired')::boolean, true) and v_reason = '' then
        raise exception 'A manager discount needs a reason';
      end if;
      v_approver := public.use_approval(v_s.shift_id, v_disc ->> 'approval_token', 'manual_discount');
      v_eligible := v_subtotal;
    end if;

    v_discount := round(least(case when v_disc_type = 'percent' then round(v_eligible * v_disc_value / 100, 2) else v_disc_value end, v_eligible), 2);
    if v_discount <= 0 then raise exception 'A discount needs an amount'; end if;
  end if;
  if abs(v_discount - v_sent_disc) > 0.011 then
    raise exception 'The discount does not match the order';
  end if;

  -- ---- VAT and the total, worked out here (the same way the POS shows them)
  if v_incl_vat then
    v_vat := round(round(greatest(v_subtotal - v_discount, 0), 2) * v_vat_rate / (100 + v_vat_rate), 2);
    v_total := round(greatest(v_subtotal - v_discount, 0), 2);
  else
    v_vat := round(round(greatest(v_subtotal - v_discount, 0), 2) * v_vat_rate / 100, 2);
    v_total := round(round(greatest(v_subtotal - v_discount, 0), 2) + v_vat, 2);
  end if;
  if abs(v_vat - v_sent_vat) > 0.011 or abs(v_total - v_sent_total) > 0.011 then
    raise exception 'The total does not match the subtotal, discount and VAT';
  end if;

  if v_method = 'cash' then
    if abs(v_cash - v_total) > 0.011 or v_card <> 0 then raise exception 'A cash order must be paid in cash'; end if;
    if v_received is null or v_received < v_cash - 0.011 then raise exception 'The cash received is less than the total'; end if;
    v_change := greatest(v_received - v_cash, 0);
  elsif v_method = 'card' then
    if abs(v_card - v_total) > 0.011 or v_cash <> 0 then raise exception 'A card order must be paid by card'; end if;
    v_received := null;
    v_change := null;
  elsif v_method = 'split' then
    if v_cash <= 0 or v_card <= 0 or abs(v_cash + v_card - v_total) > 0.011 then
      raise exception 'The cash and card parts must add up to the total';
    end if;
    v_received := v_cash;  -- the cash part is handed over exactly
    v_change := 0;
  else
    raise exception 'Unknown payment method';
  end if;

  -- ---- numbers. One sale at a time, so two tills can't take the same number.
  perform pg_advisory_xact_lock(hashtext('complete_order'));

  select id, number into v_counter_id, v_counter_no from public.counters where id = v_s.counter_id;
  if v_counter_id is null then raise exception 'That counter does not exist'; end if;

  -- a closed day takes no more orders (checked here, with the lock held, so it can't be bypassed)
  if exists (select 1 from public.day_closings where counter_id = v_counter_id and closing_date = v_today and reopened_at is null) then
    raise exception 'Today is closed for Counter %', v_counter_no;
  end if;

  select coalesce(max(order_number), 0) + 1 into v_number
  from public.orders where counter_id = v_counter_id and order_date = v_today;

  select coalesce(receipts ->> 'prefix', 'GK') into v_prefix from public.settings limit 1;
  v_prefix := coalesce(v_prefix, 'GK');
  select coalesce(max(substring(receipt_number from '([0-9]+)$')::int), 1000) + 1 into v_receipt_no
  from public.orders where receipt_number like v_prefix || '-C' || v_counter_no || '-%';
  v_receipt := v_prefix || '-C' || v_counter_no || '-' || v_receipt_no;

  -- ---- the made-daily items: what is sold comes off today's count, and an order for more than are left is refused
  for v_track in
    select s.id as size_id, m.name, sum((i ->> 'quantity')::integer) as qty
    from jsonb_array_elements(p_order -> 'items') i
    join public.item_sizes s on s.menu_item_id = nullif(i ->> 'menu_item_id', '')::uuid and s.label = i ->> 'size_label'
    join public.menu_items m on m.id = s.menu_item_id and m.tracking = 'made_daily'
    group by s.id, m.name
  loop
    insert into public.daily_counts (size_id, day) values (v_track.size_id, v_today) on conflict (size_id, day) do nothing;
    select carried_in + made - sold - wasted - carried_over into v_left
    from public.daily_counts where size_id = v_track.size_id and day = v_today for update;
    if v_track.qty > v_left then
      raise exception 'Only % left of %', greatest(v_left, 0), v_track.name;
    end if;
    update public.daily_counts set sold = sold + v_track.qty where size_id = v_track.size_id and day = v_today;
  end loop;

  -- ---- "From stock" items (mugs, bottled water, retail beans...): what is sold comes off the linked stock item,
  -- all in this same transaction. An order for more than is in stock is refused, so stock never goes below 0.
  -- Made-daily and untracked items are left alone.
  for v_stock in
    select f.id as stock_id, f.name, sum((i ->> 'quantity')::integer) as qty
    from jsonb_array_elements(p_order -> 'items') i
    join public.item_sizes s on s.menu_item_id = nullif(i ->> 'menu_item_id', '')::uuid and s.label = i ->> 'size_label'
    join public.menu_items m on m.id = s.menu_item_id and m.tracking = 'stock'
    join public.stock_items f on f.id = s.stock_item_id
    group by f.id, f.name
    order by f.id   -- always in the same order, so two orders can't wait on each other
  loop
    select quantity into v_have from public.stock_items where id = v_stock.stock_id for update;
    if v_stock.qty > v_have then
      raise exception 'Only % % left', greatest(floor(v_have), 0)::int, v_stock.name;
    end if;
    update public.stock_items set quantity = quantity - v_stock.qty where id = v_stock.stock_id;
  end loop;

  -- ---- save
  insert into public.orders (
    counter_id, staff_id, order_number, order_date, receipt_number, type, subtotal,
    discount_id, discount_amount, vat_amount, total, payment_method, status,
    cash_amount, card_amount, cash_received, change_given,
    discount_kind, discount_type, discount_value, discount_label, manual_discount_reason, discount_approved_by
  ) values (
    v_counter_id, v_s.staff_id, v_number, v_today, v_receipt, v_type, v_subtotal,
    v_disc_id, v_discount, v_vat, v_total, v_method, 'paid',
    v_cash, v_card, v_received, v_change,
    v_disc ->> 'kind', v_disc_type, v_disc_value, v_disc ->> 'label',
    nullif(btrim(coalesce(v_disc ->> 'reason', '')), ''), v_approver
  )
  returning id, created_at into v_order_id, v_created;

  insert into public.order_items (order_id, menu_item_id, name, size_label, options, quantity, unit_price, line_total)
  select v_order_id, nullif(i ->> 'menu_item_id', '')::uuid, btrim(i ->> 'name'), nullif(i ->> 'size_label', ''),
         coalesce(i -> 'options', '{}'::jsonb), (i ->> 'quantity')::int, (i ->> 'unit_price')::numeric, (i ->> 'line_total')::numeric
  from jsonb_array_elements(p_order -> 'items') i;

  -- a code used once more (a manual discount has no code)
  if v_disc_id is not null then
    update public.discounts set used_count = used_count + 1 where id = v_disc_id;
  end if;

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_number, 'receipt_number', v_receipt, 'created_at', v_created);
end;
$$;

revoke all on function public.complete_order(text, jsonb) from public;
grant execute on function public.complete_order(text, jsonb) to anon, authenticated;

-- get_pos_orders_today(token): today's orders on the session's counter
create or replace function public.get_pos_orders_today(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_s record;
begin
  select * into v_s from public.require_session(p_token, 'take_orders', 'counter');

  return (
    select coalesce(jsonb_agg(x.json order by x.created_at desc, x.order_number desc), '[]'::jsonb)
    from (
      select
        o.created_at,
        o.order_number,
        jsonb_build_object(
          'id',              o.id,
          'order_number',    o.order_number,
          'receipt_number',  o.receipt_number,
          'counter_number',  c.number,
          'type',            o.type,
          'subtotal',        o.subtotal,
          'discount_amount', o.discount_amount,
          'discount',        case when o.discount_amount > 0 and o.discount_kind is not null then jsonb_build_object(
                               'kind',  o.discount_kind,
                               'code',  d.code,
                               'type',  o.discount_type,
                               'value', o.discount_value
                             ) end,
          'vat_amount',      o.vat_amount,
          'total',           o.total,
          'payment_method',  o.payment_method,
          'cash_amount',     o.cash_amount,
          'card_amount',     o.card_amount,
          'cash_received',   o.cash_received,
          'status',          o.status,
          'created_at',      o.created_at,
          'refunded_at',     o.refunded_at,
          'items', coalesce((
            select jsonb_agg(jsonb_build_object(
                     'name',       i.name,
                     'size_label', i.size_label,
                     'options',    i.options,
                     'quantity',   i.quantity,
                     'unit_price', i.unit_price,
                     'line_total', i.line_total
                   ) order by i.created_at, i.id)
            from public.order_items i
            where i.order_id = o.id
          ), '[]'::jsonb)
        ) as json
      from public.orders o
      join public.counters c on c.id = o.counter_id
      left join public.discounts d on d.id = o.discount_id
      where c.id = v_s.counter_id
        and o.order_date = public.business_today()
    ) x
  );
end;
$$;

revoke all on function public.get_pos_orders_today(text) from public;
grant execute on function public.get_pos_orders_today(text) to anon, authenticated;

-- refund_order(token, order, approval token, reason): only today's orders on this counter, with a manager's
-- one-time "refund" approval. The approving manager is saved from the approval.
create or replace function public.refund_order(p_token text, p_order_id uuid, p_approval_token text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s        record;
  v_order    public.orders%rowtype;
  v_reason   text := btrim(coalesce(p_reason, ''));
  v_when     timestamptz := now();
  v_approver uuid;
begin
  select * into v_s from public.require_session(p_token, 'take_orders', 'counter');
  if v_reason = '' then
    raise exception 'A refund needs a reason';
  end if;

  -- one refund at a time, so a double tap can't refund the same order twice
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.counter_id <> v_s.counter_id then
    raise exception 'That order does not exist';
  end if;
  if v_order.status = 'refunded' then
    raise exception 'This order has already been refunded';
  end if;
  if v_order.order_date <> public.business_today() then
    raise exception 'Only today''s orders can be refunded here';
  end if;

  v_approver := public.use_approval(v_s.shift_id, p_approval_token, 'refund');

  update public.orders
  set status = 'refunded', refunded_at = v_when, refunded_by = v_approver, refund_reason = v_reason
  where id = p_order_id;

  return jsonb_build_object('order_id', p_order_id, 'refunded_at', v_when);
end;
$$;

revoke all on function public.refund_order(text, uuid, text, text) from public;
grant execute on function public.refund_order(text, uuid, text, text) to anon, authenticated;

-- get_pos_day_summary(token): today's takings for the session's counter
create or replace function public.get_pos_day_summary(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_s        record;
  v_today    date := public.business_today();
  v_counter  uuid;
  v_start    numeric;
  v_closing  jsonb;
  v_last     jsonb;
  v_totals   record;
begin
  select * into v_s from public.require_session(p_token, 'take_orders', 'counter');
  v_counter := v_s.counter_id;

  select coalesce((payments ->> 'startingFloat')::numeric, 0) into v_start from public.settings limit 1;
  v_start := coalesce(v_start, 0);

  select count(*) filter (where status = 'paid')                              as orders,
         coalesce(sum(cash_amount) filter (where status = 'paid'), 0)         as cash,
         coalesce(sum(card_amount) filter (where status = 'paid'), 0)         as card,
         count(*) filter (where status = 'paid' and payment_method = 'split') as split,
         coalesce(sum(cash_amount), 0)                                        as cash_sales,
         coalesce(sum(cash_amount) filter (where status = 'refunded'), 0)     as cash_refunds
  into v_totals
  from public.orders
  where counter_id = v_counter and order_date = v_today;

  select jsonb_build_object('closed_at', closed_at, 'counted', counted, 'expected', expected, 'difference', difference)
  into v_closing
  from public.day_closings where counter_id = v_counter and closing_date = v_today and reopened_at is null;

  select jsonb_build_object('closing_date', d.closing_date, 'closed_at', d.closed_at, 'closed_by_name', s.name)
  into v_last
  from public.day_closings d
  left join public.staff s on s.id = d.closed_by
  where d.counter_id = v_counter and d.reopened_at is null
  order by d.closed_at desc
  limit 1;

  return jsonb_build_object(
    'date',          v_today,
    'starting_cash', v_start,
    'orders',        v_totals.orders,
    'cash',          v_totals.cash,
    'card',          v_totals.card,
    'split',         v_totals.split,
    'cash_sales',    v_totals.cash_sales,
    'cash_refunds',  v_totals.cash_refunds,
    'expected',      v_start + v_totals.cash_sales - v_totals.cash_refunds,
    'closing',       v_closing,
    'last_closed',   v_last
  );
end;
$$;

revoke all on function public.get_pos_day_summary(text) from public;
grant execute on function public.get_pos_day_summary(text) to anon, authenticated;

-- close_day(token, counted): needs "Close the day". The counter and who closed it come from the session.
create or replace function public.close_day(p_token text, p_counted numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s        record;
  v_today    date := public.business_today();
  v_counter  uuid;
  v_start    numeric;
  v_sales    numeric;
  v_refunds  numeric;
  v_expected numeric;
  v_counted  numeric := round(p_counted, 2);
  v_row      public.day_closings%rowtype;
begin
  select * into v_s from public.require_session(p_token, 'close_day', 'counter');
  v_counter := v_s.counter_id;

  if v_counted is null or v_counted < 0 then
    raise exception 'Enter the cash counted in the drawer';
  end if;

  -- one closing at a time, so a double tap can't close the day twice
  perform pg_advisory_xact_lock(hashtext('close_day'));
  if exists (select 1 from public.day_closings where counter_id = v_counter and closing_date = v_today and reopened_at is null) then
    raise exception 'Today is already closed';
  end if;

  select coalesce((payments ->> 'startingFloat')::numeric, 0) into v_start from public.settings limit 1;
  v_start := coalesce(v_start, 0);

  select coalesce(sum(cash_amount), 0),
         coalesce(sum(cash_amount) filter (where status = 'refunded'), 0)
  into v_sales, v_refunds
  from public.orders
  where counter_id = v_counter and order_date = v_today;

  v_expected := v_start + v_sales - v_refunds;

  insert into public.day_closings (counter_id, closing_date, starting_cash, cash_sales, cash_refunds, expected, counted, difference, closed_by)
  values (v_counter, v_today, v_start, v_sales, v_refunds, v_expected, v_counted, v_counted - v_expected, v_s.staff_id)
  returning * into v_row;

  return jsonb_build_object('closed_at', v_row.closed_at, 'counted', v_row.counted, 'expected', v_row.expected, 'difference', v_row.difference);
end;
$$;

revoke all on function public.close_day(text, numeric) from public;
grant execute on function public.close_day(text, numeric) to anon, authenticated;

-- reopen_day(token, approval token): needs a manager's one-time "reopen_day" approval, saved as who reopened it
create or replace function public.reopen_day(p_token text, p_approval_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s        record;
  v_today    date := public.business_today();
  v_when     timestamptz := now();
  v_id       uuid;
  v_approver uuid;
begin
  select * into v_s from public.require_session(p_token, 'take_orders', 'counter');

  -- one at a time, so a double tap can't reopen twice
  perform pg_advisory_xact_lock(hashtext('close_day'));

  select id into v_id
  from public.day_closings
  where counter_id = v_s.counter_id and closing_date = v_today and reopened_at is null;
  if v_id is null then
    raise exception 'Today is not closed';
  end if;

  v_approver := public.use_approval(v_s.shift_id, p_approval_token, 'reopen_day');

  update public.day_closings set reopened_at = v_when, reopened_by = v_approver where id = v_id;

  return jsonb_build_object('reopened_at', v_when);
end;
$$;

revoke all on function public.reopen_day(text, text) from public;
grant execute on function public.reopen_day(text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 7. Kitchen (needs "Log kitchen batches" and the role pastry chef or manager; counter or kitchen device)
-- ---------------------------------------------------------------------

-- get_kitchen_today(token)
--   { date, time_zone, business_day_ends, leftovers_saved,
--     items: [{ option_id, item_id, name, label, category_id, category_name, made, sold, wasted, carried_in,
--               carried_over, left, saved, stock: null | { id, name, quantity, unit } }] }
--   The made-daily items that are on the menu, by category, with today's numbers.
create or replace function public.get_kitchen_today(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_s     record;
  v_today date := public.business_today();
begin
  select * into v_s from public.require_session(p_token, 'log_batches');
  if v_s.role not in ('pastry_chef', 'manager') then
    raise exception 'You don''t have access to the kitchen' using errcode = 'PT403';
  end if;

  return jsonb_build_object(
    'date', v_today,
    'time_zone', public.business_time_zone(),
    'business_day_ends', public.business_day_ends(),
    'leftovers_saved', exists (select 1 from public.daily_counts where day = v_today and leftovers_saved_at is not null),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'option_id',     s.id,
               'item_id',       m.id,
               'name',          m.name,
               'label',         s.label,
               'category_id',   c.id,
               'category_name', c.name,
               'made',          coalesce(d.made, 0),
               'sold',          coalesce(d.sold, 0),
               'wasted',        coalesce(d.wasted, 0),
               'carried_in',    coalesce(d.carried_in, 0),
               'carried_over',  coalesce(d.carried_over, 0),
               'left',          greatest(coalesce(d.carried_in + d.made - d.sold - d.wasted - d.carried_over, 0), 0),
               'saved',         d.leftovers_saved_at is not null,
               'stock',         case when f.id is null then null else jsonb_build_object('id', f.id, 'name', f.name, 'quantity', f.quantity, 'unit', f.unit) end
             ) order by c.sort_order, m.sort_order, m.name, s.sort_order)
      from public.item_sizes s
      join public.menu_items m on m.id = s.menu_item_id and m.tracking = 'made_daily' and m.on_menu
      join public.categories c on c.id = m.category_id
      left join public.daily_counts d on d.size_id = s.id and d.day = v_today
      left join public.stock_items f on f.id = s.stock_item_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_kitchen_today(text) from public;
grant execute on function public.get_kitchen_today(text) to anon, authenticated;

-- log_batch(token, option, quantity): adds a batch to today's made (and takes it off the frozen stock)
--   Returns { made, left, stock_quantity }. "left" = carried in + made - sold - wasted - carried over (never below 0).
create or replace function public.log_batch(p_token text, p_option_id uuid, p_quantity integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s     record;
  v_today date := public.business_today();
  v_stock uuid;
  v_stock_qty numeric;
  v_row   public.daily_counts%rowtype;
begin
  select * into v_s from public.require_session(p_token, 'log_batches');
  if v_s.role not in ('pastry_chef', 'manager') then
    raise exception 'You don''t have access to the kitchen' using errcode = 'PT403';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'How many were made? It must be more than 0';
  end if;

  select s.stock_item_id into v_stock
  from public.item_sizes s
  join public.menu_items m on m.id = s.menu_item_id and m.tracking = 'made_daily'
  where s.id = p_option_id;
  if not found then
    raise exception 'That item is not made daily';
  end if;

  insert into public.daily_counts (size_id, day, made) values (p_option_id, v_today, p_quantity)
  on conflict (size_id, day) do update set made = public.daily_counts.made + p_quantity
  returning * into v_row;

  insert into public.kitchen_batches (size_id, quantity, staff_id, stock_item_id) values (p_option_id, p_quantity, v_s.staff_id, v_stock);

  if v_stock is not null then
    update public.stock_items set quantity = greatest(quantity - p_quantity, 0) where id = v_stock returning quantity into v_stock_qty;
  end if;

  return jsonb_build_object(
    'made', v_row.made,
    'left', greatest(v_row.carried_in + v_row.made - v_row.sold - v_row.wasted - v_row.carried_over, 0),
    'stock_quantity', v_stock_qty
  );
end;
$$;

revoke all on function public.log_batch(text, uuid, integer) from public;
grant execute on function public.log_batch(text, uuid, integer) to anon, authenticated;

-- save_leftovers(token, entries): end of day leftovers (wasted / carried over)
--   Takes: [{ option_id, wasted, carried_over }]. Returns the rows that were wasted or carried over.
--   Steps: lock so it runs once a day, make sure every made-daily option has a row for today, add each entry to
--   wasted / carried_over (never more than what is left), count anything not listed as wasted, mark today as
--   saved, and give tomorrow's row the carried-over amount as "carried in".
create or replace function public.save_leftovers(p_token text, p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s     record;
  v_today date := public.business_today();
  v_entry jsonb;
  v_size  uuid;
  v_waste integer;
  v_carry integer;
  v_left  integer;
  r       record;
begin
  select * into v_s from public.require_session(p_token, 'log_batches');
  if v_s.role not in ('pastry_chef', 'manager') then
    raise exception 'You don''t have access to the kitchen' using errcode = 'PT403';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array' then
    raise exception 'The leftovers must be a list';
  end if;

  -- one at a time, so two kitchen tablets can't save twice
  perform pg_advisory_xact_lock(hashtext('save_leftovers'));
  if exists (select 1 from public.daily_counts where day = v_today and leftovers_saved_at is not null) then
    raise exception 'Leftovers are already saved for today';
  end if;

  -- every made-daily option has a row for today
  insert into public.daily_counts (size_id, day)
  select s.id, v_today
  from public.item_sizes s join public.menu_items m on m.id = s.menu_item_id and m.tracking = 'made_daily'
  on conflict (size_id, day) do nothing;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    v_size := (v_entry ->> 'option_id')::uuid;
    v_waste := coalesce((v_entry ->> 'wasted')::integer, 0);
    v_carry := coalesce((v_entry ->> 'carried_over')::integer, 0);
    if v_waste < 0 or v_carry < 0 then
      raise exception 'The amounts can''t be less than 0';
    end if;

    select carried_in + made - sold - wasted - carried_over into v_left
    from public.daily_counts where size_id = v_size and day = v_today for update;
    if v_left is null then
      raise exception 'That item is not made daily';
    end if;
    if v_waste + v_carry > v_left then
      raise exception 'You can''t put away more than are left';
    end if;

    update public.daily_counts
    set wasted = wasted + v_waste, carried_over = carried_over + v_carry
    where size_id = v_size and day = v_today;
  end loop;

  -- anything still left that was not listed is wasted
  update public.daily_counts
  set wasted = wasted + (carried_in + made - sold - wasted - carried_over)
  where day = v_today and carried_in + made - sold - wasted - carried_over > 0
    and size_id not in (select (e ->> 'option_id')::uuid from jsonb_array_elements(p_entries) e);

  -- done for today; the carried-over amounts become tomorrow's carried in
  update public.daily_counts
  set leftovers_saved_at = now(), leftovers_by = v_s.staff_id, leftover = wasted + carried_over
  where day = v_today;

  for r in select size_id, carried_over from public.daily_counts where day = v_today and carried_over > 0
  loop
    insert into public.daily_counts (size_id, day, carried_in) values (r.size_id, v_today + 1, r.carried_over)
    on conflict (size_id, day) do update set carried_in = excluded.carried_in;
  end loop;

  return coalesce((
    select jsonb_agg(jsonb_build_object('option_id', size_id, 'wasted', wasted, 'carried_over', carried_over))
    from public.daily_counts where day = v_today and (wasted > 0 or carried_over > 0)
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.save_leftovers(text, jsonb) from public;
grant execute on function public.save_leftovers(text, jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 8. Who can call what, and what can be read directly
-- ---------------------------------------------------------------------

-- Not-signed-in callers (anon) keep only: get_pos_menu, ping, get_pos_counters, sign_in_with_pin (open to
-- everyone), plus the POS functions above that refuse to work without a valid session token.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and p.proname <> all (array[
        'get_pos_menu', 'ping', 'get_pos_counters', 'sign_in_with_pin',
        'start_shift', 'end_shift', 'counter_heartbeat', 'verify_manager_pin', 'check_discount_code',
        'complete_order', 'get_pos_orders_today', 'refund_order', 'get_pos_day_summary', 'close_day', 'reopen_day',
        'get_kitchen_today', 'log_batch', 'save_leftovers'
      ])
  loop
    execute format('revoke execute on function %s from anon', f.sig);
  end loop;
end $$;

-- the helpers are never called from outside
revoke all on function public.require_session(text, text, text) from anon, authenticated;
revoke all on function public.use_approval(uuid, text, text) from anon, authenticated;
revoke all on function public.pin_lock_seconds(text, text) from anon, authenticated;
revoke all on function public.pin_attempt_failed(text, text) from anon, authenticated;
revoke all on function public.pin_attempt_ok(text, text) from anon, authenticated;
revoke all on function public.check_code_rules(uuid, text, numeric, jsonb) from anon, authenticated;

-- No direct reading of any table by not-signed-in callers: the customisations and today's counts were
-- readable for live updates; the POS now reads them through get_pos_menu and the kitchen function.
-- (Managers keep full access through "Managers can do everything".)
revoke all on all tables in schema public from anon;
drop policy if exists "The POS can read the counts" on public.daily_counts;
drop policy if exists "The POS can read customisations" on public.modifier_groups;
drop policy if exists "The POS can read customisations" on public.modifiers;
drop policy if exists "The POS can read customisations" on public.modifier_group_links;

-- the two "permanent code" trigger functions can only run as triggers; close them to everyone else too
revoke all on function public.menu_items_keep_code() from public;
revoke all on function public.stock_items_keep_code() from public;
