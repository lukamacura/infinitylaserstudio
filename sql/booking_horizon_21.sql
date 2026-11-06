-- 2026-11-06: public booking window 14 → 21 days (lib/availability.ts PUBLIC_HORIZON_DAYS).
-- Rewrites only the horizon line of the live public_create_booking, keeping the
-- rest of the function, its SECURITY DEFINER, search_path and grants unchanged.
-- The client offers today … today+20; the server keeps 2 days of slack (+22),
-- the same as before (today+13 offered, +15 allowed).
do $$
declare
  v_def text := pg_get_functiondef('public.public_create_booking(uuid,text,text,text,text,date,time without time zone,uuid[],text,text,text)'::regprocedure);
begin
  if position('v_today + 15' in v_def) = 0 then
    raise exception 'horizon line not found - function changed, edit by hand';
  end if;
  execute replace(v_def, 'v_today + 15', 'v_today + 22');
end $$;
