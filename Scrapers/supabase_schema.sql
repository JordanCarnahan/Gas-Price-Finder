do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'gas_prices'
      and c.relkind = 'r'
  ) and not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'gas_price_history'
      and c.relkind = 'r'
  ) then
    alter table public.gas_prices rename to gas_price_history;
  end if;
end
$$;

drop index if exists public.ux_gas_prices_station_name_address;

create table if not exists public.gas_price_history (
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

create index if not exists idx_gas_price_history_run_timestamp on public.gas_price_history (run_timestamp desc);
create index if not exists idx_gas_price_history_city on public.gas_price_history (city);
create index if not exists idx_gas_price_history_station_id on public.gas_price_history (station_id);
create index if not exists idx_gas_price_history_station_name_address on public.gas_price_history (station_name, address);

create unique index if not exists ux_gas_price_history_run_station_id
  on public.gas_price_history (run_timestamp, station_id)
  where station_id is not null;

create unique index if not exists ux_gas_price_history_run_station_name_address
  on public.gas_price_history (run_timestamp, station_name, address)
  where station_id is null;

create or replace view public.gas_prices as
with latest_run as (
  select max(run_timestamp) as run_timestamp
  from public.gas_price_history
)
select
  gph.id,
  gph.run_timestamp,
  gph.run_label,
  gph.city,
  gph.station_id,
  gph.station_name,
  gph.station_url,
  gph.address,
  gph.latitude,
  gph.longitude,
  gph.distance_from_biola_miles,
  gph.regular,
  gph.regular_updated,
  gph.midgrade,
  gph.midgrade_updated,
  gph.premium,
  gph.premium_updated,
  gph.diesel,
  gph.diesel_updated,
  gph.scrape_error,
  gph.created_at
from public.gas_price_history gph
join latest_run lr on gph.run_timestamp = lr.run_timestamp;
