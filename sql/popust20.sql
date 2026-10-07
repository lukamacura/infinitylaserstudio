-- ─────────────────────────────────────────────────────────────────────────────
-- Link discount: the code `popust20` (−20%) - see LINK_PROMO_CODE in lib/pricing.ts.
--
-- The link ?promo=popust20 opens the booking form with the code applied. It is
-- for anyone, new or returning client. On a single session it is stored as the
-- reservation's promo code; on a bundle the cut is already in the bundle total
-- (paket-N-<total>), so the database sees an ordinary bundle code.
--
-- The only change to public_create_booking is the `popust20` branch in step
-- "promo codes"; the rest is the live definition as of 2026-10-06. Purely
-- additive: the old site never sends this code, so it is safe to run first.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.public_create_booking(p_id uuid, p_name text, p_email text, p_phone text, p_customer_note text, p_date date, p_start_time time without time zone, p_service_ids uuid[], p_promo_code text, p_notes text, p_location text DEFAULT 'novi_sad'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_email text := trim(coalesce(p_email, ''));
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_promo text := nullif(lower(trim(coalesce(p_promo_code, ''))), '');
  v_now timestamp := now() at time zone 'Europe/Belgrade';
  v_today date := (now() at time zone 'Europe/Belgrade')::date;
  v_existing public.reservations%rowtype;
  v_ids uuid[]; v_count integer; v_sum integer; v_returning boolean;
  v_duration integer; v_start integer; v_end integer; v_windows jsonb; v_fits boolean; v_m text[];
begin
  select * into v_existing from public.reservations where id = p_id;
  if found then
    if lower(trim(v_existing.customer_email)) = lower(v_email) then
      return jsonb_build_object('status','ok','id',v_existing.id,
        'end_time', to_char(v_existing.end_time,'HH24:MI'),
        'total_duration', v_existing.total_duration,
        'returning', exists (select 1 from public.reservations
           where lower(trim(customer_email)) = lower(v_email) and status = 'confirmed' and id <> p_id));
    end if;
    return jsonb_build_object('status','invalid_input');
  end if;

  if p_id is null or p_date is null or p_start_time is null
     or p_location is null or p_location not in ('novi_sad', 'sombor')
     or length(v_name) = 0 or length(v_name) > 120
     or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 200
     or length(regexp_replace(v_phone, '\D', '', 'g')) < 8 or length(v_phone) > 40
     or length(coalesce(p_customer_note, '')) > 1000
     or length(coalesce(p_notes, '')) > 500
     or extract(minute from p_start_time)::int % 10 <> 0
     or extract(second from p_start_time) <> 0 then
    return jsonb_build_object('status','invalid_input');
  end if;

  select array_agg(distinct x) into v_ids from unnest(p_service_ids) x;
  if v_ids is null or cardinality(v_ids) = 0 or cardinality(v_ids) > 20 then
    return jsonb_build_object('status','invalid_input');
  end if;
  select count(*), coalesce(sum(service_duration), 0) into v_count, v_sum from public.services where id = any (v_ids);
  if v_count <> cardinality(v_ids) then return jsonb_build_object('status','invalid_input'); end if;

  if p_date < v_today or p_date > v_today + 15 or (p_date + p_start_time) <= v_now then
    return jsonb_build_object('status','too_late');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ils_booking:' || p_location || ':' || p_date::text, 0));

  v_returning := exists (select 1 from public.reservations
     where lower(trim(customer_email)) = lower(v_email) and status = 'confirmed');

  v_sum := v_sum + case when cardinality(v_ids) >= 2 then 5 else 0 end + case when v_returning then 0 else 10 end;
  v_duration := ceil(v_sum / 10.0)::int * 10;
  v_start := extract(hour from p_start_time)::int * 60 + extract(minute from p_start_time)::int;
  v_end := v_start + v_duration;

  select windows into v_windows from public.availability_overrides
   where date = p_date and location = p_location;
  if not found then
    select windows into v_windows from public.weekly_schedule
     where weekday = extract(isodow from p_date)::int - 1 and location = p_location;
  end if;
  select exists (select 1 from jsonb_array_elements(coalesce(v_windows, '[]'::jsonb)) w
     where (w->>'start')::int <= v_start and (w->>'end')::int >= v_end) into v_fits;
  if not v_fits then return jsonb_build_object('status','slot_taken'); end if;

  if exists (select 1 from public.reservations r
     where r.date = p_date and r.location = p_location
       and r.status not in ('cancelled','blacklisted')
       and r.start_time < make_time(v_end / 60, v_end % 60, 0) and r.end_time > p_start_time) then
    return jsonb_build_object('status','slot_taken');
  end if;

  if v_promo is not null then
    if v_promo = 'student20' then
      if v_returning then return jsonb_build_object('status','invalid_promo','reason','student_not_first'); end if;
    elsif v_promo = 'popust20' then
      null;  -- link discount, open to everyone
    elsif v_promo ~ '^paket-\d+-\d+$' then
      v_m := regexp_match(v_promo, '^paket-(\d+)-(\d+)$');
      if v_m[1]::int not in (3,6,8,10) or v_m[2]::int <= 0 then return jsonb_build_object('status','invalid_promo'); end if;
    elsif v_promo ~ '^paket-\d+-\d+-r$' then
      if public.bundle_sessions_left(v_email, left(v_promo, -2), p_location) <= 0 then
        return jsonb_build_object('status','invalid_promo','reason','bundle_used');
      end if;
    else
      return jsonb_build_object('status','invalid_promo');
    end if;
  end if;

  insert into public.reservations (id, customer_name, customer_email, customer_phone, customer_note, notes,
    date, start_time, end_time, total_duration, status, promo_code, location)
  values (p_id, v_name, v_email, v_phone, nullif(trim(coalesce(p_customer_note, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''), p_date, p_start_time, make_time(v_end / 60, v_end % 60, 0),
    v_duration, 'confirmed', v_promo, p_location);
  insert into public.reservation_services (reservation_id, service_id) select p_id, unnest(v_ids);

  return jsonb_build_object('status','ok','id',p_id,
    'end_time', lpad((v_end / 60)::text, 2, '0') || ':' || lpad((v_end % 60)::text, 2, '0'),
    'total_duration', v_duration, 'returning', v_returning);
end; $function$;
