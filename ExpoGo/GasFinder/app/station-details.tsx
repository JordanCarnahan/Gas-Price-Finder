import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FuelFinderTabBar } from "@/components/fuel-finder-tab-bar";
import { createGoogleMapsUrl } from "@/lib/stations";

const heroImage = require("../assets/images/gas-title-image.png");
const directionsIcon = require("../assets/images/station-details-directions-icon.png");
const actionBackIcon = require("../assets/images/station-details-back-icon.png");
const USE_DUMMY_HISTORY_DATA = true;
const CALIFORNIA_LAST_WEEK_REGULAR_DUMMY = [5.77, 5.76, 5.75, 5.75, 5.74, 5.73, 5.73];

type StationParams = {
  id: number;
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
  distanceMiles: number | null;
};

type HistoryRow = {
  run_timestamp: string;
  regular: number | null;
  midgrade: number | null;
  premium: number | null;
  diesel: number | null;
};

type FuelKey = "diesel" | "regular" | "midgrade" | "premium";

type GraphPoint = {
  dayLabel: string;
  price: number | null;
};

const fuelCards: {
  key: FuelKey;
  label: string;
  eta?: boolean;
}[] = [
  { key: "regular", label: "Regular", eta: true },
  { key: "midgrade", label: "MidGrade" },
  { key: "premium", label: "Premium" },
  { key: "diesel", label: "Diesel" },
];

function parseStation(raw: string | string[] | undefined): StationParams | null {
  if (!raw) {
    return null;
  }

  const value = Array.isArray(raw) ? raw[0] : raw;

  try {
    return JSON.parse(value) as StationParams;
  } catch {
    return null;
  }
}

function money(value: number | null): string {
  if (value == null) {
    return "N/A";
  }

  return `$${value.toFixed(2)}`;
}

function creditPrice(value: number | null): number | null {
  if (value == null) {
    return null;
  }

  return Number((value + 0.1).toFixed(2));
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function estimateEta(distanceMiles: number | null): string {
  if (distanceMiles == null) {
    return "N/A";
  }

  const minutes = Math.max(3, Math.round((distanceMiles / 25) * 60));
  return `${minutes} min`;
}

function buildSevenDaySeries(rows: HistoryRow[], fuel: FuelKey): GraphPoint[] {
  const latestByDay = new Map<string, number>();
  let latestDataDate: Date | null = null;

  rows.forEach((row) => {
    const price = row[fuel];
    if (price == null) {
      return;
    }

    const runDate = new Date(row.run_timestamp);
    const dateKey = formatDateKey(runDate);
    const dayDate = new Date(runDate);
    dayDate.setHours(0, 0, 0, 0);

    if (!latestDataDate || dayDate > latestDataDate) {
      latestDataDate = dayDate;
    }

    if (!latestByDay.has(dateKey)) {
      latestByDay.set(dateKey, price);
    }
  });

  const anchorDate = latestDataDate ?? new Date();
  const points: GraphPoint[] = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(anchorDate);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    const dateKey = formatDateKey(date);

    points.push({
      dayLabel: formatDayLabel(date),
      price: latestByDay.get(dateKey) ?? null,
    });
  }

  return points;
}

function withDummyHistoryData(points: GraphPoint[], fallbackPrice: number | null) {
  if (points.length !== 7) {
    return points;
  }

  const anchor = fallbackPrice ?? CALIFORNIA_LAST_WEEK_REGULAR_DUMMY[6];
  const delta = anchor - CALIFORNIA_LAST_WEEK_REGULAR_DUMMY[6];

  return points.map((point, index) => ({
    ...point,
    price: Number((CALIFORNIA_LAST_WEEK_REGULAR_DUMMY[index] + delta).toFixed(2)),
  }));
}

function HistoryChart({ points }: { points: GraphPoint[] }) {
  const BAR_MIN_HEIGHT = 12;
  const BAR_MAX_HEIGHT = 58;
  const prices = points.flatMap((point) => (point.price == null ? [] : [point.price]));
  const max = Math.max(...prices, 0);
  const min = Math.min(...prices, max);
  const range = max - min || 0.35;
  const pricedPoints = points.filter((point): point is GraphPoint & { price: number } => point.price != null);
  const latestPrice = pricedPoints.at(-1)?.price ?? null;
  const previousPrice = pricedPoints.at(-2)?.price ?? null;
  const dailyChangePercent =
    latestPrice != null && previousPrice != null && previousPrice !== 0
      ? ((latestPrice - previousPrice) / previousPrice) * 100
      : null;

  return (
    <View style={styles.historyCard}>
      <Text style={styles.historyTitle}>PRICE HISTORY (LAST 7 DAYS)</Text>
      <View style={styles.historyBars}>
        {points.map((point, index) => {
          const height =
            point.price == null
              ? BAR_MIN_HEIGHT
              : Math.max(((point.price - min) / range) * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT) + BAR_MIN_HEIGHT, BAR_MIN_HEIGHT);
          const isAccent = index === points.length - 1;
          const priceLabel = point.price == null ? "N/A" : `$${point.price.toFixed(2)}`;

          return (
            <View key={`${point.dayLabel}-${index}`} style={styles.historyBarWrap}>
              <Text style={[styles.historyPriceLabel, isAccent && styles.historyPriceLabelAccent]}>
                {priceLabel}
              </Text>
              <View style={[styles.historyBar, { height, backgroundColor: isAccent ? "#ff9f4a" : "#444444" }]} />
              <Text style={[styles.historyDay, isAccent && styles.historyDayAccent]}>{point.dayLabel}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.historyFooter}>
        <Text style={styles.historyFooterLabel}>Daily %</Text>
        <Text style={styles.historyFooterValue}>
          {dailyChangePercent == null
            ? "N/A"
            : `${dailyChangePercent >= 0 ? "+" : ""}${dailyChangePercent.toFixed(1)}%`}
        </Text>
      </View>
    </View>
  );
}

export default function StationDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ station?: string }>();
  const station = useMemo(() => parseStation(params.station), [params.station]);
  const [historyPoints, setHistoryPoints] = useState<GraphPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const historyTableName = process.env.EXPO_PUBLIC_SUPABASE_HISTORY_TABLE ?? "gas_price_history";

  useEffect(() => {
    if (!station || !supabaseUrl || !supabaseAnonKey) {
      return;
    }

    let isMounted = true;

    const loadHistory = async () => {
      setHistoryLoading(true);

      try {
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(startDate.getDate() - 6);

        const query = new URLSearchParams({
          select: "run_timestamp,regular,midgrade,premium,diesel",
          order: "run_timestamp.desc",
          run_timestamp: `gte.${startDate.toISOString()}`,
        });

        if (station.station_id) {
          query.set("station_id", `eq.${station.station_id}`);
        } else {
          query.set("station_name", `eq.${station.station_name}`);
          if (station.address) {
            query.set("address", `eq.${station.address}`);
          } else {
            query.set("city", `eq.${station.city}`);
          }
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/${historyTableName}?${query.toString()}`, {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        });

        const payload = await response.json();
        const rows = Array.isArray(payload) ? (payload as HistoryRow[]) : [];
        const realPoints = buildSevenDaySeries(rows, "regular");
        const points = USE_DUMMY_HISTORY_DATA
          ? withDummyHistoryData(realPoints, station.regular)
          : realPoints;

        if (isMounted) {
          setHistoryPoints(points);
        }
      } catch {
        if (isMounted) {
          const fallbackPoints = buildSevenDaySeries([], "regular");
          setHistoryPoints(
            USE_DUMMY_HISTORY_DATA
              ? withDummyHistoryData(fallbackPoints, station.regular)
              : fallbackPoints
          );
        }
      } finally {
        if (isMounted) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [historyTableName, station, supabaseAnonKey, supabaseUrl]);

  if (!station) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.screen}>
          <View style={styles.missingState}>
            <Text style={styles.missingTitle}>Station not found</Text>
            <Pressable onPress={() => router.replace("/(tabs)")} style={styles.backButton}>
              <Text style={styles.backButtonText}>Back to List</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.screen}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.headerBackButton}>
              <Ionicons color="#ffffff" name="close" size={16} />
            </Pressable>
            <Text style={styles.headerBrand}>Fuel Finder</Text>
          </View>

          <View style={styles.heroCard}>
            <Image contentFit="cover" source={heroImage} style={styles.heroImage} />
            <View style={styles.heroOverlay}>
              <Text style={styles.heroTitle}>{station.station_name}</Text>
              <Text style={styles.heroAddress}>{station.address ? `${station.address}, ${station.city}` : station.city}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Fuel Prices</Text>

          {fuelCards.map((fuel) => {
            const cash = station[fuel.key];
            const credit = creditPrice(cash);

            return (
              <View key={fuel.key} style={styles.priceCard}>
                <View style={styles.priceCardHeader}>
                  <Text style={styles.priceCardLabel}>{fuel.label.toUpperCase()}</Text>
                  {fuel.eta ? (
                    <View style={styles.etaBadge}>
                      <Text style={styles.etaLabel}>ETA</Text>
                      <Text style={styles.etaValue}>{estimateEta(station.distanceMiles)}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.priceSplitRow}>
                  <View style={[styles.pricePanel, styles.pricePanelDark]}>
                    <Text style={[styles.pricePanelLabel, styles.pricePanelLabelDark]}>CASH</Text>
                    <Text style={[styles.pricePanelValue, styles.pricePanelValueDark]}>{money(cash)}</Text>
                  </View>
                  <View style={[styles.pricePanel, styles.pricePanelAccent]}>
                    <Text style={[styles.pricePanelLabel, styles.pricePanelLabelAccent]}>CARD</Text>
                    <Text style={[styles.pricePanelValue, styles.pricePanelValueAccent]}>{money(credit)}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          {historyLoading ? (
            <View style={styles.historyLoading}>
              <ActivityIndicator color="#ff9f4a" />
            </View>
          ) : (
            <HistoryChart points={historyPoints} />
          )}

          <View style={styles.actionsCard}>
            <Pressable
              onPress={() => void Linking.openURL(createGoogleMapsUrl(station))}
              style={styles.directionsButton}>
              <Image contentFit="contain" source={directionsIcon} style={styles.actionIcon} />
              <Text style={styles.directionsButtonText}>Get Directions</Text>
            </Pressable>

            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Image contentFit="contain" source={actionBackIcon} style={styles.actionBackIcon} />
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>
          </View>
        </ScrollView>

        <FuelFinderTabBar activeTab="list" />
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 160,
    gap: 16,
  },
  header: {
    paddingHorizontal: 8,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 17,
  },
  headerBackButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#262626",
  },
  headerBrand: {
    color: "#ff9f4a",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroCard: {
    height: 256,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: .8,
    bottom: 85,
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    backgroundColor: "rgba(38,38,38,0.55)",
    padding: 16,
  },
  heroTitle: {
    color: "#ff9f4a",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.75,
  },
  heroAddress: {
    marginTop: 4,
    color: "#adaaaa",
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    paddingHorizontal: 8,
    color: "#e4e2e1",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
  },
  priceCard: {
    backgroundColor: "#262626",
    borderRadius: 12,
    paddingTop: 12,
    overflow: "hidden",
  },
  priceCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  priceCardLabel: {
    color: "#ff9f4a",
    fontSize: 15,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,159,74,0.1)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  etaLabel: {
    color: "#ff9f4a",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "700",
  },
  etaValue: {
    color: "#ffffff",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600",
  },
  priceSplitRow: {
    flexDirection: "row",
  },
  pricePanel: {
    flex: 1,
    minHeight: 86,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  pricePanelDark: {
    backgroundColor: "#1a1a1a",
  },
  pricePanelAccent: {
    backgroundColor: "#ff9f4a",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(0,0,0,0.2)",
  },
  pricePanelValue: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  pricePanelValueDark: {
    color: "#ff9f4a",
  },
  pricePanelValueAccent: {
    color: "#1b1208",
  },
  pricePanelLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  pricePanelLabelDark: {
    color: "#ffb06a",
  },
  pricePanelLabelAccent: {
    color: "#1b1208",
  },
  historyCard: {
    backgroundColor: "#262626",
    borderRadius: 12,
    padding: 20,
    gap: 16,
    minHeight: 160,
  },
  historyTitle: {
    color: "#e4e2e1",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  historyBars: {
    height: 96,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 4,
  },
  historyBarWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  historyPriceLabel: {
    color: "#8f8b88",
    fontSize: 8,
    lineHeight: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  historyPriceLabelAccent: {
    color: "#ff9f4a",
  },
  historyBar: {
    width: "68%",
    minWidth: 10,
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    marginBottom: 8,
  },
  historyDay: {
    color: "#adaaaa",
    fontSize: 8,
    lineHeight: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  historyDayAccent: {
    color: "#ff9f4a",
  },
  historyFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(72,72,71,0.2)",
    paddingTop: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyFooterLabel: {
    color: "#adaaaa",
    fontSize: 10,
    lineHeight: 15,
  },
  historyFooterValue: {
    color: "#ff9f4a",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
  },
  historyLoading: {
    backgroundColor: "#262626",
    borderRadius: 12,
    padding: 20,
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsCard: {
    backgroundColor: "#262626",
    borderRadius: 12,
    padding: 24,
    gap: 16,
    marginBottom: 8,
  },
  directionsButton: {
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: "#ff9f4a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#ff9f4a",
    shadowOpacity: 0.15,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  directionsButtonText: {
    color: "#442100",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  actionIcon: {
    width: 20,
    height: 20,
  },
  backButton: {
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,159,74,0.1)",
    backgroundColor: "#1a1a1a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBackIcon: {
    width: 16,
    height: 16,
  },
  backButtonText: {
    color: "#ff9f4a",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  missingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  missingTitle: {
    color: "#ffffff",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
  },
});
