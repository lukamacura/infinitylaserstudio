-- ─────────────────────────────────────────────────────────────────────────────
-- A client cancels their own appointment with the link in the confirmation
-- email (/otkazivanje, app/api/reservation-cancel).
--
-- client_cancel_reservation(id, confirm):
--   confirm = false  only says what the page should show (nothing changes) -
--                    mail scanners open links on their own, so opening the
--                    page must never cancel anything;
--   confirm = true   cancels, when the client presses the button.
-- Only the server calls it (service_role): the link is checked there, so
-- nobody can cancel someone else's appointment by guessing an id.
--
-- Cancelling is always possible until the appointment starts. Less than 24 h
-- before it is a late cancellation (sql: late_cancel): the policy
-- (/uslovi-koriscenja) charges 50% of the treatment at the next visit unless
-- the reason is health. Staff see it in three places:
--   * the cancelled booking's note (reservations.notes),
--   * the top of the client's card (kartoni.note),
--   * the client's next booking in the admin panel, with the amount.
-- The 24 h are counted on the database clock, in Belgrade time, across DST.
--
-- Purely additive (two columns with defaults, one function) - safe while the
-- old code is live.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.reservations
  add column if not exists client_cancelled_at timestamptz,
  add column if not exists late_cancel boolean not null default false;

create or replace function public.client_cancel_reservation(p_id uuid, p_confirm boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  r       public.reservations%rowtype;
  v_start timestamptz;
  v_late  boolean;
  v_info  jsonb;
  v_stamp text;
  v_line  text;
  v_card  text;
begin
  if p_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if coalesce(p_confirm, false) then
    select * into r from public.reservations where id = p_id for update;
  else
    select * into r from public.reservations where id = p_id;
  end if;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- The appointment as a moment in time: its date and hour are Belgrade's.
  v_start := (r.date + r.start_time) at time zone 'Europe/Belgrade';
  v_late  := v_start - now() < interval '24 hours';

  v_info := jsonb_build_object(
    'id',             r.id,
    'customer_name',  r.customer_name,
    'customer_email', trim(coalesce(r.customer_email, '')),
    'location',       r.location,
    'date',           r.date,
    'start_time',     to_char(r.start_time, 'HH24:MI'),
    'end_time',       to_char(r.end_time, 'HH24:MI'),
    'total_duration', r.total_duration,
    'services',       coalesce((
      select jsonb_agg(s.name order by s.sort_order, s.name)
        from public.reservation_services rs
        join public.services s on s.id = rs.service_id
       where rs.reservation_id = r.id), '[]'::jsonb));

  if r.status = 'cancelled' then
    return v_info || jsonb_build_object('status', 'already', 'late', r.late_cancel);
  end if;
  if r.status not in ('confirmed', 'pending') then
    return v_info || jsonb_build_object('status', 'inactive');
  end if;
  if v_start <= now() then
    return v_info || jsonb_build_object('status', 'past');
  end if;
  if not coalesce(p_confirm, false) then
    return v_info || jsonb_build_object('status', 'open', 'late', v_late);
  end if;

  -- ── Cancel ─────────────────────────────────────────────────────────────────
  v_stamp := to_char(now() at time zone 'Europe/Belgrade', 'FMDD.FMMM. "u" HH24:MI');
  v_line  := 'Otkazano preko linka iz emaila ' || v_stamp || case when v_late
    then ', manje od 24 h pre termina. Pri sledećem dolasku naplatiti 50% cene ovog tretmana, osim ako je razlog zdravstveni.'
    else '.' end;

  update public.reservations
     set status              = 'cancelled',
         client_cancelled_at = now(),
         late_cancel         = v_late,
         notes               = v_line || coalesce(e'\n' || nullif(trim(notes), ''), '')
   where id = r.id;

  -- On the client's card too, on top of the note. A problem here must never
  -- undo the cancellation: the booking's note and the admin panel have it anyway.
  if v_late and r.client_id is not null then
    begin
      v_card := 'Kasno otkazivanje: termin ' || to_char(r.date, 'FMDD.FMMM.YYYY.') || ' u '
        || to_char(r.start_time, 'HH24:MI') || ' otkazan ' || v_stamp
        || ' (manje od 24 h ranije). Pri sledećem dolasku naplatiti 50% cene tog tretmana, osim ako je razlog zdravstveni.';
      insert into public.kartoni (client_id) values (r.client_id) on conflict (client_id) do nothing;
      update public.kartoni
         set note = v_card || case when trim(note) <> '' then e'\n\n' || note else '' end
       where client_id = r.client_id
         and length(v_card) + length(note) + 2 <= 5000;
    exception when others then
      raise warning 'client_cancel_reservation: card note not written for %: %', r.id, sqlerrm;
    end;
  end if;

  return v_info || jsonb_build_object('status', 'cancelled', 'late', v_late);
end; $$;

revoke all on function public.client_cancel_reservation(uuid, boolean) from public, anon, authenticated;
grant execute on function public.client_cancel_reservation(uuid, boolean) to service_role;
