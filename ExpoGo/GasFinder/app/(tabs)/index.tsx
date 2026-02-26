import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

type FuelType = "regular" | "midgrade" | "premium" | "diesel";
type SortOrder = "cheapest" | "most_expensive" | "closest";

type GasRow = {
  id: number;
  city: string;
  station_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  regular: number | null;
  midgrade: number | null;
  premium: number | null;
  diesel: number | null;
  updated_at?: string;
};

type UserCoords = {
  latitude: number;
  longitude: number;
};

const BIOLA_COORDS: UserCoords = {
  latitude: 33.9053,
  longitude: -117.9874,
};

const fuelLabels: Record<FuelType, string> = {
  regular: "Regular",
  midgrade: "Midgrade",
  premium: "Premium",
  diesel: "Diesel",
};

const sortLabels: Record<SortOrder, string> = {
  cheapest: "Cheapest",
  most_expensive: "Most expensive",
  closest: "Closest",
};

function getPriceForFuel(row: GasRow, fuel: FuelType): number | null {
  return row[fuel];
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

export default function HomeScreen() {
  const [rows, setRows] = useState<GasRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const [selectedFuel, setSelectedFuel] = useState<FuelType>("regular");
  const [sortOrder, setSortOrder] = useState<SortOrder>("cheapest");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const tableName = process.env.EXPO_PUBLIC_SUPABASE_TABLE ?? "gas_prices";

  const canFetch = useMemo(() => Boolean(supabaseUrl && supabaseAnonKey), [supabaseUrl, supabaseAnonKey]);
  const visibleRows = useMemo(() => {
    const rowsWithDistance = rows.map((row) => {
      if (!userCoords || row.latitude == null || row.longitude == null) {
        return { ...row, distanceMiles: null as number | null };
      }
      const distanceMiles = haversineMiles(userCoords, {
        latitude: row.latitude,
        longitude: row.longitude,
      });
      return { ...row, distanceMiles };
    });

    if (sortOrder === "closest") {
      const withDistance = rowsWithDistance.filter((row) => row.distanceMiles != null);
      const withoutDistance = rowsWithDistance.filter((row) => row.distanceMiles == null);
      const sorted = [...withDistance].sort((a, b) => (a.distanceMiles as number) - (b.distanceMiles as number));
      return [...sorted, ...withoutDistance];
    }

    const withPrice = rowsWithDistance.filter((row) => getPriceForFuel(row, selectedFuel) != null);
    const withoutPrice = rowsWithDistance.filter((row) => getPriceForFuel(row, selectedFuel) == null);
    const sorted = [...withPrice].sort((a, b) => {
      const aPrice = getPriceForFuel(a, selectedFuel) as number;
      const bPrice = getPriceForFuel(b, selectedFuel) as number;
      return sortOrder === "cheapest" ? aPrice - bPrice : bPrice - aPrice;
    });
    return [...sorted, ...withoutPrice];
  }, [rows, selectedFuel, sortOrder, userCoords]);

  const openInMaps = async (address: string, city: string) => {
    const query = encodeURIComponent(`${address}, ${city}`);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    await Linking.openURL(url);
  };

  const onFetchPress = async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      setErrorMessage("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      setUserCoords(BIOLA_COORDS);

      const query = "select=id,city,station_name,address,latitude,longitude,regular,midgrade,premium,diesel&order=city.asc,station_name.asc";
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
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Gas Finder</ThemedText>
      <Pressable style={[styles.button, !canFetch && styles.buttonDisabled]} onPress={onFetchPress} disabled={!canFetch || loading}>
        <ThemedText style={styles.buttonText}>Fetch local gas prices</ThemedText>
      </Pressable>
      {!canFetch && (
        <ThemedText style={styles.message}>Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your Expo .env file.</ThemedText>
      )}
      {loading && <ActivityIndicator />}
      {!!errorMessage && <ThemedText style={styles.error}>{errorMessage}</ThemedText>}

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

      <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent}>
        {visibleRows.map((row) => (
          <View key={row.id} style={styles.card}>
            <ThemedText type="defaultSemiBold">{row.station_name}</ThemedText>
            {row.address ? (
              <Pressable onPress={() => openInMaps(row.address as string, row.city)}>
                <ThemedText style={styles.mapLink}>{`${row.address}, ${row.city}`}</ThemedText>
              </Pressable>
            ) : (
              <ThemedText>{row.city}</ThemedText>
            )}
            <ThemedText style={styles.selectedPrice}>
              {fuelLabels[selectedFuel]}: {getPriceForFuel(row, selectedFuel) ?? "N/A"}
            </ThemedText>
            <ThemedText>
              Distance: {row.distanceMiles == null ? "N/A" : `${row.distanceMiles.toFixed(2)} mi`}
            </ThemedText>
            <ThemedText>Regular: {row.regular ?? "N/A"} | Midgrade: {row.midgrade ?? "N/A"}</ThemedText>
            <ThemedText>Premium: {row.premium ?? "N/A"} | Diesel: {row.diesel ?? "N/A"}</ThemedText>
          </View>
        ))}
        {!loading && visibleRows.length === 0 && !errorMessage && (
          <ThemedText style={styles.message}>No rows loaded yet.</ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#1f6feb",
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
  selectedPrice: {
    color: "#2fbf4a",
    fontWeight: "700",
    fontSize: 17,
  },
  mapLink: {
    color: "#ffffff",
    textDecorationLine: "underline",
  },
});
