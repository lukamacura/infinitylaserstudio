-- Infinity paketići (/paketici) - orders for the New Year gift box.
-- Additive: one new table and three functions; nothing existing is touched.
--
-- Orders come in only through app/api/paketici, which recomputes the price
-- from service_prices and calls create_gift_order with the service-role key.
-- The browser can read just how many boxes are left (gift_orders_stock).
-- Admins can read and update orders (status, paid) through their session.

create table if not exists public.gift_orders (
  id              uuid primary key default gen_random_uuid(),
  -- "Paketić br. 7" - the number the buyer is told.
  order_no        integer generated always as identity unique,
  created_at      timestamptz not null default now(),
  status          text not null default 'nova'
                  check (status in ('nova', 'potvrdjena', 'poslata', 'preuzeta', 'otkazana')),
  version         text not null check (version in ('zenska', 'muska')),
  mode            text not null check (mode in ('iznos', 'regije', 'paket')),
  -- "Noge + Intima × 6 tretmana" / "Iznos 50.000 RSD"
  summary         text not null,
  sessions        integer,
  regions         text[] not null default '{}',
  bonus           text,
  bonus_value     integer,
  total           integer not null check (total >= 12000),
  occasion        text not null check (occasion in ('nova_godina', 'rodjendan', 'bez')),
  dedication      text not null default '' check (length(dedication) <= 400),
  delivery        text not null check (delivery in ('novi_sad', 'posta', 'studio')),
  payment         text not null check (payment in ('pouzece', 'kartica')),
  paid            boolean not null default false,
  customer_name   text not null check (length(customer_name) between 2 and 120),
  customer_phone  text not null check (length(customer_phone) between 6 and 30),
  customer_email  text check (length(customer_email) <= 200),
  address         text check (length(address) <= 200),
  city            text check (length(city) <= 100),
  postal_code     text check (length(postal_code) <= 12),
  delivery_note   text check (length(delivery_note) <= 400)
);

alter table public.gift_orders enable row level security;

drop policy if exists gift_orders_admin_select on public.gift_orders;
create policy gift_orders_admin_select on public.gift_orders
  for select to authenticated using (public.is_admin());

drop policy if exists gift_orders_admin_update on public.gift_orders;
create policy gift_orders_admin_update on public.gift_orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- How many boxes are made. Mirrored in lib/paketici.ts (GIFT_LIMIT).
create or replace function public.gift_orders_limit()
returns integer language sql immutable as $$ select 50 $$;

-- Boxes left - every order counts until it is cancelled.
create or replace function public.gift_orders_stock()
returns table (total integer, remaining integer)
language sql stable security definer set search_path = public as $$
  select public.gift_orders_limit(),
         greatest(0, public.gift_orders_limit()
           - (select count(*) from public.gift_orders where status <> 'otkazana'))::integer;
$$;

revoke all on function public.gift_orders_stock() from public;
grant execute on function public.gift_orders_stock() to anon, authenticated, service_role;

-- Saves one order unless the boxes are gone. The advisory lock makes the
-- count-then-insert one step, so two orders at the same moment can't both
-- take the 50th box. Raises 'sold_out' when none are left.
create or replace function public.create_gift_order(p jsonb)
returns table (order_no integer, remaining integer)
language plpgsql security definer set search_path = public as $$
declare
  v_taken integer;
  v_no    integer;
begin
  perform pg_advisory_xact_lock(hashtext('gift_orders_limit'));
  select count(*) into v_taken from public.gift_orders where status <> 'otkazana';
  if v_taken >= public.gift_orders_limit() then
    raise exception 'sold_out';
  end if;

  insert into public.gift_orders (
    version, mode, summary, sessions, regions, bonus, bonus_value, total,
    occasion, dedication, delivery, payment,
    customer_name, customer_phone, customer_email,
    address, city, postal_code, delivery_note
  ) values (
    p->>'version', p->>'mode', p->>'summary', (p->>'sessions')::integer,
    coalesce(array(select jsonb_array_elements_text(p->'regions')), '{}'),
    p->>'bonus', (p->>'bonus_value')::integer, (p->>'total')::integer,
    p->>'occasion', coalesce(p->>'dedication', ''), p->>'delivery', p->>'payment',
    p->>'customer_name', p->>'customer_phone', nullif(p->>'customer_email', ''),
    nullif(p->>'address', ''), nullif(p->>'city', ''), nullif(p->>'postal_code', ''),
    nullif(p->>'delivery_note', '')
  )
  returning gift_orders.order_no into v_no;

  return query select v_no, (public.gift_orders_limit() - v_taken - 1)::integer;
end;
$$;

-- Only the server (service role) may create orders - it is the one that
-- checks the price against service_prices.
revoke all on function public.create_gift_order(jsonb) from public, anon, authenticated;
grant execute on function public.create_gift_order(jsonb) to service_role;
