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
with ranked as (
  select
    gph.*,
    row_number() over (
      partition by coalesce(nullif(gph.station_id, ''), gph.station_name || '|' || coalesce(gph.address, ''))
      order by gph.run_timestamp desc, gph.id desc
    ) as row_num
  from public.gas_price_history gph
)
select
  id,
  run_timestamp,
  run_label,
  city,
  station_id,
  station_name,
  station_url,
  address,
  latitude,
  longitude,
  distance_from_biola_miles,
  regular,
  regular_updated,
  midgrade,
  midgrade_updated,
  premium,
  premium_updated,
  diesel,
  diesel_updated,
  scrape_error,
  created_at
from ranked
where row_num = 1;
