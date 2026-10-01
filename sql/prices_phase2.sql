-- ─────────────────────────────────────────────────────────────────────────────
-- Per-studio prices - PHASE 2. Run right AFTER the price-aware code is live.
--
-- • Novi Sad's new price list starts now. Bookings made before this moment
--   keep their old prices in finances and stats; bookings made after it use
--   the new ones. Sombor's prices do not change.
-- • Adds the men's "Noge" and "1/2 nogu" treatments.
-- • services.price is no longer read by the new code; it is set to the
--   current Novi Sad price so it never shows anything stale.
--
-- Do NOT run this before the deploy: the old code would show the two new men's
-- treatments with the wrong (single) price.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- 1. New Novi Sad prices (from now on) ─────────────────────────────────────────
with new_prices (id, price) as (values
  -- Žene
  ('192c1b78-4319-44e7-b232-b7d66e53def6'::uuid, 10900), -- Celo telo
  ('34b6ce8a-0f09-49ac-8032-78c839373231'::uuid,  1200), -- Nausnice
  ('ddcd0380-61d5-4ea5-9ce5-6d0b5aecc967'::uuid,  1200), -- Brada
  ('56d667c7-0db7-496c-b264-95e186f4afe4'::uuid,  2500), -- Celo lice
  ('97de7cdd-581c-49af-8dd7-0a8422840349'::uuid,  2900), -- Pazuh
  ('2ccd6274-4523-484e-b9e4-a3a82457a1ee'::uuid,  4000), -- Ruke
  ('838599f2-5e55-4908-a1ce-6753785b525c'::uuid,  2500), -- 1/2 ruku
  ('d2bd7648-7bdc-4f9b-83ac-f1b4efaea914'::uuid,  5100), -- Noge
  ('db0737b7-0ee0-46d2-8d63-64d56266f39b'::uuid,  2900), -- 1/2 nogu
  ('73de4f69-b149-4392-93d8-6aca50e9673b'::uuid,  4300), -- Intima
  ('7f97d75d-547f-470d-aa65-313d9f9e4ec9'::uuid,  7300), -- Noge + Intima
  ('8bc9ac1b-9c44-49ce-a34c-c29afad42d40'::uuid,  2000), -- Nausnice i brada
  -- Muškarci
  ('808508d9-fc02-422a-a289-232d13dd5ae2'::uuid,  1900), -- 1/2 Lica
  ('549d1d3b-1c5a-431b-8463-b54850776f22'::uuid,  2900), -- Lice
  ('709af343-e190-41e6-b0b9-9c1aa094898a'::uuid,  2900), -- Pazuh
  ('3fdcb492-ac72-4b2e-923c-d7160df7ff4c'::uuid,  4900), -- Ruke
  ('b84e5169-3d34-4c56-bd30-4af4989cbb26'::uuid,  3900), -- 1/2 ruku
  ('a81d9727-fe86-48fe-8e41-c74f6dd5c1db'::uuid,  3900), -- Grudi
  ('af9ffd50-de67-448f-ac50-fccd282ccde1'::uuid,  3900), -- Stomak
  ('b0136851-5417-4bb3-98ca-73374e12d215'::uuid,  3900), -- 1/2 Leđa
  ('6170dee7-f42b-475a-bf42-3bae802ff72a'::uuid,  6900), -- Leđa
  ('f34848e7-6f53-4e30-a7f6-d2919a92dd28'::uuid,  6900)  -- Stomak + Grudi
)
insert into public.service_prices (service_id, location, price, valid_from)
select id, 'novi_sad', price, now() from new_prices;

-- 2. Men's legs - new treatments, same timing as the women's ─────────────────
with added as (
  insert into public.services (name, description, price, service_duration, pause_duration, gender, sort_order)
  values
    ('Noge',     'Lasersko uklanjanje dlačica – noge',     7900, 15, 15, 'muskarci', 12),
    ('1/2 nogu', 'Lasersko uklanjanje dlačica – pola nogu', 4900, 10, 10, 'muskarci', 13)
  returning id, name
)
insert into public.service_prices (service_id, location, price, valid_from)
select a.id, p.location, p.price, timestamptz '2026-01-01 00:00:00+01'
  from added a
  join (values
    ('Noge',     'novi_sad', 7900), ('Noge',     'sombor', 6500),
    ('1/2 nogu', 'novi_sad', 4900), ('1/2 nogu', 'sombor', 4000)
  ) as p (name, location, price) on p.name = a.name;

-- 3. Keep the legacy column in step with Novi Sad ───────────────────────────────
update public.services s
   set price = sp.price
  from (select distinct on (service_id) service_id, price
          from public.service_prices
         where location = 'novi_sad'
         order by service_id, valid_from desc) sp
 where sp.service_id = s.id and s.price <> sp.price;

commit;
