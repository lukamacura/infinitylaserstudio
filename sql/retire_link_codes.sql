-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-11-08: the luka20 and halloween20 links are switched off.
--
-- public_create_booking stops accepting them, so a new booking can only carry
-- popust20 or nausnice. Bookings already made with them keep the code and
-- their −20% (RETIRED_LINK_PROMO_CODES in lib/pricing.ts prices them).
--
-- Apply AFTER the code that no longer sends them is live: until then the old
-- site still turns a luka20/halloween20 link into the code, and the booking
-- would be refused as invalid_promo.
--
-- Changes only that one list in the live definition - read and rewritten in
-- place, so nothing else in the function can drift (see sql/link_codes.sql
-- for the whole function). CREATE OR REPLACE keeps its grants.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef(
    'public.public_create_booking(uuid,text,text,text,text,date,time without time zone,uuid[],text,text,text)'::regprocedure);
  v_new := replace(v_def,
    $q$v_promo in ('popust20', 'luka20', 'halloween20', 'nausnice')$q$,
    $q$v_promo in ('popust20', 'nausnice')$q$);
  if v_new = v_def then
    raise exception 'public_create_booking: the link code list was not found - nothing changed';
  end if;
  execute v_new;
end $$;
