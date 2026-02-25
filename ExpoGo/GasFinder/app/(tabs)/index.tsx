import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

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

export default function HomeScreen() {
  const [rows, setRows] = useState<GasRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const tableName = process.env.EXPO_PUBLIC_SUPABASE_TABLE ?? "gas_prices";

  const canFetch = useMemo(() => Boolean(supabaseUrl && supabaseAnonKey), [supabaseUrl, supabaseAnonKey]);

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

      <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent}>
        {rows.map((row) => (
          <View key={row.id} style={styles.card}>
            <ThemedText type="defaultSemiBold">{row.station_name}</ThemedText>
            <ThemedText>{row.city}</ThemedText>
            <ThemedText>{row.address ?? "No address"}</ThemedText>
            <ThemedText>Regular: {row.regular ?? "N/A"} | Midgrade: {row.midgrade ?? "N/A"}</ThemedText>
            <ThemedText>Premium: {row.premium ?? "N/A"} | Diesel: {row.diesel ?? "N/A"}</ThemedText>
          </View>
        ))}
        {!loading && rows.length === 0 && !errorMessage && (
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
});
