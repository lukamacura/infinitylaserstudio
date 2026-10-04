-- ─────────────────────────────────────────────────────────────────────────────
-- Most picked regions - the booking form shows them first, marked "Najčešće".
--
--   public_popular_services()  — per gender, the active treatments ranked by
--                                how often they were booked in the last 90 days
--
-- Purely additive: no table, policy or existing function is changed. Returns
-- only a service id and its rank - no counts, no client data. Until this runs
-- the form simply shows the list in its usual order.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create or replace function public.public_popular_services()
returns table (service_id uuid, rank int)
language sql
stable
security definer
set search_path = ''
as $$
  select ranked.id, ranked.rank::int
  from (
    select s.id,
           row_number() over (partition by s.gender order by count(*) desc, s.sort_order) as rank
    from public.reservation_services rs
    join public.reservations r on r.id = rs.reservation_id
    join public.services s     on s.id = rs.service_id
    where s.active
      and r.status not in ('cancelled', 'blacklisted')
      and r.created_at > now() - interval '90 days'
    group by s.id, s.gender, s.sort_order
    -- A region picked only once or twice is not "most picked" yet.
    having count(*) >= 3
  ) ranked
  where ranked.rank <= 6;
$$;
revoke all on function public.public_popular_services() from public;
grant execute on function public.public_popular_services() to anon, authenticated;

commit;
