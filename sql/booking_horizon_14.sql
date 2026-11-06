-- 2026-11-06: public booking window 21 → 14 days (reverts sql/booking_horizon_21.sql).
-- Apply AFTER the client with PUBLIC_HORIZON_DAYS = 14 is deployed, otherwise
-- visitors still on the 21-day site get `too_late` for days 15–21.
-- Rewrites only the horizon line of the live public_create_booking, keeping the
-- rest of the function, its SECURITY DEFINER, search_path and grants unchanged.
-- The client offers today … today+13; the server keeps 2 days of slack (+15).
do $$
declare
  v_def text := pg_get_functiondef('public.public_create_booking(uuid,text,text,text,text,date,time without time zone,uuid[],text,text,text)'::regprocedure);
begin
  if position('v_today + 22' in v_def) = 0 then
    raise exception 'horizon line not found - function changed, edit by hand';
  end if;
  execute replace(v_def, 'v_today + 22', 'v_today + 15');
end $$;
