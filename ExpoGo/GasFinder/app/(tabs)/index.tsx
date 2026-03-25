import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

type FuelType = "regular" | "midgrade" | "premium" | "diesel";
type SortOrder = "best" | "cheapest" | "most_expensive" | "closest";

type GasRow = {
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

type UserCoords = {
  latitude: number;
  longitude: number;
};

type DisplayRow = GasRow & {
  distanceMiles: number | null;
  drivingFuelCost: number | null;
  distancePenalty: number | null;
  drivingPrice: number | null;
  fuelPriceTotal: number | null;
  totalPrice: number | null;
};

type HistoryRow = {
  run_timestamp: string;
  regular: number | null;
  midgrade: number | null;
  premium: number | null;
  diesel: number | null;
};

type GraphPoint = {
  dateKey: string;
  dayLabel: string;
  price: number | null;
};

type GraphState = {
  loading: boolean;
  error: string;
  points: GraphPoint[];
};

const BIOLA_COORDS: UserCoords = {
  latitude: 33.9053,
  longitude: -117.9874,
};
const DISTANCE_PENALTY_PER_MILE = 0.5;
const ENABLE_GRAPH_PREVIEW_DATA = true;

const fuelLabels: Record<FuelType, string> = {
  regular: "Regular",
  midgrade: "Midgrade",
  premium: "Premium",
  diesel: "Diesel",
};

const sortLabels: Record<SortOrder, string> = {
  best: "Best",
  cheapest: "Cheapest",
  most_expensive: "Most expensive",
  closest: "Closest",
};

function getPriceForFuel(row: GasRow, fuel: FuelType): number | null {
  return row[fuel];
}

function getUpdatedForFuel(row: GasRow, fuel: FuelType): string | null {
  return row[`${fuel}_updated` as const] ?? null;
}

function formatUpdatedLabel(value: string | null): string {
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

function toMiles(meters: number): number {
  return meters * 0.000621371;
}

function haversineMiles(from: UserCoords, to: UserCoords): number {
  const r = 6371000;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return toMiles(r * c);
}

function money(value: number | null): string {
  if (value == null) {
    return "N/A";
  }
  return `$${value.toFixed(2)}`;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatAxisPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

function buildStationHistoryKey(row: GasRow): string {
  if (row.station_id) {
    return `station:${row.station_id}`;
  }
  return `name:${row.station_name}|address:${row.address ?? ""}|city:${row.city}`;
}

function buildSevenDaySeries(rows: HistoryRow[], fuel: FuelType): GraphPoint[] {
  const latestByDay = new Map<string, GraphPoint>();

  rows.forEach((row) => {
    const price = row[fuel];
    if (price == null) {
      return;
    }

    const runDate = new Date(row.run_timestamp);
    const dateKey = formatDateKey(runDate);

    if (!latestByDay.has(dateKey)) {
      latestByDay.set(dateKey, {
        dateKey,
        dayLabel: formatDayLabel(runDate),
        price,
      });
    }
  });

  const today = new Date();
  const points: GraphPoint[] = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    const isToday = index === 0;

    const dateKey = formatDateKey(date);
    const point = latestByDay.get(dateKey);

    points.push({
      dateKey,
      dayLabel: isToday ? "Now" : formatDayLabel(date),
      price: point?.price ?? null,
    });
  }

  return points;
}

function withPreviewGraphData(points: GraphPoint[]) {
  if (!ENABLE_GRAPH_PREVIEW_DATA) {
    return points;
  }

  const existingPrices = points.flatMap((point) => (point.price == null ? [] : [point.price]));
  const basePrice = existingPrices[existingPrices.length - 1] ?? 4.35;
  const offsets = [-0.18, -0.12, -0.09, -0.05, 0.02, -0.03, 0.08];

  return points.map((point, index) => ({
    ...point,
    price: point.price ?? Number((basePrice + offsets[index]).toFixed(2)),
  }));
}

function getNiceStep(rawStep: number): number {
  if (rawStep <= 0) {
    return 0.1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;

  if (normalized <= 1) {
    return magnitude;
  }
  if (normalized <= 2) {
    return 2 * magnitude;
  }
  if (normalized <= 5) {
    return 5 * magnitude;
  }
  return 10 * magnitude;
}

function getChartScale(points: GraphPoint[]) {
  const prices = points.flatMap((point) => (point.price == null ? [] : [point.price]));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
    return null;
  }

  const range = maxPrice - minPrice;
  const paddedRange = range === 0 ? Math.max(minPrice * 0.08, 0.2) : range * 0.3;
  const step = getNiceStep((range + paddedRange * 2) / 4);
  const minY = Math.max(0, Math.floor((minPrice - paddedRange) / step) * step);
  let maxY = Math.ceil((maxPrice + paddedRange) / step) * step;

  if (maxY === minY) {
    maxY = minY + step * 4;
  }

  const ticks = Array.from({ length: 5 }, (_, index) => minY + step * (4 - index));

  return { minY, maxY, ticks };
}

function StationHistoryGraph({ points }: { points: GraphPoint[] }) {
  const scale = useMemo(() => getChartScale(points), [points]);

  if (!scale) {
    return (
      <View style={styles.graphEmptyState}>
        <ThemedText>No price history found for the last 7 days.</ThemedText>
      </View>
    );
  }

  const latestPrice = [...points].reverse().find((point) => point.price != null)?.price;

  return (
    <View style={styles.graphCard}>
      <View style={styles.graphHeader}>
        <ThemedText type="defaultSemiBold">7-day price trend</ThemedText>
        <ThemedText style={styles.graphHeaderValue}>
          {latestPrice == null ? "N/A" : formatAxisPrice(latestPrice)}
        </ThemedText>
      </View>

      <View style={styles.graphBody}>
        <View style={styles.graphYAxis}>
          {scale.ticks.map((tick) => (
            <ThemedText key={tick} style={styles.graphAxisLabel}>
              {formatAxisPrice(tick)}
            </ThemedText>
          ))}
        </View>

        <View style={styles.graphPlotWrap}>
          <View style={styles.graphGrid}>
            {scale.ticks.map((tick) => (
              <View key={tick} style={styles.graphGridLine} />
            ))}
          </View>

          <View style={styles.graphPlot}>
            {points.map((point, index) => {
              const previousPrice = index > 0 ? points[index - 1]?.price : null;
              const ratio =
                point.price == null || scale.maxY === scale.minY
                  ? 0
                  : (point.price - scale.minY) / (scale.maxY - scale.minY);
              const trendColor =
                point.price == null || previousPrice == null || point.price === previousPrice
                  ? "#38bdf8"
                  : point.price > previousPrice
                    ? "#ef4444"
                    : "#22c55e";

              return (
                <View key={point.dateKey} style={styles.graphBarColumn}>
                  <View style={styles.graphBarTrack}>
                    {point.price != null && (
                      <>
                        <ThemedText style={[styles.graphPointValue, { color: trendColor }]}>
                          {point.price.toFixed(2)}
                        </ThemedText>
                        <View
                          style={[
                            styles.graphBar,
                            {
                              height: `${Math.max(ratio * 100, 4)}%`,
                              backgroundColor: trendColor,
                            },
                          ]}
                        />
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.graphXAxis}>
            {points.map((point) => (
              <View key={point.dateKey} style={styles.graphXAxisItem}>
                <ThemedText style={styles.graphXAxisLabel}>{point.dayLabel}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [rows, setRows] = useState<GasRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [selectedFuel, setSelectedFuel] = useState<FuelType>("regular");
  const [sortOrder, setSortOrder] = useState<SortOrder>("best");

  const [gallonsNeededInput, setGallonsNeededInput] = useState("");
  const [mpgInput, setMpgInput] = useState("");
  const [gallonsNeeded, setGallonsNeeded] = useState<number | null>(null);
  const [fuelEconomy, setFuelEconomy] = useState<number | null>(null);
  const [showVehiclePrompt, setShowVehiclePrompt] = useState(true);
  const [expandedStationId, setExpandedStationId] = useState<number | null>(null);
  const [showDrivingInfoForId, setShowDrivingInfoForId] = useState<number | null>(null);
  const [shownGraphStationKey, setShownGraphStationKey] = useState<string | null>(null);
  const [graphDataByStation, setGraphDataByStation] = useState<Record<string, GraphState>>({});
  const [showFilters, setShowFilters] = useState(true);

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const tableName = process.env.EXPO_PUBLIC_SUPABASE_TABLE ?? "gas_prices";
  const historyTableName = process.env.EXPO_PUBLIC_SUPABASE_HISTORY_TABLE ?? "gas_price_history";

  const canFetch = useMemo(() => Boolean(supabaseUrl && supabaseAnonKey), [supabaseUrl, supabaseAnonKey]);

  const visibleRows = useMemo(() => {
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

      const distancePenalty =
        distanceMiles != null
          ? distanceMiles * DISTANCE_PENALTY_PER_MILE
          : null;

      const fuelPriceTotal =
        price != null && gallonsNeeded != null && gallonsNeeded > 0
          ? gallonsNeeded * price
          : null;

      // "Best" ranks by total out-of-pocket cost for a fill-up trip.
      const totalPrice =
        drivingPrice != null && fuelPriceTotal != null
          ? fuelPriceTotal + drivingPrice
          : null;

      return { ...row, distanceMiles, drivingFuelCost, distancePenalty, drivingPrice, fuelPriceTotal, totalPrice };
    });

    if (sortOrder === "closest") {
      const withDistance = rowsWithMetrics.filter((row) => row.distanceMiles != null);
      const withoutDistance = rowsWithMetrics.filter((row) => row.distanceMiles == null);
      const sorted = [...withDistance].sort((a, b) => (a.distanceMiles as number) - (b.distanceMiles as number));
      return [...sorted, ...withoutDistance];
    }

    if (sortOrder === "best") {
      const withTotal = rowsWithMetrics.filter((row) => row.totalPrice != null);
      const withoutTotal = rowsWithMetrics.filter((row) => row.totalPrice == null);
      const sorted = [...withTotal].sort((a, b) => (a.totalPrice as number) - (b.totalPrice as number));
      return [...sorted, ...withoutTotal];
    }

    const sorted = [...rowsWithMetrics].sort((a, b) => {
      const aPrice = getPriceForFuel(a, selectedFuel) as number;
      const bPrice = getPriceForFuel(b, selectedFuel) as number;
      return sortOrder === "cheapest" ? aPrice - bPrice : bPrice - aPrice;
    });
    return sorted;
  }, [rows, selectedFuel, sortOrder, userCoords, fuelEconomy, gallonsNeeded]);

  const openInMaps = async (address: string, city: string) => {
    const query = encodeURIComponent(`${address}, ${city}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    await Linking.openURL(url);
  };

  const onSaveVehicle = () => {
    const parsedGallonsNeeded = Number(gallonsNeededInput);
    const parsedMpg = Number(mpgInput);

    if (!Number.isFinite(parsedGallonsNeeded) || parsedGallonsNeeded <= 0) {
      setErrorMessage("Enter a valid estimated gallons needed.");
      return;
    }
    if (!Number.isFinite(parsedMpg) || parsedMpg <= 0) {
      setErrorMessage("Enter a valid fuel economy (MPG).");
      return;
    }

    setGallonsNeeded(parsedGallonsNeeded);
    setFuelEconomy(parsedMpg);
    setShowVehiclePrompt(false);
    setErrorMessage("");
  };

  const onFetchPress = useCallback(async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      setErrorMessage("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      setUserCoords(BIOLA_COORDS);

      const query =
        "select=id,run_timestamp,city,station_id,station_name,address,latitude,longitude,regular,regular_updated,midgrade,midgrade_updated,premium,premium_updated,diesel,diesel_updated&order=city.asc,station_name.asc";
      const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?${query}`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message ?? "Failed to fetch gas prices.");
      }

      setRows(Array.isArray(payload) ? (payload as GasRow[]) : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [supabaseUrl, supabaseAnonKey, tableName]);

  useEffect(() => {
    if (!supabaseUrl || !supabaseAnonKey) {
      return;
    }
    void onFetchPress();
  }, [onFetchPress, supabaseUrl, supabaseAnonKey]);

  const fetchStationHistory = useCallback(
    async (row: GasRow) => {
      if (!supabaseUrl || !supabaseAnonKey) {
        setErrorMessage("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.");
        return;
      }

      const stationKey = buildStationHistoryKey(row);
      setShownGraphStationKey(stationKey);

      setGraphDataByStation((current) => ({
        ...current,
        [stationKey]: {
          loading: true,
          error: "",
          points: current[stationKey]?.points ?? [],
        },
      }));

      try {
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() - 6);

        const params = new URLSearchParams({
          select: "run_timestamp,regular,midgrade,premium,diesel",
          order: "run_timestamp.desc",
          run_timestamp: `gte.${startDate.toISOString()}`,
        });

        if (row.station_id) {
          params.set("station_id", `eq.${row.station_id}`);
        } else {
          params.set("station_name", `eq.${row.station_name}`);
          if (row.address) {
            params.set("address", `eq.${row.address}`);
          } else {
            params.set("city", `eq.${row.city}`);
          }
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/${historyTableName}?${params.toString()}`, {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message ?? "Failed to fetch station history.");
        }

        const points = withPreviewGraphData(
          buildSevenDaySeries(Array.isArray(payload) ? (payload as HistoryRow[]) : [], selectedFuel)
        );

        setGraphDataByStation((current) => ({
          ...current,
          [stationKey]: {
            loading: false,
            error: "",
            points,
          },
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch station history.";
        setGraphDataByStation((current) => ({
          ...current,
          [stationKey]: {
            loading: false,
            error: message,
            points: current[stationKey]?.points ?? [],
          },
        }));
      }
    },
    [historyTableName, selectedFuel, supabaseAnonKey, supabaseUrl]
  );

  const onToggleGraph = useCallback(
    async (row: GasRow) => {
      const stationKey = buildStationHistoryKey(row);

      if (shownGraphStationKey === stationKey) {
        setShownGraphStationKey(null);
        return;
      }

      const currentGraph = graphDataByStation[stationKey];
      if (currentGraph && !currentGraph.loading) {
        setShownGraphStationKey(stationKey);
        return;
      }

      await fetchStationHistory(row);
    },
    [fetchStationHistory, graphDataByStation, shownGraphStationKey]
  );

  useEffect(() => {
    setShownGraphStationKey(null);
    setGraphDataByStation({});
  }, [selectedFuel]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
    <ThemedView style={styles.container}>
      <Modal visible={showVehiclePrompt} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ThemedText type="subtitle">Vehicle Setup</ThemedText>
            <ThemedText>Estimated gallons needed</ThemedText>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={gallonsNeededInput}
              onChangeText={setGallonsNeededInput}
              placeholder="ex: 8.5"
            />
            <ThemedText>Fuel economy (MPG)</ThemedText>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={mpgInput}
              onChangeText={setMpgInput}
              placeholder="ex: 28"
            />
            <Pressable style={styles.button} onPress={onSaveVehicle}>
              <ThemedText style={styles.buttonText}>Save</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View style={styles.headerRow}>
        <ThemedText type="title">Gas Finder</ThemedText>
        <Pressable style={styles.filtersButton} onPress={() => setShowFilters((v) => !v)}>
          <ThemedText style={styles.filtersButtonText}>{showFilters ? "Hide Filters" : "Filters"}</ThemedText>
        </Pressable>
      </View>
      {!canFetch && (
        <ThemedText style={styles.message}>Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your Expo .env file.</ThemedText>
      )}
      {loading && <ActivityIndicator />}
      {!!errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}

      <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent}>
        {showFilters && (
          <>
            <View style={styles.controlSection}>
              <ThemedText type="defaultSemiBold">Fuel type</ThemedText>
              <View style={styles.chipRow}>
                {(Object.keys(fuelLabels) as FuelType[]).map((fuel) => (
                  <Pressable
                    key={fuel}
                    onPress={() => setSelectedFuel(fuel)}
                    style={[styles.chip, selectedFuel === fuel && styles.chipActive]}>
                    <ThemedText style={selectedFuel === fuel ? styles.chipTextActive : undefined}>{fuelLabels[fuel]}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.controlSection}>
              <ThemedText type="defaultSemiBold">Sort</ThemedText>
              <View style={styles.chipRow}>
                {(Object.keys(sortLabels) as SortOrder[]).map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setSortOrder(option)}
                    style={[styles.chip, sortOrder === option && styles.chipActive]}>
                    <ThemedText style={sortOrder === option ? styles.chipTextActive : undefined}>{sortLabels[option]}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        )}

        {visibleRows.map((row) => {
          const stationKey = buildStationHistoryKey(row);
          const graphState = graphDataByStation[stationKey];
          const isGraphVisible = shownGraphStationKey === stationKey;

          return (
            <View key={row.id} style={styles.card}>
            <View style={styles.cardTopRow}>
              <Pressable style={styles.cardLeft} onPress={() => setExpandedStationId(expandedStationId === row.id ? null : row.id)}>
                <ThemedText type="defaultSemiBold">{row.station_name}</ThemedText>
                {row.address ? (
                  <Pressable onPress={() => openInMaps(row.address as string, row.city)}>
                    <ThemedText style={styles.mapLink}>{`${row.address}, ${row.city}`}</ThemedText>
                  </Pressable>
                ) : (
                  <ThemedText>{row.city}</ThemedText>
                )}
                <ThemedText>
                  Distance: {row.distanceMiles == null ? "N/A" : `${row.distanceMiles.toFixed(2)} mi`}
                </ThemedText>
                <ThemedText style={styles.tapHint}>
                  {expandedStationId === row.id ? "Tap to hide fuel details" : "Tap station for fuel details"}
                </ThemedText>
              </Pressable>

              <View style={styles.cardRight}>
                <View style={styles.priceBlock}>
                  <ThemedText style={styles.selectedFuelLabel}>{fuelLabels[selectedFuel]}</ThemedText>
                  <ThemedText style={styles.selectedPriceLarge}>{money(getPriceForFuel(row, selectedFuel))}</ThemedText>
                  <ThemedText style={styles.selectedPriceUpdated}>
                    Updated: {formatUpdatedLabel(getUpdatedForFuel(row, selectedFuel))}
                  </ThemedText>
                </View>
                <Pressable
                  style={styles.priceBlock}
                  onPress={() => setShowDrivingInfoForId(showDrivingInfoForId === row.id ? null : row.id)}>
                  <ThemedText style={styles.totalPriceLabel}>Total price</ThemedText>
                  <ThemedText style={styles.totalPriceLarge}>{money(row.totalPrice)}</ThemedText>
                </Pressable>
              </View>
            </View>

            {expandedStationId === row.id && (
              <View style={styles.infoBox}>
                <View style={styles.infoBoxTopRow}>
                  <View style={styles.infoBoxDetails}>
                    <ThemedText type="defaultSemiBold">Other fuel prices</ThemedText>
                    {(Object.keys(fuelLabels) as FuelType[])
                      .filter((fuel) => fuel !== selectedFuel)
                      .map((fuel) => (
                        <ThemedText key={fuel}>
                          {fuelLabels[fuel]}: {money(getPriceForFuel(row, fuel))}
                        </ThemedText>
                      ))}
                  </View>
                  <Pressable style={styles.graphButton} onPress={() => void onToggleGraph(row)}>
                    <ThemedText style={styles.graphButtonText}>{isGraphVisible ? "Hide graph" : "Show graph"}</ThemedText>
                  </Pressable>
                </View>
              </View>
            )}

            {showDrivingInfoForId === row.id && (
              <View style={styles.infoBubble}>
                <ThemedText type="defaultSemiBold">Trip cost details</ThemedText>
                <ThemedText>
                  Fuel price total: {money(getPriceForFuel(row, selectedFuel))} x {gallonsNeeded ?? "N/A"} = {money(row.fuelPriceTotal)}
                </ThemedText>
                <ThemedText>
                  Driving fuel: ({row.distanceMiles == null ? "N/A" : row.distanceMiles.toFixed(2)} / {fuelEconomy ?? "N/A"}) x {money(getPriceForFuel(row, selectedFuel))} = {money(row.drivingFuelCost)}
                </ThemedText>
                <ThemedText>
                  Distance penalty: {row.distanceMiles == null ? "N/A" : row.distanceMiles.toFixed(2)} x $0.50 = {money(row.distancePenalty)}
                </ThemedText>
                <ThemedText>Driving price (+ $0.50/mi): {money(row.drivingPrice)}</ThemedText>
              </View>
            )}
            {isGraphVisible && (
              <View style={styles.graphSection}>
                {graphState?.loading ? (
                  <View style={styles.graphLoading}>
                    <ActivityIndicator />
                  </View>
                ) : graphState?.error ? (
                  <View style={styles.graphEmptyState}>
                    <ThemedText style={styles.error}>{graphState.error}</ThemedText>
                  </View>
                ) : (
                  <StationHistoryGraph points={graphState?.points ?? []} />
                )}
              </View>
            )}
            </View>
          );
        })}
        {!loading && visibleRows.length === 0 && !errorMessage && (
          <ThemedText style={styles.message}>No rows loaded yet.</ThemedText>
        )}
      </ScrollView>
    </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#1f2937",
  },
  container: {
    flex: 1,
    backgroundColor: "#1f2937",
    padding: 24,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  filtersButton: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#111827",
  },
  filtersButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#374151",
  },
  input: {
    borderWidth: 1,
    borderColor: "#6b7280",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#ffffff",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#1f6feb",
    alignSelf: "flex-start",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  message: {
    opacity: 0.8,
  },
  error: {
    color: "#d93025",
  },
  controlSection: {
    gap: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#d0d7de",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chipActive: {
    backgroundColor: "#1f6feb",
    borderColor: "#1f6feb",
  },
  chipTextActive: {
    color: "#ffffff",
  },
  results: {
    flex: 1,
    width: "100%",
  },
  resultsContent: {
    gap: 10,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d0d7de",
    padding: 12,
    gap: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cardLeft: {
    flex: 1,
    gap: 4,
  },
  cardRight: {
    minWidth: 140,
    alignItems: "flex-end",
    justifyContent: "flex-start",
    gap: 12,
    flexShrink: 0,
  },
  priceBlock: {
    alignItems: "flex-end",
    gap: 2,
  },
  selectedFuelLabel: {
    opacity: 0.8,
    textAlign: "right",
  },
  selectedPriceLarge: {
    color: "#2fbf4a",
    fontWeight: "700",
    fontSize: 26,
    lineHeight: 30,
    textAlign: "right",
  },
  selectedPriceUpdated: {
    fontSize: 12,
    opacity: 0.8,
    textAlign: "right",
  },
  totalPriceLarge: {
    fontWeight: "800",
    fontSize: 26,
    lineHeight: 30,
    textAlign: "right",
  },
  totalPriceLabel: {
    textAlign: "right",
    opacity: 0.8,
  },
  tapHint: {
    opacity: 0.75,
    fontSize: 12,
  },
  infoBox: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    padding: 10,
    gap: 4,
    backgroundColor: "#111827",
  },
  infoBoxTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  infoBoxDetails: {
    flex: 1,
    gap: 4,
  },
  infoBubble: {
    marginTop: 8,
    alignSelf: "flex-end",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    padding: 10,
    gap: 4,
    backgroundColor: "#0f172a",
    minWidth: 180,
  },
  graphButton: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#0f172a",
    alignSelf: "flex-start",
    minWidth: 110,
    alignItems: "center",
  },
  graphButtonText: {
    color: "#cbd5e1",
    fontWeight: "600",
    fontSize: 14,
  },
  graphSection: {
    marginTop: 12,
  },
  graphLoading: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  graphCard: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    backgroundColor: "#0b1220",
    padding: 12,
    gap: 12,
  },
  graphHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  graphHeaderValue: {
    color: "#60a5fa",
    fontWeight: "700",
  },
  graphBody: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
  },
  graphYAxis: {
    justifyContent: "space-between",
    minHeight: 180,
    paddingVertical: 2,
  },
  graphAxisLabel: {
    fontSize: 12,
    opacity: 0.78,
  },
  graphPlotWrap: {
    flex: 1,
    gap: 8,
  },
  graphGrid: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  graphGridLine: {
    borderTopWidth: 1,
    borderColor: "#1e293b",
  },
  graphPlot: {
    minHeight: 180,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 16,
  },
  graphBarColumn: {
    flex: 1,
    justifyContent: "flex-end",
    position: "relative",
  },
  graphBarTrack: {
    height: 180,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  graphBar: {
    width: "70%",
    minWidth: 14,
    backgroundColor: "#38bdf8",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  graphPointValue: {
    fontSize: 11,
    marginBottom: 6,
    opacity: 0.85,
  },
  graphXAxis: {
    flexDirection: "row",
    gap: 8,
  },
  graphXAxisItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  graphXAxisLabel: {
    textAlign: "center",
    fontSize: 12,
    opacity: 0.78,
  },
  graphEmptyState: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    backgroundColor: "#0b1220",
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  totalPrice: {
    fontWeight: "700",
  },
  mapLink: {
    color: "#ffffff",
    textDecorationLine: "underline",
  },
});
