-- Globedex: datamodell fas 1 (Supabase / Postgres)

-- ========== Hjälpfunktioner ==========
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ========== Användare och grupper ==========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Resenär',
  avatar_url text,
  travel_mode text not null default 'solo' check (travel_mode in ('solo','par','grupp')),
  active_group_id uuid,
  settings jsonb not null default '{}'::jsonb,  -- palett, egen palett, fonter, textstorlek, rundning, språkstil, mörkt läge
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'solo' check (kind in ('solo','par','grupp')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index on public.group_members (user_id);

create table public.group_invites (
  code text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days'
);

alter table public.profiles
  add constraint profiles_active_group_fk foreign key (active_group_id) references public.groups(id) on delete set null;

create or replace function public.is_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members m where m.group_id = gid and m.user_id = auth.uid());
$$;

create or replace function public.shares_group(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members a
    join public.group_members b on b.group_id = a.group_id
    where a.user_id = auth.uid() and b.user_id = uid);
$$;

-- Ny användare får profil och en egen sologrupp
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  insert into public.groups (name, kind, created_by) values ('Mina resor', 'solo', new.id) returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, new.id, 'owner');
  insert into public.profiles (id, display_name, active_group_id)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Resenär'), gid);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Skapa en par- eller gruppyta och bli ägare
create or replace function public.create_group(group_name text, group_kind text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  insert into public.groups (name, kind, created_by) values (group_name, group_kind, auth.uid()) returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, auth.uid(), 'owner');
  return gid;
end $$;

-- Gå med i en grupp med inbjudningskod
create or replace function public.join_group(invite_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  select group_id into gid from public.group_invites where code = invite_code and expires_at > now();
  if gid is null then raise exception 'Ogiltig eller utgången kod'; end if;
  insert into public.group_members (group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  return gid;
end $$;

-- ========== Innehåll (läses av alla, skrivs bara via service role) ==========
create table public.places (
  id text primary key,                      -- 'NL', 'SE-vastergotland', 'NL-amsterdam'
  kind text not null check (kind in ('country','region','city','spot')),
  parent_id text references public.places(id) on delete cascade,
  layer text,                               -- t.ex. 'lan' eller 'landskap' för Sverige
  name text not null,
  iso2 text,
  lat double precision,
  lon double precision,
  airport text,                             -- IATA-kod för sök flyg
  smart_months smallint[],                  -- 12 värden, 0–5
  data jsonb not null default '{}'::jsonb,  -- vistelselängder, områden, transport, flygtips, dagsbudget
  updated_at timestamptz not null default now()
);
create index on public.places (parent_id);
create index on public.places (kind);

create table public.place_facts (            -- guide och regler, med källa och datum
  id text primary key,
  place_id text not null references public.places(id) on delete cascade,
  topic text not null,                       -- 'ta-sig-dit', 'mobil', 'dricks', 'alkohol', 'hyrbil' ...
  is_rule boolean not null default false,
  min_age smallint,
  title text not null,
  summary text,
  body text,
  source_url text,
  verified_on date
);
create index on public.place_facts (place_id);

create table public.place_items (            -- checklistan per plats
  id text primary key,
  place_id text not null references public.places(id) on delete cascade,
  category text not null,                    -- 'mat', 'sevardhet', 'natur', 'fotboll' ...
  name text not null,
  summary text,
  body text,
  must_rank smallint,
  lat double precision,
  lon double precision,
  compendium_id text,
  source_url text,
  verified_on date
);
create index on public.place_items (place_id);

create table public.compendium_items (       -- samlingsboken
  id text primary key,
  category text not null,
  name text not null,
  rarity text not null default 'vanlig' check (rarity in ('vanlig','ovanlig','sallsynt','legendarisk')),
  icon text,
  hint text,
  place_id text references public.places(id) on delete set null,
  source_url text
);
alter table public.place_items
  add constraint place_items_compendium_fk foreign key (compendium_id) references public.compendium_items(id) on delete set null;

create table public.bucket_catalog (
  id text primary key,
  name text not null,
  category text not null,
  cost_level text check (cost_level in ('gratis','billigt','medel','dyrt')),
  season text,
  where_text text,
  place_ids text[] not null default '{}'
);

create table public.ideas (                  -- Idag-fliken
  id text primary key,
  place_id text references public.places(id) on delete cascade,   -- null = hemma, funkar överallt
  kind text not null,
  title text not null,
  body text,
  duration text,
  cost_level text check (cost_level in ('gratis','billigt','medel','dyrt')),
  tags text[] not null default '{}',
  drive_minutes int,
  lat double precision,
  lon double precision
);
create index on public.ideas (place_id);

create table public.gift_tips (
  id text primary key,
  place_id text not null references public.places(id) on delete cascade,
  name text not null,
  body text,
  for_whom text[] not null default '{}',
  keywords text[] not null default '{}',
  price_sek int,
  min_age smallint,
  collection_motifs jsonb not null default '{}'::jsonb
);
create index on public.gift_tips (place_id);

-- ========== Användarens data ==========
create table public.place_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text not null constraint place_status_place_id_format check (place_id ~ '^[A-Z]{2}(-[a-z0-9]+)*$'),  -- ISO-kod eller innehålls-id
  status text not null check (status in ('vill','planerad','besokt','bor','bott','mellan')),
  year smallint,
  note text,
  visibility text not null default 'grupp' check (visibility in ('privat','grupp','offentlig')),
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table public.item_checks (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.place_items(id) on delete cascade,
  done_on date not null default current_date,
  rating smallint check (rating between 1 and 10),
  note text,
  visibility text not null default 'grupp' check (visibility in ('privat','grupp','offentlig')),
  primary key (user_id, item_id)
);

create table public.finds (
  user_id uuid not null references auth.users(id) on delete cascade,
  compendium_id text not null references public.compendium_items(id) on delete cascade,
  found_on date not null default current_date,
  place_id text constraint finds_place_id_format check (place_id ~ '^[A-Z]{2}(-[a-z0-9]+)*$'),
  note text,
  visibility text not null default 'grupp' check (visibility in ('privat','grupp','offentlig')),
  primary key (user_id, compendium_id)
);

create table public.swipe_votes (
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_id text not null references public.bucket_catalog(id) on delete cascade,
  wants boolean not null,
  voted_at timestamptz not null default now(),
  primary key (user_id, catalog_id)
);

create table public.bucket_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  catalog_id text references public.bucket_catalog(id) on delete set null,
  title text not null,
  category text,
  target_year smallint,
  done_on date,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.bucket_items (group_id);

create table public.collections (            -- t.ex. kaffemuggar
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table public.collection_entries (
  collection_id uuid not null references public.collections(id) on delete cascade,
  place_id text not null constraint collection_entries_place_id_format check (place_id ~ '^[A-Z]{2}(-[a-z0-9]+)*$'),
  got_on date not null default current_date,
  note text,
  primary key (collection_id, place_id)
);

create table public.recipients (             -- presentmottagare
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  relation text,
  interests text
);

create table public.saved_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  lat double precision,
  lon double precision,
  is_home boolean not null default false
);

create table public.reviews (                -- Vår guide
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  place_id text constraint reviews_place_id_format check (place_id ~ '^[A-Z]{2}(-[a-z0-9]+)*$'),
  name text not null,
  rating smallint check (rating between 1 and 10),
  note text,
  visibility text not null default 'grupp' check (visibility in ('privat','grupp','offentlig')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.reviews (group_id);

create table public.saved_ideas (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  idea_id text references public.ideas(id) on delete cascade,
  title text,
  done_on date,
  created_at timestamptz not null default now()
);
create index on public.saved_ideas (group_id);

-- Valvet: krypteras i appen innan det skickas. Databasen ser aldrig klartext.
create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                        -- 'pass', 'forsakring', 'nodkontakt', 'halsa', 'fodelsedatum' ...
  ciphertext text not null,
  iv text not null,
  updated_at timestamptz not null default now()
);
create index on public.vault_items (user_id);

-- ========== Resor ==========
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  place_id text constraint trips_place_id_format check (place_id ~ '^[A-Z]{2}(-[a-z0-9]+)*$'),
  kind text not null default 'resa' check (kind in ('resa','utflykt')),
  status text not null default 'planerad' check (status in ('planerad','pagar','klar')),
  start_date date,
  end_date date,
  from_airport text,
  budget jsonb not null default '{}'::jsonb,  -- {"Resa":2500,"Boende":3500,...}
  shopping_budget_sek int,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index on public.trips (group_id);

create or replace function public.can_trip(tid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trips t where t.id = tid and public.is_member(t.group_id));
$$;

create table public.trip_legs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  pos smallint not null default 0,
  mode text not null check (mode in ('bil','buss','flyg','tag','bat','till-fots','annat')),
  from_text text not null,
  to_text text not null,
  from_lat double precision, from_lon double precision,
  to_lat double precision, to_lon double precision,
  depart_at timestamptz,
  duration_min int,
  distance_km numeric,
  note text
);
create index on public.trip_legs (trip_id);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  kind text not null check (kind in ('flyg','boende','tag','hyrbil','biljett','annat')),
  title text not null,
  reference text,
  starts_at timestamptz,
  ends_at timestamptz,
  address text,
  file_path text,                            -- fil i Supabase Storage
  note text
);
create index on public.bookings (trip_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'SEK',
  rate_to_sek numeric(12,6) not null default 1,   -- kursen den dagen
  category text,
  paid_by uuid references auth.users(id) on delete set null,
  split_between uuid[] not null default '{}',     -- tom = delas lika på alla i gruppen
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.expenses (trip_id);

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  grp text not null default 'Övrigt',
  title text not null,
  packed boolean not null default false,
  owner uuid references auth.users(id) on delete set null,   -- null = delad
  private boolean not null default false,                    -- t.ex. rader från hälsa i Valvet
  pos smallint not null default 0
);
create index on public.packing_items (trip_id);

create table public.pretrip_items (          -- Innan avresa
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null,
  hint text,
  done boolean not null default false,
  removed boolean not null default false,
  custom boolean not null default false,
  pos smallint not null default 0
);
create index on public.pretrip_items (trip_id);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  price_sek int not null default 0,
  recipient_id uuid references public.recipients(id) on delete set null,
  gift_tip_id text references public.gift_tips(id) on delete set null,
  bought boolean not null default false
);
create index on public.shopping_items (trip_id);

-- ========== updated_at ==========
create trigger t_profiles_upd before update on public.profiles for each row execute function public.set_updated_at();
create trigger t_status_upd before update on public.place_status for each row execute function public.set_updated_at();
create trigger t_vault_upd before update on public.vault_items for each row execute function public.set_updated_at();
create trigger t_trips_upd before update on public.trips for each row execute function public.set_updated_at();

-- ========== Säkerhetsregler (RLS) ==========
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Innehåll: alla får läsa, ingen får skriva från appen
do $$ declare t text; begin
  foreach t in array array['places','place_facts','place_items','compendium_items','bucket_catalog','ideas','gift_tips'] loop
    execute format('create policy "read_all" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- Profil: egen, plus läsa gruppmedlemmars
create policy "profile_read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group(id));
create policy "profile_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Grupper
create policy "group_read" on public.groups for select to authenticated
  using (public.is_member(id) or created_by = auth.uid());
create policy "group_insert" on public.groups for insert to authenticated
  with check (created_by = auth.uid());
create policy "group_update" on public.groups for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "group_delete" on public.groups for delete to authenticated
  using (created_by = auth.uid());

create policy "member_read" on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_member(group_id));
create policy "member_insert_owner" on public.group_members for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()));
create policy "member_leave" on public.group_members for delete to authenticated
  using (user_id = auth.uid() or exists (
    select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid()));

create policy "invite_all" on public.group_invites for all to authenticated
  using (public.is_member(group_id)) with check (public.is_member(group_id) and created_by = auth.uid());

-- Egen data som gruppen får se (om inte privat)
do $$ declare t text; begin
  foreach t in array array['place_status','item_checks','finds'] loop
    execute format('create policy "own_write" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "group_read" on public.%I for select to authenticated using (visibility <> ''privat'' and public.shares_group(user_id))', t);
  end loop;
end $$;

create policy "own_write" on public.swipe_votes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "group_read" on public.swipe_votes for select to authenticated
  using (public.shares_group(user_id));

-- Bara egen data
do $$ declare t text; begin
  foreach t in array array['collections','recipients','saved_locations','vault_items'] loop
    execute format('create policy "own_all" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
create policy "own_all" on public.collection_entries for all to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));

-- Gruppens data
do $$ declare t text; begin
  foreach t in array array['bucket_items','reviews','saved_ideas','trips'] loop
    execute format('create policy "group_all" on public.%I for all to authenticated using (public.is_member(group_id)) with check (public.is_member(group_id))', t);
  end loop;
end $$;

-- Resans delar
do $$ declare t text; begin
  foreach t in array array['trip_legs','bookings','expenses','pretrip_items'] loop
    execute format('create policy "trip_all" on public.%I for all to authenticated using (public.can_trip(trip_id)) with check (public.can_trip(trip_id))', t);
  end loop;
end $$;

-- Packlista: privata rader syns bara för ägaren
create policy "pack_all" on public.packing_items for all to authenticated
  using (public.can_trip(trip_id) and (not private or owner = auth.uid()))
  with check (public.can_trip(trip_id) and (not private or owner = auth.uid()));

-- Inköpslista: egen, per resa
create policy "shop_all" on public.shopping_items for all to authenticated
  using (user_id = auth.uid() and public.can_trip(trip_id))
  with check (user_id = auth.uid() and public.can_trip(trip_id));

-- ========== Behörigheter för Data API (RLS avgör fortfarande vilka rader som syns) ==========
grant usage on schema public to anon, authenticated, service_role;

grant select on public.places, public.place_facts, public.place_items, public.compendium_items,
  public.bucket_catalog, public.ideas, public.gift_tips to anon, authenticated;
grant select, insert, update, delete on public.places, public.place_facts, public.place_items,
  public.compendium_items, public.bucket_catalog, public.ideas, public.gift_tips to service_role;

grant select, insert, update, delete on
  public.profiles, public.groups, public.group_members, public.group_invites,
  public.place_status, public.item_checks, public.finds, public.swipe_votes,
  public.bucket_items, public.collections, public.collection_entries, public.recipients,
  public.saved_locations, public.reviews, public.saved_ideas, public.vault_items,
  public.trips, public.trip_legs, public.bookings, public.expenses,
  public.packing_items, public.pretrip_items, public.shopping_items
to authenticated, service_role;

grant execute on function public.create_group(text, text), public.join_group(text),
  public.is_member(uuid), public.shares_group(uuid), public.can_trip(uuid) to authenticated;
