import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FuelFinderTabBar } from "@/components/fuel-finder-tab-bar";
import { StationListCard } from "@/components/station-list-card";
import { useFavorites } from "@/hooks/use-favorites";
import { useFilters } from "@/hooks/use-filters";
import { useStationsData } from "@/hooks/use-stations-data";
import { useVehicleConfig } from "@/hooks/use-vehicle-config";
import {
  buildVisibleRows,
  createGoogleMapsUrl,
  fuelLabels,
  getStationKey,
  HOME_FUEL_CHIPS,
} from "@/lib/stations";

export default function HomeScreen() {
  const router = useRouter();
  const { favoriteStationKeys, isFavorite, toggleFavorite } = useFavorites();
  const { canFetch, errorMessage, loading, refreshStations, rows, userCoords } = useStationsData();
  const { maxDistance, selectedFuel, setSelectedFuel, sortOrder } = useFilters();
  const { fuelEconomy, gallonsNeeded, isConfigured, isLocationStepComplete } = useVehicleConfig();

  useEffect(() => {
    if (!isConfigured) {
      router.replace("/fuel-configuration");
      return;
    }

    if (!isLocationStepComplete) {
      router.replace("/location-access");
    }
  }, [isConfigured, isLocationStepComplete, router]);

  useEffect(() => {
    if (isConfigured && isLocationStepComplete && canFetch && rows.length === 0 && !loading) {
      void refreshStations();
    }
  }, [canFetch, isConfigured, isLocationStepComplete, loading, refreshStations, rows.length]);

  const visibleRows = useMemo(
    () =>
      buildVisibleRows({
        rows,
        selectedFuel,
        sortOrder,
        maxDistance,
        userCoords,
        fuelEconomy,
        gallonsNeeded,
      }),
    [fuelEconomy, gallonsNeeded, maxDistance, rows, selectedFuel, sortOrder, userCoords]
  );

  if (!isConfigured || !isLocationStepComplete) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.brandWrap}>
            <Ionicons color="#ff9f4a" name="search-outline" size={18} />
            <Text style={styles.brand}>Fuel Finder</Text>
          </View>

          <Pressable onPress={() => router.push("/modal")} style={styles.headerAction}>
            <MaterialCommunityIcons color="#ff9f4a" name="tune-variant" size={18} />
          </Pressable>
        </View>
        <View style={styles.headerDivider} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}>
          <View style={styles.chipRow}>
            {HOME_FUEL_CHIPS.map((fuel) => (
              <Pressable
                key={fuel}
                onPress={() => setSelectedFuel(fuel)}
                style={[styles.chip, selectedFuel === fuel && styles.chipActive]}>
                <Text style={[styles.chipText, selectedFuel === fuel && styles.chipTextActive]}>
                  {fuelLabels[fuel]}
                </Text>
              </Pressable>
            ))}
          </View>

          {!canFetch ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusText}>
                Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to load stations.
              </Text>
            </View>
          ) : null}

          {loading && rows.length === 0 ? (
            <View style={styles.statusCard}>
              <ActivityIndicator color="#ff9f4a" />
            </View>
          ) : null}

          {!!errorMessage ? (
            <View style={styles.statusCard}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {visibleRows.map((row) => {
            const stationKey = getStationKey(row);

            return (
              <StationListCard
                isFavorite={isFavorite(stationKey)}
                key={stationKey}
                onAddressPress={() => void Linking.openURL(createGoogleMapsUrl(row))}
                onPress={() =>
                  router.push({
                    pathname: "/station-details",
                    params: { station: JSON.stringify(row) },
                  } as never)
                }
                onToggleFavorite={() => toggleFavorite(stationKey)}
                row={row}
                selectedFuel={selectedFuel}
              />
            );
          })}

          {!loading && visibleRows.length === 0 && !errorMessage && canFetch ? (
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>No stations available</Text>
              <Text style={styles.statusText}>
                No {fuelLabels[selectedFuel].toLowerCase()} stations match the current filters within {maxDistance} miles.
              </Text>
            </View>
          ) : null}

          {!loading && favoriteStationKeys.length > 0 ? <View style={styles.bottomSpacer} /> : null}
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
  header: {
    height: 61,
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brand: {
    color: "#ff9f4a",
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  headerAction: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 160,
    gap: 16,
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 6,
    backgroundColor: "#474747",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: "#ff9f4a",
  },
  chipText: {
    color: "#adaaaa",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#442100",
  },
  statusCard: {
    minHeight: 96,
    borderRadius: 12,
    backgroundColor: "#131313",
    borderWidth: 1,
    borderColor: "#262626",
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  statusTitle: {
    color: "#ffffff",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  statusText: {
    color: "#adaaaa",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  errorText: {
    color: "#ff8b7a",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  bottomSpacer: {
    height: 16,
  },
});
