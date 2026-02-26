create table if not exists public.gas_prices (
  id bigint generated always as identity primary key,
  run_timestamp timestamptz not null,
  run_label text not null,
  city text not null,
  station_id text,
  station_name text not null,
  station_url text,
  address text,
  latitude double precision,
  longitude double precision,
  distance_from_biola_miles double precision,
  regular numeric(6,3),
  regular_updated text,
  midgrade numeric(6,3),
  midgrade_updated text,
  premium numeric(6,3),
  premium_updated text,
  diesel numeric(6,3),
  diesel_updated text,
  scrape_error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_gas_prices_run_timestamp on public.gas_prices (run_timestamp);
create index if not exists idx_gas_prices_city on public.gas_prices (city);
create index if not exists idx_gas_prices_station_id on public.gas_prices (station_id);
create unique index if not exists ux_gas_prices_station_name_address on public.gas_prices (station_name, address);
