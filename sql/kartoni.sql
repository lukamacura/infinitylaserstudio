-- ─────────────────────────────────────────────────────────────────────────────
-- Kartoni - the treatment card that replaces the staff's paper one.
-- Purely additive: safe to run while the old code is live.
--
--   clients         — one row per person (there was no such table: until now a
--                     client was only ever a name + contact on a reservation)
--   kartoni         — each client's card, 1:1, with the note at the bottom
--   karton_rows     — the card's rows: one treatment date
--   karton_entries  — the card's cells: one region on that date, energy + Hz
--
-- reservations.client_id ties the bookings to the people. A new booking finds
-- or creates its client and card and adds a row for its date with its regions
-- (the triggers at the end). Energy is typed in on the card; the frequency is
-- always worked out here, so the site and the future mobile app can't disagree.
--
-- Who is who: the same phone or email AND a compatible name is the same person.
-- A phone alone is not enough - mothers book for daughters, and one person's
-- laser settings on another's card is the one mistake this must not make. So a
-- doubtful pair stays on two cards, and the admin can merge them by hand.
--
-- The triggers run inside the booking's transaction, so each one catches its
-- own errors: a problem here may cost a card row, never a booking.
-- Existing clients are filled in by sql/kartoni_backfill.sql.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create extension if not exists fuzzystrmatch with schema extensions;

-- ── Comparing people ─────────────────────────────────────────────────────────

/** Lower case, Latin, no diacritics; đ / dj / d are all typed for the same letter. */
create or replace function public.karton_norm_name(p text)
returns text language sql immutable parallel safe set search_path to '' as $$
  select trim(regexp_replace(regexp_replace(
    translate(
      replace(replace(replace(replace(replace(replace(replace(lower(coalesce(p, '')),
        'љ', 'lj'), 'њ', 'nj'), 'џ', 'dz'), 'ђ', 'd'), 'đ', 'd'), 'ð', 'd'), 'dj', 'd'),
      'абвгдежзијклмнопрстћуфхцчшžčćš',
      'abvgdezzijklmnoprstcufhccszccs'),
    '[-_.,;:''"`/]+', ' ', 'g'), '\s+', ' ', 'g'));
$$;

/** Digits only, +381 written as 0. Null when it can't be a real number. */
create or replace function public.karton_norm_phone(p text)
returns text language sql immutable parallel safe set search_path to '' as $$
  select case
    when length(d) < 6 or d ~ '^(\d)\1+$' then null
    else regexp_replace(d, '^(00)?3810?', '0')
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

/** Lower case. Null for no email and for the addresses staff type as a filler,
 *  which are shared by over a hundred different people. */
create or replace function public.karton_norm_email(p text)
returns text language sql immutable parallel safe set search_path to '' as $$
  select case
    when e = '' or position('@' in e) = 0 or e = any (array['ana@gmail.com', 'tanjci989@gmail.com']) then null
    else e
  end
  from (select lower(trim(coalesce(p, ''))) as e) x;
$$;

/** Two words that could be one name: equal, cut short ("aleksan"), or one typo. */
create or replace function public.karton_word_like(a text, b text)
returns boolean language sql immutable parallel safe set search_path to '' as $$
  select a = b
    or (least(length(a), length(b)) >= 5 and (left(a, length(b)) = b or left(b, length(a)) = a))
    or (length(a) >= 5 and length(b) >= 5 and left(a, 1) = left(b, 1) and extensions.levenshtein(a, b) <= 1);
$$;

/**
 * Could these two (normalized) names belong to one person, given they already
 * share a contact? The first name decides: a married surname still matches, a
 * shared surname alone does not (Ela / Rea Bjelić are two people). Also covers
 * "Mandić Dušan" against "Dušan Mandić", a lone "Marija" against a full name,
 * and an email typed into the name field, which says nothing about the name.
 */
create or replace function public.karton_same_person(a text, b text)
returns boolean language plpgsql immutable parallel safe set search_path to '' as $$
declare
  ta text[] := string_to_array(a, ' ');
  tb text[] := string_to_array(b, ' ');
  na integer := cardinality(ta);
  nb integer := cardinality(tb);
begin
  if na = 0 or nb = 0 then return false; end if;
  if position('@' in a) > 0 or position('@' in b) > 0 then return true; end if;
  if public.karton_word_like(ta[1], tb[1]) then return true; end if;
  if na >= 2 and nb >= 2 then
    return public.karton_word_like(ta[1], tb[nb]) and public.karton_word_like(ta[na], tb[1]);
  end if;
  if na = 1 then
    return exists (select 1 from unnest(tb) t where public.karton_word_like(ta[1], t));
  end if;
  return exists (select 1 from unnest(ta) t where public.karton_word_like(tb[1], t));
end; $$;

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists public.clients (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null check (length(trim(name)) between 1 and 120),
  phone       text        check (length(phone) <= 40),
  email       text        check (length(email) <= 200),
  gender      text        check (gender in ('zene', 'muskarci')),
  name_norm   text        generated always as (public.karton_norm_name(name)) stored,
  phone_norm  text        generated always as (public.karton_norm_phone(phone)) stored,
  email_norm  text        generated always as (public.karton_norm_email(email)) stored,
  search_text text        generated always as (
    public.karton_norm_name(name || ' ' || coalesce(email, '')) || ' ' || coalesce(public.karton_norm_phone(phone), '')
  ) stored,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists clients_phone_norm_idx on public.clients (phone_norm);
create index if not exists clients_email_norm_idx on public.clients (email_norm);
create index if not exists clients_name_norm_idx  on public.clients (name_norm);

create table if not exists public.kartoni (
  id         uuid        primary key default gen_random_uuid(),
  number     integer     generated always as identity unique,
  client_id  uuid        not null unique references public.clients (id) on delete cascade,
  note       text        not null default '' check (length(note) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.karton_rows (
  id             uuid        primary key default gen_random_uuid(),
  karton_id      uuid        not null references public.kartoni (id) on delete cascade,
  -- The booking this row came from; null for a row added by hand.
  reservation_id uuid        unique references public.reservations (id) on delete set null,
  date           date        not null,
  location       text        not null default 'novi_sad' check (location in ('novi_sad', 'sombor')),
  created_at     timestamptz not null default now()
);
create index if not exists karton_rows_karton_idx on public.karton_rows (karton_id, date);
create index if not exists karton_rows_date_idx   on public.karton_rows (date, location);

create table if not exists public.karton_entries (
  row_id       uuid        not null references public.karton_rows (id) on delete cascade,
  region       text        not null check (length(trim(region)) between 1 and 40),
  energy_j     numeric(5,2) check (energy_j > 0 and energy_j <= 100),
  frequency_hz smallint,   -- set by trigger, never by the client
  -- Booked or picked for this date: an empty cell the staff still has to fill.
  planned      boolean     not null default false,
  updated_at   timestamptz not null default now(),
  primary key (row_id, region)
);

alter table public.reservations
  add column if not exists client_id uuid references public.clients (id) on delete set null;
create index if not exists reservations_client_idx on public.reservations (client_id);
-- Finding a client by any contact they ever booked with.
create index if not exists reservations_phone_norm_idx on public.reservations (public.karton_norm_phone(customer_phone));
create index if not exists reservations_email_norm_idx on public.reservations (public.karton_norm_email(customer_email));

do $$
declare t text;
begin
  foreach t in array array['clients', 'kartoni', 'karton_rows', 'karton_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format(
      'create policy "admin all" on public.%I for all to authenticated
         using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ── Frequency ────────────────────────────────────────────────────────────────

/** Below 15 J: 10 Hz, from 15 J up: 7 Hz. Mirrored in frequencyFor (lib/kartoni.ts). */
create or replace function public.karton_frequency(p_energy numeric)
returns smallint language sql immutable parallel safe set search_path to '' as $$
  select case when p_energy is null then null when p_energy < 15 then 10 else 7 end::smallint;
$$;

create or replace function public.karton_entries_before()
returns trigger language plpgsql set search_path to '' as $$
begin
  new.frequency_hz := public.karton_frequency(new.energy_j);
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists karton_entries_before on public.karton_entries;
create trigger karton_entries_before before insert or update on public.karton_entries
  for each row execute function public.karton_entries_before();

create or replace function public.karton_touch()
returns trigger language plpgsql set search_path to '' as $$
begin
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients
  for each row execute function public.karton_touch();
drop trigger if exists kartoni_touch on public.kartoni;
create trigger kartoni_touch before update on public.kartoni
  for each row execute function public.karton_touch();

-- ── Regions ──────────────────────────────────────────────────────────────────

/**
 * The card's columns for one service. A combo is two regions, usually at two
 * energies; whole body is what it stands for (not the face, which is booked
 * next to it - see FULL_BODY_ALLOWED in components/booking/shared.tsx).
 * Mirrored in regionsOfService (lib/kartoni.ts).
 */
create or replace function public.karton_service_regions(p_name text, p_gender text)
returns setof text language plpgsql immutable set search_path to '' as $$
begin
  if lower(p_name) like '%celo telo%' then
    return query select unnest(case when p_gender = 'muskarci'
      then array['Pazuh', 'Ruke', 'Grudi', 'Stomak', 'Leđa', 'Noge']
      else array['Pazuh', 'Ruke', 'Noge', 'Intima'] end);
    return;
  end if;
  return query
    select upper(left(x, 1)) || substr(x, 2)
    from regexp_split_to_table(trim(p_name), '\s+(\+|i)\s+') x;
end; $$;

-- ── Finding the client ───────────────────────────────────────────────────────

/** The existing client this name + contact belongs to, or null. Writes nothing. */
create or replace function public.karton_find_client(p_name text, p_phone text, p_email text)
returns uuid language plpgsql stable security definer set search_path to '' as $$
declare
  v_name  text := public.karton_norm_name(p_name);
  v_phone text := public.karton_norm_phone(p_phone);
  v_email text := public.karton_norm_email(p_email);
  v_full  boolean := v_name like '% %';
  v_id    uuid;
  v_ids   uuid[];
begin
  if v_name = '' then return null; end if;

  if v_phone is not null or v_email is not null then
    select c.id into v_id from public.clients c
     where (c.phone_norm = v_phone or c.email_norm = v_email)
       and public.karton_same_person(c.name_norm, v_name)
     order by c.created_at limit 1;
    if v_id is not null then return v_id; end if;

    -- A contact the client booked with once, not the one on their card.
    select c.id into v_id from public.reservations r
      join public.clients c on c.id = r.client_id
     where (public.karton_norm_phone(r.customer_phone) = v_phone
         or public.karton_norm_email(r.customer_email) = v_email)
       and public.karton_same_person(c.name_norm, v_name)
     order by c.created_at limit 1;
    if v_id is not null then return v_id; end if;

    -- Staff booked them under the full name with no contact, now one came in.
    if v_full then
      select c.id into v_id from public.clients c
       where c.name_norm = v_name and c.phone_norm is null and c.email_norm is null
       order by c.created_at limit 1;
    end if;
    return v_id;
  end if;

  -- Nothing but a name. The contactless card comes first; a card with a contact
  -- only if the full name is unique, or two Milica Jovanović would share one.
  select c.id into v_id from public.clients c
   where c.name_norm = v_name and c.phone_norm is null and c.email_norm is null
   order by c.created_at limit 1;
  if v_id is not null or not v_full then return v_id; end if;

  select array_agg(c.id) into v_ids from public.clients c where c.name_norm = v_name;
  return case when cardinality(v_ids) = 1 then v_ids[1] end;
end; $$;

/** Find the client, or create them. Fills in a contact the client was missing. */
create or replace function public.karton_resolve_client(p_name text, p_phone text, p_email text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  v_phone text := case when public.karton_norm_phone(p_phone) is not null then left(trim(p_phone), 40) end;
  v_email text := case when public.karton_norm_email(p_email) is not null then left(trim(p_email), 200) end;
  v_id    uuid;
begin
  if public.karton_norm_name(p_name) = '' then return null; end if;

  -- Two bookings of one new client at the same moment must not make two clients.
  perform pg_advisory_xact_lock(hashtextextended(
    'ils_client:' || coalesce(public.karton_norm_phone(p_phone), public.karton_norm_email(p_email), public.karton_norm_name(p_name)), 0));

  v_id := public.karton_find_client(p_name, p_phone, p_email);
  if v_id is null then
    insert into public.clients (name, phone, email)
    values (left(trim(p_name), 120), v_phone, v_email)
    returning id into v_id;
  else
    update public.clients
       set phone = coalesce(phone, v_phone), email = coalesce(email, v_email)
     where id = v_id
       and ((phone is null and v_phone is not null) or (email is null and v_email is not null));
  end if;
  return v_id;
end; $$;

/**
 * Brings the card in line with one booking: its row, date, studio and regions.
 * A cancelled booking takes its row away, unless energies were already entered.
 * Never touches a cell that has an energy in it.
 */
create or replace function public.karton_sync_reservation(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  r        public.reservations%rowtype;
  v_karton uuid;
  v_row    uuid;
  v_gender text;
  v_regions text[];
begin
  select * into r from public.reservations where id = p_id;
  if not found or r.client_id is null then return; end if;

  if r.status in ('cancelled', 'blacklisted') then
    delete from public.karton_rows kr
     where kr.reservation_id = p_id
       and not exists (select 1 from public.karton_entries e where e.row_id = kr.id and e.energy_j is not null);
    return;
  end if;

  insert into public.kartoni (client_id) values (r.client_id) on conflict (client_id) do nothing;
  select id into v_karton from public.kartoni where client_id = r.client_id;

  insert into public.karton_rows (karton_id, reservation_id, date, location)
  values (v_karton, p_id, r.date, r.location)
  on conflict (reservation_id) do update
    set karton_id = excluded.karton_id, date = excluded.date, location = excluded.location
  returning id into v_row;

  select coalesce(array_agg(distinct x), '{}'), min(s.gender) into v_regions, v_gender
    from public.reservation_services rs
    join public.services s on s.id = rs.service_id
    cross join lateral public.karton_service_regions(s.name, s.gender) x
   where rs.reservation_id = p_id;

  insert into public.karton_entries (row_id, region, planned)
  select v_row, x, true from unnest(v_regions) x
  on conflict (row_id, region) do update set planned = true;

  delete from public.karton_entries e
   where e.row_id = v_row and e.planned and e.energy_j is null and not (e.region = any (v_regions));

  if v_gender is not null then
    update public.clients set gender = v_gender where id = r.client_id and gender is null;
  end if;
end; $$;

-- ── What the pages call ──────────────────────────────────────────────────────

/** The drawer: every word of the query must match, or the whole list, A to Ž. */
create or replace function public.karton_search(p_query text default '', p_limit integer default 40, p_offset integer default 0)
returns table (
  karton_id uuid, number integer, client_id uuid, name text, name_norm text, phone text, email text,
  rows_count integer, last_date date, next_date date, total bigint
)
language sql stable set search_path to '' as $$
  with q as (
    select case
      when trim(coalesce(p_query, '')) ~ '^[\s\d+()/-]+$'
        then array[regexp_replace(regexp_replace(p_query, '\D', '', 'g'), '^(00)?3810?', '0')]
      else string_to_array(public.karton_norm_name(p_query), ' ')
    end as words
  ),
  today as (select (now() at time zone 'Europe/Belgrade')::date as d)
  select k.id, k.number, c.id, c.name, c.name_norm, c.phone, c.email,
         coalesce(s.n, 0), s.last_date, s.next_date, count(*) over ()
    from public.kartoni k
    join public.clients c on c.id = k.client_id
    cross join q
    cross join today
    left join lateral (
      select count(*)::integer as n,
             max(kr.date) filter (where kr.date <= today.d) as last_date,
             min(kr.date) filter (where kr.date >  today.d) as next_date
        from public.karton_rows kr where kr.karton_id = k.id
    ) s on true
   where not exists (select 1 from unnest(q.words) w where position(w in c.search_text) = 0)
   order by c.name_norm, k.number
   limit greatest(1, least(coalesce(p_limit, 40), 200)) offset greatest(coalesce(p_offset, 0), 0);
$$;

/** Who comes to this studio today, in order, and how much of their card is filled. */
create or replace function public.karton_today(p_location text)
returns table (karton_id uuid, number integer, name text, start_time time, regions text[], filled integer)
language sql stable set search_path to '' as $$
  select k.id, k.number, c.name, r.start_time,
         coalesce(array_agg(e.region order by e.region) filter (where e.region is not null), '{}'),
         count(e.energy_j)::integer
    from public.karton_rows kr
    join public.kartoni k on k.id = kr.karton_id
    join public.clients c on c.id = k.client_id
    left join public.reservations r on r.id = kr.reservation_id
    left join public.karton_entries e on e.row_id = kr.id
   where kr.date = (now() at time zone 'Europe/Belgrade')::date and kr.location = p_location
   group by k.id, k.number, c.name, r.start_time
   order by r.start_time nulls last, c.name;
$$;

/** A card added by hand. Someone already on file gets `exists` back, unless p_force. */
create or replace function public.karton_create(
  p_name text, p_phone text default null, p_email text default null, p_gender text default null, p_force boolean default false
)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  v_name   text := trim(coalesce(p_name, ''));
  v_phone  text := left(nullif(trim(coalesce(p_phone, '')), ''), 40);
  v_email  text := left(nullif(trim(coalesce(p_email, '')), ''), 200);
  v_gender text := case when p_gender in ('zene', 'muskarci') then p_gender end;
  v_client uuid;
  v_karton uuid;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if length(v_name) = 0 or length(v_name) > 120 then return jsonb_build_object('status', 'invalid_name'); end if;

  if not coalesce(p_force, false) then
    v_client := public.karton_find_client(v_name, v_phone, v_email);
    select id into v_karton from public.kartoni where client_id = v_client;
    if v_karton is not null then
      return jsonb_build_object('status', 'exists', 'id', v_karton,
        'name', (select name from public.clients where id = v_client));
    end if;
  end if;

  if v_client is null then
    insert into public.clients (name, phone, email, gender)
    values (v_name, v_phone, v_email, v_gender) returning id into v_client;
  end if;
  insert into public.kartoni (client_id) values (v_client) returning id into v_karton;
  return jsonb_build_object('status', 'created', 'id', v_karton);
end; $$;

/** The card behind a booking, for the links in the admin panel. Makes one if it is missing. */
create or replace function public.karton_for_reservation(p_reservation_id uuid)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  r        public.reservations%rowtype;
  v_client uuid;
  v_karton uuid;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select * into r from public.reservations where id = p_reservation_id;
  if not found then return null; end if;

  v_client := r.client_id;
  if v_client is null then
    v_client := public.karton_resolve_client(r.customer_name, r.customer_phone, r.customer_email);
    if v_client is null then return null; end if;
    update public.reservations set client_id = v_client where id = r.id;
  end if;

  insert into public.kartoni (client_id) values (v_client) on conflict (client_id) do nothing;
  select id into v_karton from public.kartoni where client_id = v_client;
  if r.date >= (now() at time zone 'Europe/Belgrade')::date then
    perform public.karton_sync_reservation(r.id);
  end if;
  return v_karton;
end; $$;

/** Deletes a card with its rows. The client stays while they have bookings. */
create or replace function public.karton_delete(p_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare v_client uuid;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  delete from public.kartoni where id = p_id returning client_id into v_client;
  if v_client is not null
     and not exists (select 1 from public.reservations where client_id = v_client) then
    delete from public.clients where id = v_client;
  end if;
end; $$;

/** Two cards turned out to be one person: everything moves to p_keep. */
create or replace function public.karton_merge(p_keep uuid, p_drop uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  k public.kartoni%rowtype;
  d public.kartoni%rowtype;
  dc public.clients%rowtype;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_keep = p_drop then raise exception 'same card'; end if;
  select * into k from public.kartoni where id = p_keep for update;
  select * into d from public.kartoni where id = p_drop for update;
  if k.id is null or d.id is null then raise exception 'card not found'; end if;
  select * into dc from public.clients where id = d.client_id;

  update public.karton_rows set karton_id = k.id where karton_id = d.id;
  update public.reservations set client_id = k.client_id where client_id = d.client_id;
  update public.kartoni
     set note = left(concat_ws(E'\n\n', nullif(note, ''), nullif(d.note, '')), 5000)
   where id = k.id;
  update public.clients
     set phone = coalesce(phone, dc.phone), email = coalesce(email, dc.email), gender = coalesce(gender, dc.gender)
   where id = k.client_id;
  delete from public.clients where id = d.client_id;  -- takes the empty card with it
end; $$;

-- Pure helpers stay callable by the signed-in admin: Postgres checks them for
-- whoever writes a row, because of the generated columns and indexes above.
do $$
declare f text;
begin
  foreach f in array array[
    'karton_norm_name(text)', 'karton_norm_phone(text)', 'karton_norm_email(text)',
    'karton_word_like(text, text)', 'karton_same_person(text, text)', 'karton_frequency(numeric)',
    'karton_service_regions(text, text)', 'karton_search(text, integer, integer)', 'karton_today(text)',
    'karton_create(text, text, text, text, boolean)', 'karton_for_reservation(uuid)',
    'karton_delete(uuid)', 'karton_merge(uuid, uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'karton_find_client(text, text, text)', 'karton_resolve_client(text, text, text)',
    'karton_sync_reservation(uuid)', 'karton_entries_before()', 'karton_touch()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

grant execute on function public.karton_entries_before() to authenticated;
grant execute on function public.karton_touch() to authenticated;

commit;

-- ── Bookings → cards (applied after sql/kartoni_backfill.sql) ────────────────

begin;

create or replace function public.reservations_karton_client()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  if new.client_id is null then
    begin
      new.client_id := public.karton_resolve_client(new.customer_name, new.customer_phone, new.customer_email);
    exception when others then
      raise warning 'karton: no client for reservation %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end; $$;

create or replace function public.reservations_karton_sync()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  begin
    perform public.karton_sync_reservation(new.id);
  exception when others then
    raise warning 'karton: reservation % not synced: %', new.id, sqlerrm;
  end;
  return null;
end; $$;

create or replace function public.reservations_karton_delete()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  begin
    delete from public.karton_rows kr
     where kr.reservation_id = old.id
       and not exists (select 1 from public.karton_entries e where e.row_id = kr.id and e.energy_j is not null);
  exception when others then
    raise warning 'karton: row of reservation % not removed: %', old.id, sqlerrm;
  end;
  return old;
end; $$;

create or replace function public.reservation_services_karton_sync()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  begin
    perform public.karton_sync_reservation(case when tg_op = 'DELETE' then old.reservation_id else new.reservation_id end);
  exception when others then
    raise warning 'karton: services of a reservation not synced: %', sqlerrm;
  end;
  return null;
end; $$;

do $$
declare f text;
begin
  foreach f in array array[
    'reservations_karton_client()', 'reservations_karton_sync()',
    'reservations_karton_delete()', 'reservation_services_karton_sync()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

drop trigger if exists reservations_karton_client on public.reservations;
create trigger reservations_karton_client before insert on public.reservations
  for each row execute function public.reservations_karton_client();

drop trigger if exists reservations_karton_insert on public.reservations;
create trigger reservations_karton_insert after insert on public.reservations
  for each row execute function public.reservations_karton_sync();

drop trigger if exists reservations_karton_update on public.reservations;
create trigger reservations_karton_update after update of date, status, location on public.reservations
  for each row
  when (old.date is distinct from new.date or old.status is distinct from new.status or old.location is distinct from new.location)
  execute function public.reservations_karton_sync();

drop trigger if exists reservations_karton_delete on public.reservations;
create trigger reservations_karton_delete before delete on public.reservations
  for each row execute function public.reservations_karton_delete();

drop trigger if exists reservation_services_karton_sync on public.reservation_services;
create trigger reservation_services_karton_sync after insert or delete on public.reservation_services
  for each row execute function public.reservation_services_karton_sync();

commit;
