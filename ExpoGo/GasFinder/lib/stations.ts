import {
  type FuelType,
  type SortDirection,
  type SortField,
} from "@/hooks/use-filters";

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
  timeCostTotal: number | null;
  drivingPrice: number | null;
  fuelPriceTotal: number | null;
  totalPrice: number | null;
};

export const BIOLA_COORDS: UserCoords = {
  latitude: 33.9053,
  longitude: -117.9874,
};

export const HOME_FUEL_CHIPS: FuelType[] = ["regular", "midgrade", "premium", "diesel"];

export const fuelLabels: Record<FuelType, string> = {
  regular: "Regular",
  midgrade: "Midgrade",
  premium: "Premium",
  diesel: "Diesel",
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
  sortField,
  sortDirection,
  maxDistance,
  timeCostPerMile,
  userCoords,
  fuelEconomy,
  gallonsNeeded,
}: {
  rows: GasRow[];
  selectedFuel: FuelType;
  sortField: SortField;
  sortDirection: SortDirection;
  maxDistance: number;
  timeCostPerMile: number;
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

      const drivingFuelCost =
        price != null && distanceMiles != null && fuelEconomy != null && fuelEconomy > 0
          ? (distanceMiles / fuelEconomy) * price
          : null;

      const timeCostTotal =
        distanceMiles != null && Number.isFinite(timeCostPerMile) && timeCostPerMile >= 0
          ? distanceMiles * timeCostPerMile
          : null;
      const fuelPriceTotal =
        price != null && gallonsNeeded != null && gallonsNeeded > 0 ? gallonsNeeded * price : null;
      const drivingPrice =
        drivingFuelCost != null || timeCostTotal != null
          ? (drivingFuelCost ?? 0) + (timeCostTotal ?? 0)
          : null;
      const totalPrice = fuelPriceTotal != null ? fuelPriceTotal + (timeCostTotal ?? 0) : null;

      return {
        ...row,
        distanceMiles,
        drivingFuelCost,
        timeCostTotal,
        drivingPrice,
        fuelPriceTotal,
        totalPrice,
      };
    });

  const withinDistance = rowsWithMetrics.filter(
    (row) => row.distanceMiles == null || row.distanceMiles <= maxDistance
  );

  const getTotalCost = (row: DisplayRow): number | null =>
    row.totalPrice ?? row.fuelPriceTotal ?? row.drivingPrice;

  const isAscending = sortDirection === "low_high";

  const compareNullableNumber = (aValue: number | null, bValue: number | null) => {
    if (aValue == null && bValue == null) {
      return 0;
    }

    if (aValue == null) {
      return 1;
    }

    if (bValue == null) {
      return -1;
    }

    return isAscending ? aValue - bValue : bValue - aValue;
  };

  return [...withinDistance].sort((a, b) => {
    if (sortField === "distance") {
      const distanceComparison = compareNullableNumber(a.distanceMiles, b.distanceMiles);
      if (distanceComparison !== 0) {
        return distanceComparison;
      }
    } else if (sortField === "price") {
      const priceComparison = compareNullableNumber(
        getPriceForFuel(a, selectedFuel),
        getPriceForFuel(b, selectedFuel)
      );
      if (priceComparison !== 0) {
        return priceComparison;
      }
    } else {
      const totalCostComparison = compareNullableNumber(getTotalCost(a), getTotalCost(b));
      if (totalCostComparison !== 0) {
        return totalCostComparison;
      }
    }

    return a.station_name.localeCompare(b.station_name);
  });
}
