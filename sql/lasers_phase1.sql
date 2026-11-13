-- ─────────────────────────────────────────────────────────────────────────────
-- Lasers - PHASE 1 (2026-11-13). Novi Sad gets a second laser ("Novi").
-- Run BEFORE deploying the code that knows about lasers.
--
-- Every laser has its own appointments AND its own working hours. A time on
-- the site is free while at least one laser works then and has nothing booked;
-- the client sees each time once.
--
-- What this file changes:
--   1. NEW TABLE  lasers                       - each studio's lasers: number,
--                                                name, first working day.
--   2. NEW COLUMN reservations.laser           - the laser a booking is on.
--   3. NEW COLUMN weekly_schedule.laser        - weekly hours are per laser.
--      NEW COLUMN availability_overrides.laser - date exceptions are per laser.
--      Every existing row (bookings and hours) becomes Laser 1 ("Stari").
--   4. NEW FUNCTION free_laser()               - the one rule for "is there
--                                                room": a laser that works then
--                                                and is free (Stari before Novi).
--   5. public_busy_slots     - also returns each booking's laser.
--   6. public_create_booking - checks hours and overlaps per laser; the booking
--                              goes on the first laser that works and is free.
--   7. admin_create_booking  - the same, without the hours rule (as before),
--                              plus an optional preferred laser.
--   8. admin_move_reservation - stays on its laser when free, else moves over.
--   9. NEW FUNCTION admin_set_laser() - put a booking on the other laser.
--
-- SAFE WHILE THE CURRENT SITE IS LIVE: only Laser 1 exists after this file,
-- and every hour and booking belongs to it, so each check answers exactly as
-- today. The old weekly_schedule / availability_overrides keys stay (the live
-- admin saves hours with ON CONFLICT on them); they are swapped in
-- sql/lasers_phase2.sql, after the deploy, which also adds Laser 2.
--
-- Functions 6-8 are changed in place: their live text is read and only the
-- lines below are swapped, so nothing else in them can drift. If the live
-- text is not what is expected, the whole file stops and nothing changes.
-- Running the file a second time changes nothing.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- 1. lasers ────────────────────────────────────────────────────────────────────
create table if not exists public.lasers (
  location    text     not null
    constraint lasers_location_check check (location in ('novi_sad', 'sombor')),
  laser       smallint not null check (laser between 1 and 9),
  name        text     not null check (length(trim(name)) > 0),
  -- First day it takes bookings; null = it always has.
  active_from date,
  primary key (location, laser)
);

insert into public.lasers (location, laser, name) values
  ('novi_sad', 1, 'Stari'),
  ('sombor',   1, 'Laser')
on conflict (location, laser) do nothing;

-- The booking form (anon) reads it; only the admin writes.
alter table public.lasers enable row level security;
drop policy if exists "public read" on public.lasers;
create policy "public read" on public.lasers for select using (true);
drop policy if exists "admin all" on public.lasers;
create policy "admin all" on public.lasers for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.lasers from anon, authenticated;
grant select on public.lasers to anon, authenticated;
grant insert, update, delete on public.lasers to authenticated;

-- 2. + 3. The laser of every booking and every working-hours row ─────────────
-- A constant default: existing rows get 1 without being rewritten, and the
-- live code (which does not know about lasers) keeps writing Laser 1.
alter table public.reservations           add column if not exists laser smallint not null default 1;
alter table public.weekly_schedule        add column if not exists laser smallint not null default 1;
alter table public.availability_overrides add column if not exists laser smallint not null default 1;

-- A row can only point at a laser its studio has. Hours go with their laser;
-- a laser that still has bookings cannot be deleted.
alter table public.reservations drop constraint if exists reservations_laser_fkey;
alter table public.reservations
  add constraint reservations_laser_fkey
  foreign key (location, laser) references public.lasers (location, laser);

alter table public.weekly_schedule drop constraint if exists weekly_schedule_laser_fkey;
alter table public.weekly_schedule
  add constraint weekly_schedule_laser_fkey
  foreign key (location, laser) references public.lasers (location, laser) on delete cascade;

alter table public.availability_overrides drop constraint if exists availability_overrides_laser_fkey;
alter table public.availability_overrides
  add constraint availability_overrides_laser_fkey
  foreign key (location, laser) references public.lasers (location, laser) on delete cascade;

-- Targets for the new code's saves (ON CONFLICT (location, laser, …)). They sit
-- next to the current primary keys and replace them in phase 2.
create unique index if not exists weekly_schedule_location_laser_weekday_key
  on public.weekly_schedule (location, laser, weekday);
create unique index if not exists availability_overrides_location_laser_date_key
  on public.availability_overrides (location, laser, date);

-- 4. free_laser() ─────────────────────────────────────────────────────────────
-- The laser a booking of [p_start, p_end) on p_date gets, or null when none.
-- A laser qualifies when it has started (active_from) and no active booking
-- overlaps (back-to-back is fine; p_skip = the booking being moved).
--   p_hours = true  (the site): it must also WORK then - its own hours: the
--                   date's exception, otherwise its weekday.
--   p_hours = false (the admin): any free laser; one that works then comes
--                   first, so a booking lands where somebody is.
-- Among equals p_prefer comes first, then the lowest number (Stari).
-- Mirrored on the client by pickFreeLaser() in lib/supabase.ts.
-- Only the booking functions below call it (they run as the owner).
drop function if exists public.free_laser(text, date, time, time, uuid, smallint);
create or replace function public.free_laser(
  p_location text,
  p_date     date,
  p_start    time,
  p_end      time,
  p_skip     uuid     default null,
  p_prefer   smallint default null,
  p_hours    boolean  default true
)
returns smallint
language sql
stable
set search_path = ''
as $$
  with candidate as (
    select l.laser,
           exists (
             select 1
               from jsonb_array_elements(coalesce(
                      (select o.windows from public.availability_overrides o
                        where o.location = l.location and o.laser = l.laser and o.date = p_date),
                      (select w.windows from public.weekly_schedule w
                        where w.location = l.location and w.laser = l.laser
                          and w.weekday = extract(isodow from p_date)::int - 1),
                      '[]'::jsonb)) x
              where (x->>'start')::int <= extract(hour from p_start)::int * 60 + extract(minute from p_start)::int
                and (x->>'end')::int   >= extract(hour from p_end)::int * 60 + extract(minute from p_end)::int
           ) as in_hours
      from public.lasers l
     where l.location = p_location
       and (l.active_from is null or l.active_from <= p_date)
       and not exists (
         select 1 from public.reservations r
          where r.location = l.location and r.laser = l.laser and r.date = p_date
            and r.status not in ('cancelled', 'blacklisted')
            and r.id is distinct from p_skip
            and r.start_time < p_end and r.end_time > p_start)
  )
  select laser
    from candidate
   where in_hours or not p_hours
   order by not in_hours, laser is distinct from p_prefer, laser
   limit 1;
$$;

revoke all on function public.free_laser(text, date, time, time, uuid, smallint, boolean) from public, anon, authenticated;

-- 5. public_busy_slots - the same rows, plus the laser ───────────────────────
-- The return type changes, so the function is re-created (inside this
-- transaction, so it never goes missing). The live site ignores the column.
do $$
declare
  v_def text := pg_get_functiondef('public.public_busy_slots(date,date,text)'::regprocedure);
begin
  if position('r.laser' in v_def) > 0 then
    raise notice 'public_busy_slots already returns the laser - skipped';
    return;
  end if;
  if position('least(p_to, p_from + 62)' in v_def) = 0
     or position($q$r.status not in ('cancelled', 'blacklisted')$q$ in v_def) = 0 then
    raise exception 'lasers_phase1.sql: public_busy_slots differs from sql/locations_phase1.sql - nothing was changed';
  end if;

  drop function public.public_busy_slots(date, date, text);
  create function public.public_busy_slots(p_from date, p_to date, p_location text default 'novi_sad')
  returns table (date date, start_time time, end_time time, status text, laser smallint)
  language sql stable security definer set search_path = ''
  as $f$
    select r.date, r.start_time, r.end_time, r.status, r.laser from public.reservations r
     where r.location = p_location
       and r.date between p_from and least(p_to, p_from + 62)
       and r.status not in ('cancelled', 'blacklisted');
  $f$;
  revoke all on function public.public_busy_slots(date, date, text) from public;
  grant execute on function public.public_busy_slots(date, date, text) to anon, authenticated;
end $$;

-- Helpers for editing a function's live text. Gone when the session ends.

-- The live text around a word - shown when something does not match, so the
-- difference can be seen without another query.
create or replace function pg_temp.near(p_def text, p_word text)
returns text
language sql
as $$
  select case when p_word is null or position(p_word in p_def) = 0 then ''
              else E'\nLive text there:\n' || substr(p_def, greatest(1, position(p_word in p_def) - 80), 900) end;
$$;

-- p_old as a pattern: spaces and line breaks may differ.
create or replace function pg_temp.pattern(p_old text)
returns text
language sql
as $$
  select regexp_replace(
           regexp_replace(btrim(p_old, E' \t\r\n'), '([].^$*+?(){}|[\\])', '\\\1', 'g'),
           '\s+', '\\s+', 'g');
$$;

-- Find-and-replace: p_old must occur exactly once, otherwise the whole file
-- stops (nothing changed) and shows the live text near p_near.
create or replace function pg_temp.swap(p_def text, p_old text, p_new text, p_what text, p_near text default null)
returns text
language plpgsql
as $$
declare
  v_pat text := pg_temp.pattern(p_old);
  v_n   integer;
begin
  select count(*) into v_n from regexp_matches(p_def, v_pat, 'g');
  if v_n <> 1 then
    raise exception 'lasers_phase1.sql: % - expected once in the live function, found % times. Nothing was changed.%',
      p_what, v_n, pg_temp.near(p_def, p_near);
  end if;
  return regexp_replace(p_def, v_pat, replace(p_new, '\', '\\'));
end $$;

-- The same for an extra that may be left out (a field in an answer): when
-- p_old is not there exactly once the text stays as it is.
create or replace function pg_temp.swap_soft(p_def text, p_old text, p_new text, p_what text)
returns text
language plpgsql
as $$
declare
  v_pat text := pg_temp.pattern(p_old);
  v_n   integer;
begin
  select count(*) into v_n from regexp_matches(p_def, v_pat, 'g');
  if v_n <> 1 then
    raise notice 'lasers_phase1.sql: % - not found, left out (optional)', p_what;
    return p_def;
  end if;
  return regexp_replace(p_def, v_pat, replace(p_new, '\', '\\'));
end $$;

-- Adds the laser to the one `insert into public.reservations (…) values (…);`
-- whatever other columns it lists.
create or replace function pg_temp.insert_laser(p_def text, p_value text, p_what text)
returns text
language plpgsql
as $$
declare
  v_pat  text := '(insert\s+into\s+public\.reservations\s*\()([^)]*)(\)\s*values\s*\()([^;]*)(\)\s*;)';
  v_n    integer;
  v_m    text[];
  v_cols text;
  v_vals text;
begin
  select count(*) into v_n from regexp_matches(p_def, v_pat, 'g');
  if v_n <> 1 then
    raise exception 'lasers_phase1.sql: % - expected one insert into reservations, found %. Nothing was changed.%',
      p_what, v_n, pg_temp.near(p_def, 'insert into public.reservations');
  end if;
  v_m := regexp_match(p_def, v_pat);
  if v_m[2] ~ '\mlaser\M' then
    raise exception 'lasers_phase1.sql: % - the insert already lists a laser. Nothing was changed.', p_what;
  end if;
  v_cols := rtrim(v_m[2], E' \t\r\n');
  v_vals := rtrim(v_m[4], E' \t\r\n');
  return replace(p_def,
    v_m[1] || v_m[2] || v_m[3] || v_m[4] || v_m[5],
    v_m[1] || v_cols || ', laser' || substr(v_m[2], length(v_cols) + 1)
      || v_m[3] || v_vals || ', ' || p_value || substr(v_m[4], length(v_vals) + 1) || v_m[5]);
end $$;

-- 6. public_create_booking ──────────────────────────────────────────────────
-- Before: the studio's hours, then refused when ANY active booking overlapped.
-- After:  refused only when no laser works then and is free; saved on that laser.
do $$
declare
  v_def text := pg_get_functiondef(
    'public.public_create_booking(uuid,text,text,text,text,date,time without time zone,uuid[],text,text,text)'::regprocedure);
begin
  if position('public.free_laser(' in v_def) > 0 then
    raise notice 'public_create_booking already uses free_laser - skipped';
    return;
  end if;

  v_def := pg_temp.swap(v_def,
    $q$v_m text[];$q$,
    $q$v_m text[]; v_laser smallint;$q$,
    'public_create_booking: variables');

  v_def := pg_temp.swap(v_def,
    $q$select windows into v_windows from public.availability_overrides
   where date = p_date and location = p_location;
  if not found then
    select windows into v_windows from public.weekly_schedule
     where weekday = extract(isodow from p_date)::int - 1 and location = p_location;
  end if;
  select exists (select 1 from jsonb_array_elements(coalesce(v_windows, '[]'::jsonb)) w
     where (w->>'start')::int <= v_start and (w->>'end')::int >= v_end) into v_fits;
  if not v_fits then return jsonb_build_object('status','slot_taken'); end if;$q$,
    $q$-- Working hours belong to each laser - free_laser() below checks them (sql/lasers_phase1.sql).$q$,
    'public_create_booking: studio hours');

  v_def := pg_temp.swap(v_def,
    $q$if exists (select 1 from public.reservations r
     where r.date = p_date and r.location = p_location
       and r.status not in ('cancelled','blacklisted')
       and r.start_time < make_time(v_end / 60, v_end % 60, 0) and r.end_time > p_start_time) then
    return jsonb_build_object('status','slot_taken');
  end if;$q$,
    $q$-- A laser that works then and is free for the whole time: Stari first, then Novi.
  v_laser := public.free_laser(p_location, p_date, p_start_time, make_time(v_end / 60, v_end % 60, 0));
  if v_laser is null then
    return jsonb_build_object('status','slot_taken');
  end if;$q$,
    'public_create_booking: overlap check');

  v_def := pg_temp.swap(v_def,
    $q$status, promo_code, location)$q$,
    $q$status, promo_code, location, laser)$q$,
    'public_create_booking: insert columns');

  v_def := pg_temp.swap(v_def,
    $q$v_duration, 'confirmed', v_promo, p_location);$q$,
    $q$v_duration, 'confirmed', v_promo, p_location, v_laser);$q$,
    'public_create_booking: insert values');

  execute v_def;  -- same signature: grants stay
end $$;

-- 7. admin_create_booking - gains p_laser (optional) ────────────────────────
-- Any time of day, as before. A laser that works then comes first, p_laser
-- (the one open in the admin) before the other. Old calls without it work.
do $$
declare
  v_def text;
begin
  if to_regprocedure('public.admin_create_booking(uuid,text,text,text,text,date,time without time zone,uuid[],boolean,text,text,smallint)') is not null then
    raise notice 'admin_create_booking already takes p_laser - skipped';
    return;
  end if;
  v_def := pg_get_functiondef(
    'public.admin_create_booking(uuid,text,text,text,text,date,time without time zone,uuid[],boolean,text,text)'::regprocedure);

  v_def := pg_temp.swap(v_def,
    $q$p_notes text)$q$,
    $q$p_notes text, p_laser smallint DEFAULT NULL::smallint)$q$,
    'admin_create_booking: arguments', 'p_notes');

  v_def := pg_temp.swap(v_def,
    $q$v_end_time time;$q$,
    $q$v_end_time time;
  v_laser    smallint;$q$,
    'admin_create_booking: variables', 'declare');

  v_def := pg_temp.swap_soft(v_def,
    $q$'total_duration', v_existing.total_duration);$q$,
    $q$'total_duration', v_existing.total_duration,
        'laser', v_existing.laser);$q$,
    'admin_create_booking: retry answer');

  v_def := pg_temp.swap(v_def,
    $q$select * into v_clash from public.reservations o
   where o.date = p_date and o.location = p_location$q$,
    $q$-- (sql/lasers_phase1.sql) A free laser: one that works then first, p_laser
  -- before the other. Only when none is free, the booking in the way is
  -- looked up for the message.
  v_laser := public.free_laser(p_location, p_date, p_start_time, v_end_time, null, p_laser, false);
  select * into v_clash from public.reservations o
   where v_laser is null and o.date = p_date and o.location = p_location$q$,
    'admin_create_booking: overlap check', 'v_clash');

  v_def := pg_temp.swap(v_def,
    $q$'clash_end',   to_char(v_clash.end_time, 'HH24:MI'));
  end if;$q$,
    $q$'clash_end',   to_char(v_clash.end_time, 'HH24:MI'));
  end if;
  if v_laser is null then  -- no laser has started yet
    return jsonb_build_object('status', 'slot_taken');
  end if;$q$,
    'admin_create_booking: no laser at all', 'clash_end');

  v_def := pg_temp.insert_laser(v_def, 'v_laser', 'admin_create_booking: insert');

  v_def := pg_temp.swap_soft(v_def,
    $q$'total_duration', v_duration);$q$,
    $q$'total_duration', v_duration,
    'laser',          v_laser);$q$,
    'admin_create_booking: answer');

  execute v_def;  -- creates the 12-argument version next to the old one
  drop function public.admin_create_booking(uuid, text, text, text, text, date, time, uuid[], boolean, text, text);
end $$;

revoke all on function public.admin_create_booking(uuid, text, text, text, text, date, time, uuid[], boolean, text, text, smallint) from public, anon;
grant execute on function public.admin_create_booking(uuid, text, text, text, text, date, time, uuid[], boolean, text, text, smallint) to authenticated;

-- 8. admin_move_reservation ─────────────────────────────────────────────────
-- Before: refused when ANY active booking overlapped the new time.
-- After:  a free laser - one that works then first, its own before the other;
--         refused only when none is free. Answers with the laser.
do $$
declare
  v_def text := pg_get_functiondef('public.admin_move_reservation(uuid,date,time without time zone)'::regprocedure);
begin
  if position('public.free_laser(' in v_def) > 0 then
    raise notice 'admin_move_reservation already uses free_laser - skipped';
    return;
  end if;

  v_def := pg_temp.swap(v_def,
    $q$v_new_end time;$q$,
    $q$v_new_end time;
  v_laser   smallint;$q$,
    'admin_move_reservation: variables', 'declare');

  v_def := pg_temp.swap(v_def,
    $q$select * into v_clash from public.reservations o
   where o.date = p_date and o.location = r.location and o.id <> r.id$q$,
    $q$-- (sql/lasers_phase1.sql) A free laser: one that works then first, its own before the other.
  v_laser := public.free_laser(r.location, p_date, p_start_time, v_new_end, r.id, r.laser, false);
  select * into v_clash from public.reservations o
   where v_laser is null and o.date = p_date and o.location = r.location and o.id <> r.id$q$,
    'admin_move_reservation: overlap check', 'v_clash');

  v_def := pg_temp.swap(v_def,
    $q$'clash_end',   to_char(v_clash.end_time, 'HH24:MI'));
  end if;$q$,
    $q$'clash_end',   to_char(v_clash.end_time, 'HH24:MI'));
  end if;
  if v_laser is null then  -- no laser has started by that day
    return jsonb_build_object('status', 'slot_taken');
  end if;$q$,
    'admin_move_reservation: no laser at all', 'clash_end');

  -- The move's one update also sets the laser, whatever else it sets.
  v_def := pg_temp.swap(v_def,
    $q$update public.reservations set$q$,
    $q$update public.reservations set laser = v_laser,$q$,
    'admin_move_reservation: update', 'update public.reservations');

  v_def := pg_temp.swap_soft(v_def,
    $q$'location',       r.location,$q$,
    $q$'location',       r.location,
    'laser',          v_laser,
    'old_laser',      r.laser,$q$,
    'admin_move_reservation: answer');

  execute v_def;  -- same signature: grants stay
end $$;

-- 9. admin_set_laser() ──────────────────────────────────────────────────────
-- Puts a booking on another laser at the same day and time (admin, the
-- reservation's details). Same day lock as every booking; refused when that
-- laser is taken then or has not started yet. Like every admin booking it may
-- fall outside that laser's hours. No email - the client's term is the same.
create or replace function public.admin_set_laser(p_id uuid, p_laser smallint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  r       public.reservations%rowtype;
  v_from  date;
  v_clash public.reservations%rowtype;
begin
  if not public.is_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if p_id is null or p_laser is null then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  select * into r from public.reservations where id = p_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if r.status in ('cancelled', 'blacklisted') then
    return jsonb_build_object('status', 'inactive');
  end if;
  if r.laser = p_laser then
    return jsonb_build_object('status', 'unchanged', 'laser', r.laser);
  end if;

  select l.active_from into v_from from public.lasers l where l.location = r.location and l.laser = p_laser;
  if not found then
    return jsonb_build_object('status', 'invalid_input');
  end if;
  if v_from is not null and v_from > r.date then
    return jsonb_build_object('status', 'laser_off');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ils_booking:' || r.location || ':' || r.date::text, 0));

  select * into v_clash from public.reservations o
   where o.location = r.location and o.laser = p_laser and o.date = r.date and o.id <> r.id
     and o.status not in ('cancelled', 'blacklisted')
     and o.start_time < r.end_time and o.end_time > r.start_time
   order by o.start_time
   limit 1;
  if found then
    return jsonb_build_object(
      'status',      'slot_taken',
      'clash_name',  v_clash.customer_name,
      'clash_start', to_char(v_clash.start_time, 'HH24:MI'),
      'clash_end',   to_char(v_clash.end_time, 'HH24:MI'));
  end if;

  update public.reservations set laser = p_laser where id = r.id;
  return jsonb_build_object('status', 'ok', 'id', r.id, 'laser', p_laser);
end; $$;

revoke all on function public.admin_set_laser(uuid, smallint) from public, anon;
grant execute on function public.admin_set_laser(uuid, smallint) to authenticated;

commit;

-- The API picks up the changed function arguments and columns.
notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- Check after running (read-only):
--   select * from public.lasers order by location, laser;
--     → novi_sad 1 Stari, sombor 1 Laser
--   select laser, count(*) from public.reservations group by laser;      → only 1
--   select location, laser, count(*) from public.weekly_schedule group by 1, 2;  → only laser 1
-- ─────────────────────────────────────────────────────────────────────────────
