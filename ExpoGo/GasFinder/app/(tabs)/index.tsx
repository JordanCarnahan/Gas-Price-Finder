import { useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

type FuelType = "regular" | "midgrade" | "premium" | "diesel";
type SortOrder = "cheapest" | "most_expensive";

type GasRow = {
  id: number;
  city: string;
  station_name: string;
  address: string | null;
  regular: number | null;
  midgrade: number | null;
  premium: number | null;
  diesel: number | null;
  updated_at?: string;
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
};

function getPriceForFuel(row: GasRow, fuel: FuelType): number | null {
  return row[fuel];
}

export default function HomeScreen() {
  const [rows, setRows] = useState<GasRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedFuel, setSelectedFuel] = useState<FuelType>("regular");
  const [sortOrder, setSortOrder] = useState<SortOrder>("cheapest");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const tableName = process.env.EXPO_PUBLIC_SUPABASE_TABLE ?? "gas_prices";

  const canFetch = useMemo(() => Boolean(supabaseUrl && supabaseAnonKey), [supabaseUrl, supabaseAnonKey]);
  const visibleRows = useMemo(() => {
    const withPrice = rows.filter((row) => getPriceForFuel(row, selectedFuel) != null);
    const withoutPrice = rows.filter((row) => getPriceForFuel(row, selectedFuel) == null);
    const sorted = [...withPrice].sort((a, b) => {
      const aPrice = getPriceForFuel(a, selectedFuel) as number;
      const bPrice = getPriceForFuel(b, selectedFuel) as number;
      return sortOrder === "cheapest" ? aPrice - bPrice : bPrice - aPrice;
    });
    return [...sorted, ...withoutPrice];
  }, [rows, selectedFuel, sortOrder]);

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
      const query = "select=id,city,station_name,address,regular,midgrade,premium,diesel&order=city.asc,station_name.asc";
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

      setRows(Array.isArray(payload) ? payload : []);
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
