-- ─────────────────────────────────────────────────────────────────────────────
-- Kartoni for everyone who has ever booked. Run after the first part of
-- sql/kartoni.sql. Safe to run again: it only picks up what is still missing,
-- and that includes a card or row someone deleted by hand.
--
-- Every booking gets its row, past ones too, exactly as a new booking would:
-- date, studio and regions. Past energies are on paper, so those cells stay
-- empty until someone copies them over.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- Oldest first, so a client's first booking decides their card.
do $$
declare r record;
begin
  for r in
    select id, customer_name, customer_phone, customer_email
      from public.reservations
     where client_id is null
     order by created_at nulls first, id
  loop
    update public.reservations
       set client_id = public.karton_resolve_client(r.customer_name, r.customer_phone, r.customer_email)
     where id = r.id;
  end loop;
end $$;

-- The spelling from the client's latest booking, unless the card was edited.
-- An email typed into the name field only counts if there is nothing better.
update public.clients c
   set name = left(trim(x.customer_name), 120)
  from (
    select distinct on (client_id) client_id, customer_name
      from public.reservations
     where client_id is not null
     order by client_id, (customer_name like '%@%'), created_at desc nulls last, id
  ) x
 where c.id = x.client_id
   and not exists (select 1 from public.kartoni k where k.client_id = c.id)
   and c.name is distinct from left(trim(x.customer_name), 120);

-- Which regions to offer on the card: what they mostly book.
update public.clients c
   set gender = x.gender
  from (
    select r.client_id, mode() within group (order by s.gender) as gender
      from public.reservations r
      join public.reservation_services rs on rs.reservation_id = r.id
      join public.services s on s.id = rs.service_id
     where r.client_id is not null
     group by r.client_id
  ) x
 where c.id = x.client_id and c.gender is null;

insert into public.kartoni (client_id)
select id from public.clients
on conflict (client_id) do nothing;

do $$
declare r record;
begin
  for r in
    select res.id from public.reservations res
     where res.status not in ('cancelled', 'blacklisted')
       and not exists (select 1 from public.karton_rows kr where kr.reservation_id = res.id)
  loop
    perform public.karton_sync_reservation(r.id);
  end loop;
end $$;

commit;
