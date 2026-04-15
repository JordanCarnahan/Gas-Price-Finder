import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { type DimensionValue, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type FuelType, type SortOrder, useFilters } from "@/hooks/use-filters";

const closeIcon = "https://www.figma.com/api/mcp/asset/98612d6f-9aa2-49ef-be0f-aa8ffeac6c0c";
const distanceIcon = "https://www.figma.com/api/mcp/asset/46295102-437d-48d5-907b-2b4ca169eaae";
const priceIcon = "https://www.figma.com/api/mcp/asset/791691ea-5d99-4d51-a54e-dacf25a79f38";

const DISTANCE_OPTIONS = [5, 10, 20] as const;

const fuelButtonLabels: Record<FuelType, string> = {
  diesel: "Diesel",
  regular: "Regular",
  midgrade: "Plus",
  premium: "Premium",
};

function getDistanceThumbLeft(distance: number): DimensionValue {
  const index = DISTANCE_OPTIONS.indexOf(distance as (typeof DISTANCE_OPTIONS)[number]);
  const normalizedIndex = index === -1 ? 1 : index;
  return `${normalizedIndex * 50}%`;
}

export default function ModalScreen() {
  const router = useRouter();
  const { applyFilters, maxDistance, selectedFuel, sortOrder } = useFilters();
  const [draftFuel, setDraftFuel] = useState<FuelType>(selectedFuel);
  const [draftSortOrder, setDraftSortOrder] = useState<SortOrder>(sortOrder);
  const [draftMaxDistance, setDraftMaxDistance] = useState<number>(maxDistance);

  useEffect(() => {
    setDraftFuel(selectedFuel);
    setDraftSortOrder(sortOrder);
    setDraftMaxDistance(maxDistance);
  }, [maxDistance, selectedFuel, sortOrder]);

  const sliderProgress = useMemo(() => {
    const index = DISTANCE_OPTIONS.indexOf(draftMaxDistance as (typeof DISTANCE_OPTIONS)[number]);
    return index <= 0 ? "0%" : index === 1 ? "50%" : "100%";
  }, [draftMaxDistance]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.screen}>
        <View style={styles.headerWrap}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable onPress={() => router.back()} style={styles.closeButton}>
                <Image contentFit="contain" source={closeIcon} style={styles.closeIcon} />
              </Pressable>
              <Text style={styles.headerTitle}>Filters</Text>
            </View>
            <Text style={styles.headerBrand}>FuelFinder</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fuel Type</Text>
            <View style={styles.fuelGrid}>
              {(["diesel", "regular", "midgrade", "premium"] as FuelType[]).map((fuel) => (
                <Pressable
                  key={fuel}
                  onPress={() => setDraftFuel(fuel)}
                  style={[styles.fuelButton, draftFuel === fuel && styles.fuelButtonActive]}>
                  <Text style={[styles.fuelButtonText, draftFuel === fuel && styles.fuelButtonTextActive]}>
                    {fuelButtonLabels[fuel]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Max Distance</Text>
              <Text style={styles.distanceValue}>{draftMaxDistance} mi</Text>
            </View>

            <View style={styles.sliderCard}>
              <View style={styles.sliderTrack}>
                <View style={styles.sliderTrackBase} />
                <View style={[styles.sliderProgress, { width: sliderProgress }]} />
                <View style={[styles.sliderThumb, { left: getDistanceThumbLeft(draftMaxDistance) }]} />

                {DISTANCE_OPTIONS.map((distance) => (
                  <Pressable
                    key={distance}
                    onPress={() => setDraftMaxDistance(distance)}
                    style={[
                      styles.sliderHitArea,
                      distance === 5 && styles.sliderHitAreaStart,
                      distance === 10 && styles.sliderHitAreaMiddle,
                      distance === 20 && styles.sliderHitAreaEnd,
                    ]}
                  />
                ))}
              </View>

              <View style={styles.sliderLabels}>
                {DISTANCE_OPTIONS.map((distance) => (
                  <Pressable key={distance} onPress={() => setDraftMaxDistance(distance)}>
                    <Text style={styles.sliderLabel}>{`<${distance} miles`}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sort Results By</Text>

            <View style={styles.sortCard}>
              <View style={styles.sortLabelWrap}>
                <Image contentFit="contain" source={distanceIcon} style={styles.sortIconSmall} />
                <Text style={styles.sortLabel}>Distance</Text>
              </View>
              <View style={styles.toggleWrap}>
                <Pressable
                  onPress={() => setDraftSortOrder("closest")}
                  style={[styles.toggleButton, draftSortOrder === "closest" && styles.toggleButtonActive]}>
                  <Text
                    style={[
                      styles.toggleButtonText,
                      draftSortOrder === "closest" && styles.toggleButtonTextActive,
                    ]}>
                    ASC
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setDraftSortOrder("furthest")}
                  style={[styles.toggleButton, draftSortOrder === "furthest" && styles.toggleButtonActive]}>
                  <Text
                    style={[
                      styles.toggleButtonText,
                      draftSortOrder === "furthest" && styles.toggleButtonTextActive,
                    ]}>
                    DESC
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.sortCard, styles.sortCardHighlighted]}>
              <View style={styles.sortLabelWrap}>
                <Image contentFit="contain" source={priceIcon} style={styles.sortIconWide} />
                <Text style={styles.sortLabel}>Price</Text>
              </View>
              <View style={styles.toggleWrap}>
                <Pressable
                  onPress={() => setDraftSortOrder("cheapest")}
                  style={[styles.toggleButton, draftSortOrder === "cheapest" && styles.toggleButtonActive]}>
                  <Text
                    style={[
                      styles.toggleButtonText,
                      draftSortOrder === "cheapest" && styles.toggleButtonTextActive,
                    ]}>
                    LOW-HIGH
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setDraftSortOrder("most_expensive")}
                  style={[styles.toggleButton, draftSortOrder === "most_expensive" && styles.toggleButtonActive]}>
                  <Text
                    style={[
                      styles.toggleButtonText,
                      draftSortOrder === "most_expensive" && styles.toggleButtonTextActive,
                    ]}>
                    HIGH-LOW
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={() => {
              setDraftFuel("regular");
              setDraftSortOrder("cheapest");
              setDraftMaxDistance(10);
            }}
            style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              applyFilters({
                selectedFuel: draftFuel,
                sortOrder: draftSortOrder,
                maxDistance: draftMaxDistance,
              });
              router.back();
            }}
            style={styles.applyButton}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
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
  headerWrap: {
    paddingBottom: 8,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 17,
  },
  closeButton: {
    width: 29,
    height: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  closeIcon: {
    width: 14,
    height: 14,
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headerBrand: {
    color: "#ff9f4a",
    fontSize: 18,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -1.2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 232,
    gap: 40,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#e4e2e1",
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "700",
  },
  fuelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  fuelButton: {
    width: "48.2%",
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: "#474747",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  fuelButtonActive: {
    backgroundColor: "#ff9f4a",
  },
  fuelButtonText: {
    color: "#adaaaa",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  fuelButtonTextActive: {
    color: "#512800",
    fontWeight: "600",
  },
  distanceValue: {
    color: "#ff9f4a",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
  },
  sliderCard: {
    backgroundColor: "#131313",
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  sliderTrack: {
    height: 24,
    justifyContent: "center",
    position: "relative",
  },
  sliderTrackBase: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: "#474747",
    borderRadius: 999,
  },
  sliderProgress: {
    position: "absolute",
    left: 0,
    height: 8,
    backgroundColor: "#ff9f4a",
    borderRadius: 999,
  },
  sliderThumb: {
    position: "absolute",
    marginLeft: -12,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#ff9f4a",
    borderWidth: 4,
    borderColor: "#0e0e0e",
  },
  sliderHitArea: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "34%",
  },
  sliderHitAreaStart: {
    left: 0,
  },
  sliderHitAreaMiddle: {
    left: "33%",
  },
  sliderHitAreaEnd: {
    right: 0,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sliderLabel: {
    color: "#adaaaa",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  sortCard: {
    backgroundColor: "#131313",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sortCardHighlighted: {
    borderWidth: 2,
    borderColor: "rgba(255,159,74,0.2)",
    padding: 18,
  },
  sortLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sortIconSmall: {
    width: 14,
    height: 20,
  },
  sortIconWide: {
    width: 22,
    height: 16,
  },
  sortLabel: {
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
  },
  toggleWrap: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#262626",
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    minWidth: 55,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleButtonActive: {
    backgroundColor: "#ff9f4a",
  },
  toggleButtonText: {
    color: "#adaaaa",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  toggleButtonTextActive: {
    color: "#512800",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: "row",
    gap: 16,
    backgroundColor: "rgba(14,14,14,0.8)",
  },
  resetButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonText: {
    color: "#ff9f4a",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  applyButton: {
    flex: 1.6,
    minHeight: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff9f4a",
    shadowColor: "#ff9f4a",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  applyButtonText: {
    color: "#532a00",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});
