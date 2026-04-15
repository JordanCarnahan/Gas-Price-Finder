import { type FuelType, type SortOrder } from "@/hooks/use-filters";

export type GasRow = {
  id: number;
  run_timestamp?: string;
  city: string;
  station_id?: string | null;
  station_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  regular: number | null;
  regular_updated?: string | null;
  midgrade: number | null;
  midgrade_updated?: string | null;
  premium: number | null;
  premium_updated?: string | null;
  diesel: number | null;
  diesel_updated?: string | null;
  updated_at?: string;
};

export type UserCoords = {
  latitude: number;
  longitude: number;
};

export type DisplayRow = GasRow & {
  distanceMiles: number | null;
  drivingFuelCost: number | null;
  distancePenalty: number | null;
  drivingPrice: number | null;
  fuelPriceTotal: number | null;
  totalPrice: number | null;
};

export const BIOLA_COORDS: UserCoords = {
  latitude: 33.9053,
  longitude: -117.9874,
};

export const DISTANCE_PENALTY_PER_MILE = 0.5;
export const HOME_FUEL_CHIPS: FuelType[] = ["regular", "midgrade", "premium", "diesel"];

export const fuelLabels: Record<FuelType, string> = {
  regular: "Regular",
  midgrade: "Midgrade",
  premium: "Premium",
  diesel: "Diesel",
};

export const sortLabels: Record<SortOrder, string> = {
  cheapest: "Cheapest",
  most_expensive: "Highest",
  closest: "Closest",
  furthest: "Furthest",
};

export function getStationKey(row: Pick<GasRow, "station_id" | "station_name" | "address" | "city" | "id">) {
  return row.station_id ?? `${row.station_name}:${row.address ?? row.city}:${row.id}`;
}

export function getPriceForFuel(row: GasRow, fuel: FuelType): number | null {
  return row[fuel];
}

export function getUpdatedForFuel(row: GasRow, fuel: FuelType): string | null {
  return row[`${fuel}_updated` as const] ?? null;
}

export function formatUpdatedLabel(value: string | null): string {
  if (!value) {
    return "N/A";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  const timeMatch = normalized.match(
    /(\d+\s*(?:sec|secs|second|seconds|min|mins|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s+ago)$/i
  );

  if (timeMatch) {
    return timeMatch[1];
  }

  return normalized;
}

export function money(value: number | null): string {
  if (value == null) {
    return "N/A";
  }

  return `$${value.toFixed(2)}`;
}

export function creditPrice(value: number | null): number | null {
  if (value == null) {
    return null;
  }

  return Number((value + 0.1).toFixed(2));
}

function toMiles(meters: number): number {
  return meters * 0.000621371;
}

export function haversineMiles(from: UserCoords, to: UserCoords): number {
  const radius = 6371000;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return toMiles(radius * c);
}

export function formatStationAddress(row: Pick<GasRow, "address" | "city">): string {
  return row.address ? `${row.address}, ${row.city}` : row.city;
}

export function formatDistanceLabel(distanceMiles: number | null): string {
  if (distanceMiles == null) {
    return "N/A";
  }

  const rounded = distanceMiles < 10 ? Number(distanceMiles.toFixed(1)) : Math.round(distanceMiles);

  if (Math.abs(rounded - 1) < 0.05) {
    return "1 Mile";
  }

  return `${rounded} Miles`;
}

export function estimateEta(distanceMiles: number | null): string {
  if (distanceMiles == null) {
    return "N/A";
  }

  const minutes = Math.max(3, Math.round((distanceMiles / 25) * 60));
  return `${minutes} min`;
}

export function createGoogleMapsUrl(row: Pick<GasRow, "address" | "city">) {
  const query = row.address ? `${row.address}, ${row.city}` : row.city;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function buildVisibleRows({
  rows,
  selectedFuel,
  sortOrder,
  maxDistance,
  userCoords,
  fuelEconomy,
  gallonsNeeded,
}: {
  rows: GasRow[];
  selectedFuel: FuelType;
  sortOrder: SortOrder;
  maxDistance: number;
  userCoords: UserCoords | null;
  fuelEconomy: number | null;
  gallonsNeeded: number | null;
}) {
  const rowsWithMetrics: DisplayRow[] = rows
    .filter((row) => getPriceForFuel(row, selectedFuel) != null)
    .map((row) => {
      const price = getPriceForFuel(row, selectedFuel);
      const distanceMiles =
        userCoords && row.latitude != null && row.longitude != null
          ? haversineMiles(userCoords, { latitude: row.latitude, longitude: row.longitude })
          : null;

      const drivingPrice =
        price != null && distanceMiles != null && fuelEconomy != null && fuelEconomy > 0
          ? (distanceMiles / fuelEconomy) * price + distanceMiles * DISTANCE_PENALTY_PER_MILE
          : null;

      const drivingFuelCost =
        price != null && distanceMiles != null && fuelEconomy != null && fuelEconomy > 0
          ? (distanceMiles / fuelEconomy) * price
          : null;

      const distancePenalty = distanceMiles != null ? distanceMiles * DISTANCE_PENALTY_PER_MILE : null;
      const fuelPriceTotal = price != null && gallonsNeeded != null && gallonsNeeded > 0 ? gallonsNeeded * price : null;
      const totalPrice = drivingPrice != null && fuelPriceTotal != null ? fuelPriceTotal + drivingPrice : null;

      return {
        ...row,
        distanceMiles,
        drivingFuelCost,
        distancePenalty,
        drivingPrice,
        fuelPriceTotal,
        totalPrice,
      };
    });

  const withinDistance = rowsWithMetrics.filter(
    (row) => row.distanceMiles == null || row.distanceMiles <= maxDistance
  );

  if (sortOrder === "closest" || sortOrder === "furthest") {
    const withDistance = withinDistance.filter((row) => row.distanceMiles != null);
    const withoutDistance = withinDistance.filter((row) => row.distanceMiles == null);
    const sorted = [...withDistance].sort((a, b) =>
      sortOrder === "closest"
        ? (a.distanceMiles as number) - (b.distanceMiles as number)
        : (b.distanceMiles as number) - (a.distanceMiles as number)
    );

    return [...sorted, ...withoutDistance];
  }

  return [...withinDistance].sort((a, b) => {
    const aPrice = getPriceForFuel(a, selectedFuel) as number;
    const bPrice = getPriceForFuel(b, selectedFuel) as number;
    return sortOrder === "cheapest" ? aPrice - bPrice : bPrice - aPrice;
  });
}
