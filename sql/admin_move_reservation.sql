-- ─────────────────────────────────────────────────────────────────────────────
-- Moving an appointment from the admin calendar (drag, or "Pomeri termin").
--
-- The whole move happens here, in one transaction:
--   * only an admin (admin_users) may call it,
--   * it takes the same per-studio, per-day lock as public_create_booking, so a
--     client booking from the site can never get the same minute meanwhile,
--   * a time that overlaps another active appointment is refused,
--   * the appointment keeps its length (total_duration) and its studio.
-- Working hours are not enforced: the admin may book outside them, the same as
-- when creating a reservation (components/AdminReservationModal.tsx).
--
-- It returns the old and the new time plus who the client is, so the email
-- (app/api/reservation-move) is built from what the database actually did.
-- Karton rows follow the new date through the reservations_karton_update
-- trigger. Prices do not change: they are computed from created_at.
--
-- Purely additive (one new function) - safe while the old code is live.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_move_reservation(p_id uuid, p_date date, p_start_time time)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  r         public.reservations%rowtype;
  v_clash   public.reservations%rowtype;
  v_start   integer;
  v_end     integer;
  v_new_end time;
begin
  if not public.is_admin() then
    return jsonb_build_object('status', 'forbidden');
  end if;

  if p_id is null or p_date is null or p_start_time is null
     or extract(second from p_start_time) <> 0
     or extract(minute from p_start_time)::int % 10 <> 0 then
    return jsonb_build_object('status', 'invalid_input');
  end if;

  select * into r from public.reservations where id = p_id for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if r.status in ('cancelled', 'blacklisted') then
    return jsonb_build_object('status', 'inactive');
  end if;

  v_start := extract(hour from p_start_time)::int * 60 + extract(minute from p_start_time)::int;
  v_end   := v_start + r.total_duration;
  if r.total_duration <= 0 or v_end >= 24 * 60 then
    return jsonb_build_object('status', 'invalid_input');
  end if;
  v_new_end := make_time(v_end / 60, v_end % 60, 0);

  if r.date = p_date and r.start_time = p_start_time then
    return jsonb_build_object('status', 'unchanged');
  end if;

  -- Same key as public_create_booking: nobody else books this studio's day meanwhile.
  perform pg_advisory_xact_lock(hashtextextended('ils_booking:' || r.location || ':' || p_date::text, 0));

  select * into v_clash from public.reservations o
   where o.date = p_date and o.location = r.location and o.id <> r.id
     and o.status not in ('cancelled', 'blacklisted')
     and o.start_time < v_new_end and o.end_time > p_start_time
   order by o.start_time
   limit 1;
  if found then
    return jsonb_build_object(
      'status',      'slot_taken',
      'clash_name',  v_clash.customer_name,
      'clash_start', to_char(v_clash.start_time, 'HH24:MI'),
      'clash_end',   to_char(v_clash.end_time, 'HH24:MI'));
  end if;

  update public.reservations
     set date = p_date, start_time = p_start_time, end_time = v_new_end
   where id = r.id;

  return jsonb_build_object(
    'status',         'ok',
    'id',             r.id,
    'customer_name',  r.customer_name,
    'customer_email', trim(coalesce(r.customer_email, '')),
    'location',       r.location,
    'total_duration', r.total_duration,
    'old_date',       r.date,
    'old_start',      to_char(r.start_time, 'HH24:MI'),
    'date',           p_date,
    'start_time',     to_char(p_start_time, 'HH24:MI'),
    'end_time',       to_char(v_new_end, 'HH24:MI'),
    -- Only an appointment still ahead is worth an email to the client.
    'upcoming',       (p_date + p_start_time) > (now() at time zone 'Europe/Belgrade'),
    'services',       coalesce((
      select jsonb_agg(s.name order by s.sort_order, s.name)
        from public.reservation_services rs
        join public.services s on s.id = rs.service_id
       where rs.reservation_id = r.id), '[]'::jsonb));
end; $$;

revoke all on function public.admin_move_reservation(uuid, date, time) from public, anon;
grant execute on function public.admin_move_reservation(uuid, date, time) to authenticated, service_role;
