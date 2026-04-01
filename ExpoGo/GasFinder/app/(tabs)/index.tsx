import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type FuelType, type SortOrder, useFilters } from "@/hooks/use-filters";
import { useVehicleConfig } from "@/hooks/use-vehicle-config";

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

const searchIcon = "https://www.figma.com/api/mcp/asset/8df900f3-fc02-41ab-94ac-61f8bfb73e02";
const searchActionIcon = "https://www.figma.com/api/mcp/asset/b8e2dabe-abad-4a8b-ae92-303ab78c6047";
const filterIcon = "https://www.figma.com/api/mcp/asset/6f667495-fc7c-486d-ac6c-86996c436b4b";
const floatingButtonIcon = "https://www.figma.com/api/mcp/asset/2f8505d6-ad03-48e1-b774-f5cafecf65b5";
const listIcon = "https://www.figma.com/api/mcp/asset/95382bcb-92a5-46d0-9872-3016337859ad";
const favoritesIcon = "https://www.figma.com/api/mcp/asset/c25618c3-7773-4c8c-abc2-80330d4a1d35";

const BIOLA_COORDS: UserCoords = {
  latitude: 33.9053,
  longitude: -117.9874,
};

const DISTANCE_PENALTY_PER_MILE = 0.5;
const PRIMARY_FUEL_CHIPS: FuelType[] = ["regular", "premium", "diesel"];

const fuelLabels: Record<FuelType, string> = {
  regular: "Regular",
  midgrade: "Midgrade",
  premium: "Premium",
  diesel: "Diesel",
};

const sortLabels: Record<SortOrder, string> = {
  cheapest: "Cheapest",
  most_expensive: "Highest",
  closest: "Closest",
  furthest: "Furthest",
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

function money(value: number | null): string {
  if (value == null) {
    return "N/A";
  }

  return `$${value.toFixed(2)}`;
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

function formatStationAddress(row: GasRow): string {
  return row.address ? `${row.address}, ${row.city}` : row.city;
}

function formatDistanceLabel(distanceMiles: number | null): string {
  if (distanceMiles == null) {
    return "N/A";
  }

  const rounded = distanceMiles < 10 ? Number(distanceMiles.toFixed(1)) : Math.round(distanceMiles);

  if (Math.abs(rounded - 1) < 0.05) {
    return "1 Mile";
  }

  return `${rounded} Mi`;
}

function StationCard({
  row,
  expanded,
  onPress,
  onOpenMaps,
  selectedFuel,
}: {
  row: DisplayRow;
  expanded: boolean;
  onPress: () => void;
  onOpenMaps: () => void;
  selectedFuel: FuelType;
}) {
  const otherFuels = (Object.keys(fuelLabels) as FuelType[]).filter(
    (fuel) => fuel !== selectedFuel && getPriceForFuel(row, fuel) != null
  );

  return (
    <View style={styles.stationCardWrap}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.stationCard, pressed && styles.stationCardPressed]}>
        <View style={styles.stationCardTop}>
          <Text style={styles.stationName}>{row.station_name}</Text>
          <Text style={styles.stationAddress}>{formatStationAddress(row)}</Text>
          <Text style={styles.stationUpdated}>Updated {formatUpdatedLabel(getUpdatedForFuel(row, selectedFuel))}</Text>
        </View>

        <View style={styles.stationCardBottom}>
          <View style={styles.pricePanel}>
            <Text style={styles.priceValue}>{money(getPriceForFuel(row, selectedFuel))}</Text>
            <Text style={styles.priceCaption}>PER GALLON</Text>
          </View>

          <View style={styles.distancePanel}>
            <Text style={styles.distanceValue}>{formatDistanceLabel(row.distanceMiles)}</Text>
            <Text style={styles.distanceCaption}>DISTANCE</Text>
          </View>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.stationDetails}>
          <Text style={styles.detailsHeading}>Trip breakdown</Text>
          <Text style={styles.detailsText}>Fill-up cost: {money(row.fuelPriceTotal)}</Text>
          <Text style={styles.detailsText}>Drive cost: {money(row.drivingPrice)}</Text>
          <Text style={styles.detailsText}>Best trip total: {money(row.totalPrice)}</Text>

          {otherFuels.length > 0 && (
            <View style={styles.otherFuelWrap}>
              {otherFuels.map((fuel) => (
                <View key={fuel} style={styles.otherFuelChip}>
                  <Text style={styles.otherFuelLabel}>{fuelLabels[fuel]}</Text>
                  <Text style={styles.otherFuelValue}>{money(getPriceForFuel(row, fuel))}</Text>
                  <Text style={styles.otherFuelUpdated}>{formatUpdatedLabel(getUpdatedForFuel(row, fuel))}</Text>
                </View>
              ))}
            </View>
          )}

          <Pressable onPress={onOpenMaps} style={styles.mapsButton}>
            <Text style={styles.mapsButtonText}>Open in Maps</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<GasRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [expandedStationId, setExpandedStationId] = useState<number | null>(null);
  const { maxDistance, selectedFuel, sortOrder } = useFilters();
  const { fuelEconomy, gallonsNeeded, isConfigured, isLocationStepComplete } = useVehicleConfig();

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const tableName = process.env.EXPO_PUBLIC_SUPABASE_TABLE ?? "gas_prices";

  const canFetch = useMemo(() => Boolean(supabaseUrl && supabaseAnonKey), [supabaseAnonKey, supabaseUrl]);

  const availableFuelChips = useMemo(() => {
    const chips = [...PRIMARY_FUEL_CHIPS];

    if (selectedFuel === "midgrade" && !chips.includes("midgrade")) {
      chips.splice(1, 0, "midgrade");
    }

    return chips.filter(
      (fuel) => rows.some((row) => getPriceForFuel(row, fuel) != null) || fuel === selectedFuel
    );
  }, [rows, selectedFuel]);

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

        const distancePenalty = distanceMiles != null ? distanceMiles * DISTANCE_PENALTY_PER_MILE : null;

        const fuelPriceTotal = price != null && gallonsNeeded != null && gallonsNeeded > 0 ? gallonsNeeded * price : null;

        const totalPrice =
          drivingPrice != null && fuelPriceTotal != null ? fuelPriceTotal + drivingPrice : null;

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
  }, [fuelEconomy, gallonsNeeded, maxDistance, rows, selectedFuel, sortOrder, userCoords]);

  const openInMaps = useCallback(async (row: DisplayRow) => {
    const query = encodeURIComponent(formatStationAddress(row));
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  }, []);

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
        const apiMessage =
          typeof payload?.message === "string" ? payload.message : "Failed to fetch gas prices.";
        const missingTableMatch = apiMessage.match(/table\s+'public\.([^']+)'/i);

        if (missingTableMatch) {
          throw new Error(
            `Supabase table "${missingTableMatch[1]}" was not found. Check EXPO_PUBLIC_SUPABASE_TABLE in your .env file.`
          );
        }

        throw new Error(apiMessage);
      }

      setRows(Array.isArray(payload) ? (payload as GasRow[]) : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [supabaseAnonKey, supabaseUrl, tableName]);

  useEffect(() => {
    if (!isConfigured) {
      router.replace("/fuel-configuration");
      return;
    }

    if (!isLocationStepComplete) {
      router.replace("/location-access");
      return;
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      return;
    }

    void onFetchPress();
  }, [isConfigured, isLocationStepComplete, onFetchPress, router, supabaseAnonKey, supabaseUrl]);

  if (!isConfigured || !isLocationStepComplete) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.brand}>FuelFinder</Text>
          <Pressable onPress={() => router.push("/modal")} style={styles.headerIconButton}>
            <Image contentFit="contain" source={filterIcon} style={styles.headerIcon} />
          </Pressable>
        </View>
        <View style={styles.headerDivider} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.searchBar}>
            <Image contentFit="contain" source={searchIcon} style={styles.searchBarIcon} />
            <Text style={styles.searchPlaceholder}>Search for cheap fuel{"\n"}nearby...</Text>
            <Pressable onPress={() => void onFetchPress()} style={styles.searchActionButton}>
              <Image contentFit="contain" source={searchActionIcon} style={styles.searchActionIcon} />
            </Pressable>
          </View>

          <View style={styles.fuelChipRow}>
            {availableFuelChips.map((fuel) => (
              <Pressable
                key={fuel}
                onPress={() => router.push("/modal")}
                style={[styles.fuelChip, selectedFuel === fuel && styles.fuelChipActive]}>
                <Text style={[styles.fuelChipText, selectedFuel === fuel && styles.fuelChipTextActive]}>
                  {fuelLabels[fuel]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={() => router.push("/modal")} style={styles.filterSummary}>
            <Text style={styles.filterSummaryTitle}>Filters</Text>
            <Text style={styles.filterSummaryText}>
              {fuelLabels[selectedFuel]} • {sortLabels[sortOrder]} • {maxDistance} mi
            </Text>
          </Pressable>

          {!canFetch && (
            <View style={styles.statusCard}>
              <Text style={styles.statusText}>
                Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your Expo .env file.
              </Text>
            </View>
          )}

          {loading && rows.length === 0 && (
            <View style={styles.statusCard}>
              <ActivityIndicator color="#ff9f4a" />
            </View>
          )}

          {!!errorMessage && (
            <View style={styles.statusCard}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {visibleRows.map((row) => (
            <StationCard
              key={row.id}
              expanded={expandedStationId === row.id}
              onOpenMaps={() => void openInMaps(row)}
              onPress={() => setExpandedStationId((current) => (current === row.id ? null : row.id))}
              row={row}
              selectedFuel={selectedFuel}
            />
          ))}

          {!loading && visibleRows.length === 0 && !errorMessage && (
            <View style={styles.statusCard}>
              <Text style={styles.statusText}>No stations found for {fuelLabels[selectedFuel].toLowerCase()}.</Text>
            </View>
          )}
        </ScrollView>

        <Pressable onPress={() => void onFetchPress()} style={styles.floatingButton}>
          <Image contentFit="contain" source={floatingButtonIcon} style={styles.floatingButtonIcon} />
        </Pressable>

        <View style={styles.bottomNav}>
          <View style={styles.bottomNavActiveItem}>
            <Image contentFit="contain" source={listIcon} style={styles.bottomNavActiveIcon} />
            <Text style={styles.bottomNavActiveLabel}>LIST</Text>
          </View>

          <Pressable onPress={() => router.push("/explore")} style={styles.bottomNavItem}>
            <Image contentFit="contain" source={favoritesIcon} style={styles.bottomNavIcon} />
            <Text style={styles.bottomNavLabel}>FAVORITES</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0e0e0e",
  },
  screen: {
    flex: 1,
    backgroundColor: "#0e0e0e",
  },
  header: {
    height: 75,
    paddingLeft: 24,
    paddingRight: 25,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: "#ff9f4a",
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.9,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 18,
    height: 18,
  },
  headerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 180,
    gap: 16,
  },
  searchBar: {
    backgroundColor: "#2c2c2c",
    borderWidth: 1,
    borderColor: "rgba(255,159,74,0.1)",
    borderRadius: 999,
    minHeight: 76,
    paddingLeft: 21,
    paddingRight: 12,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  searchBarIcon: {
    width: 28,
    height: 20,
  },
  searchPlaceholder: {
    flex: 1,
    paddingHorizontal: 12,
    color: "#adaaaa",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "500",
  },
  searchActionButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "#ff9f4a",
    alignItems: "center",
    justifyContent: "center",
  },
  searchActionIcon: {
    width: 22,
    height: 22,
  },
  fuelChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  fuelChip: {
    backgroundColor: "#474747",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  fuelChipActive: {
    backgroundColor: "#ff9f4a",
  },
  fuelChipText: {
    color: "#adaaaa",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  fuelChipTextActive: {
    color: "#442100",
  },
  filterSummary: {
    backgroundColor: "#131313",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  filterSummaryTitle: {
    color: "#f5f5f5",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  filterSummaryText: {
    color: "#ff9f4a",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  filterPanel: {
    backgroundColor: "#131313",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  filterPanelLabel: {
    color: "#f7f7f7",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  filterChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#474747",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#202020",
  },
  filterChipActive: {
    backgroundColor: "#ff9f4a",
    borderColor: "#ff9f4a",
  },
  filterChipText: {
    color: "#c3c3c3",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#442100",
  },
  midgradeShortcut: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  midgradeShortcutText: {
    color: "#ff9f4a",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  statusCard: {
    backgroundColor: "#131313",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    color: "#d0d0d0",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorText: {
    color: "#ff7b72",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  stationCardWrap: {
    gap: 10,
  },
  stationCard: {
    backgroundColor: "#131313",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  stationCardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.995 }],
  },
  stationCardTop: {
    backgroundColor: "#262626",
    minHeight: 104,
    padding: 20,
    justifyContent: "center",
    gap: 4,
  },
  stationName: {
    color: "#ffffff",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
  },
  stationAddress: {
    color: "#adaaaa",
    fontSize: 14,
    lineHeight: 20,
  },
  stationUpdated: {
    marginTop: 8,
    color: "rgba(255,159,74,0.75)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  stationCardBottom: {
    flexDirection: "row",
    minHeight: 87,
    backgroundColor: "rgba(255,159,74,0.05)",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,159,74,0.1)",
  },
  pricePanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,159,74,0.1)",
  },
  priceValue: {
    color: "#ff9f4a",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.75,
  },
  priceCaption: {
    marginTop: 4,
    color: "rgba(255,159,74,0.7)",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },
  distancePanel: {
    width: 160,
    backgroundColor: "#ff9f4a",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  distanceValue: {
    color: "#442100",
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  distanceCaption: {
    marginTop: 2,
    color: "#442100",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },
  stationDetails: {
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#262626",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  detailsHeading: {
    color: "#ffffff",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  detailsText: {
    color: "#d2d2d2",
    fontSize: 13,
    lineHeight: 18,
  },
  otherFuelWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  otherFuelChip: {
    minWidth: 102,
    backgroundColor: "#202020",
    borderWidth: 1,
    borderColor: "#2e2e2e",
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  otherFuelLabel: {
    color: "#ffffff",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  otherFuelValue: {
    color: "#ff9f4a",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  otherFuelUpdated: {
    color: "#9f9f9f",
    fontSize: 11,
    lineHeight: 14,
  },
  mapsButton: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "#ff9f4a",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  mapsButtonText: {
    color: "#442100",
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "700",
  },
  floatingButton: {
    position: "absolute",
    right: 24,
    bottom: 96,
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "#ff9f4a",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ff9f4a",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  floatingButtonIcon: {
    width: 20,
    height: 24,
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "rgba(14,14,14,0.92)",
  },
  bottomNavActiveItem: {
    minWidth: 96,
    borderRadius: 999,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 8,
  },
  bottomNavItem: {
    minWidth: 96,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 8,
    opacity: 0.6,
  },
  bottomNavActiveIcon: {
    width: 18,
    height: 16,
  },
  bottomNavIcon: {
    width: 20,
    height: 18,
  },
  bottomNavActiveLabel: {
    marginTop: 4,
    color: "#ff9f4a",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    letterSpacing: 1,
  },
  bottomNavLabel: {
    marginTop: 4,
    color: "#adaaaa",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    letterSpacing: 1,
  },
});
