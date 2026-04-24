import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import {
  type FuelType,
  type SortDirection,
  type SortField,
  useFilters,
} from "@/hooks/use-filters";

const timeCostIcon = "https://www.figma.com/api/mcp/asset/4de62d4f-d9ef-4bc1-9996-90c5c2b74d27";

const MIN_DISTANCE = 0;
const MAX_DISTANCE = 20;
const DEFAULT_TIME_COST = 0.5;

const fuelButtonLabels: Record<FuelType, string> = {
  diesel: "Diesel",
  regular: "Regular",
  midgrade: "Midgrade",
  premium: "Premium",
};

function clampDistance(distance: number) {
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, distance));
}

function formatTimeCostInput(value: number) {
  return value.toFixed(2);
}

function sanitizeMoneyInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");

  if (!cleaned) {
    return "";
  }

  const firstDecimalIndex = cleaned.indexOf(".");

  if (firstDecimalIndex === -1) {
    return cleaned;
  }

  const wholePartRaw = cleaned.slice(0, firstDecimalIndex);
  const fractionalRaw = cleaned.slice(firstDecimalIndex + 1).replace(/\./g, "");
  const wholePart = wholePartRaw.length > 0 ? wholePartRaw : "0";
  const fractionalPart = fractionalRaw.slice(0, 2);
  const hasTrailingDecimal = fractionalRaw.length === 0 && cleaned.endsWith(".");

  if (hasTrailingDecimal) {
    return `${wholePart}.`;
  }

  return `${wholePart}.${fractionalPart}`;
}

function parseTimeCostInput(value: string) {
  const normalized = value.trim();

  if (!normalized || normalized === ".") {
    return null;
  }

  const parsedValue = Number(normalized);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

export default function ModalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const {
    applyFilters,
    maxDistance,
    selectedFuel,
    sortDirection,
    sortField,
    timeCostPerMile,
  } = useFilters();
  const [draftFuel, setDraftFuel] = useState<FuelType>(selectedFuel);
  const [draftSortField, setDraftSortField] = useState<SortField>(sortField);
  const [draftSortDirection, setDraftSortDirection] = useState<SortDirection>(sortDirection);
  const [draftMaxDistance, setDraftMaxDistance] = useState<number>(clampDistance(Math.round(maxDistance)));
  const [draftTimeCostInput, setDraftTimeCostInput] = useState(formatTimeCostInput(timeCostPerMile));
  const [isSlidingDistance, setIsSlidingDistance] = useState(false);
  const [sliderTrackWidth, setSliderTrackWidth] = useState(0);
  const [sliderTrackPageX, setSliderTrackPageX] = useState(0);
  const sliderTrackRef = useRef<View>(null);

  useEffect(() => {
    setDraftFuel(selectedFuel);
    setDraftSortField(sortField);
    setDraftSortDirection(sortDirection);
    setDraftMaxDistance(clampDistance(Math.round(maxDistance)));
    setDraftTimeCostInput(formatTimeCostInput(timeCostPerMile));
  }, [maxDistance, selectedFuel, sortDirection, sortField, timeCostPerMile]);

  const sliderProgress = useMemo(() => `${(draftMaxDistance / MAX_DISTANCE) * 100}%`, [draftMaxDistance]);
  const sliderThumbLeft = useMemo(
    () => (sliderTrackWidth * draftMaxDistance) / MAX_DISTANCE,
    [draftMaxDistance, sliderTrackWidth]
  );

  const updateDistanceFromPageX = useCallback((pageX: number) => {
    if (sliderTrackWidth <= 0) {
      return;
    }

    const locationX = pageX - sliderTrackPageX;
    const clampedX = Math.min(sliderTrackWidth, Math.max(0, locationX));
    const ratio = clampedX / sliderTrackWidth;
    const nextDistance = clampDistance(Math.round(ratio * MAX_DISTANCE));
    setDraftMaxDistance(nextDistance);
  }, [sliderTrackPageX, sliderTrackWidth]);

  const measureSliderTrack = useCallback(() => {
    sliderTrackRef.current?.measureInWindow((x) => {
      setSliderTrackPageX(x);
    });
  }, []);

  const sliderPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          setIsSlidingDistance(true);
          updateDistanceFromPageX(event.nativeEvent.pageX);
        },
        onPanResponderMove: (event) => {
          updateDistanceFromPageX(event.nativeEvent.pageX);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => setIsSlidingDistance(false),
        onPanResponderTerminate: () => setIsSlidingDistance(false),
      }),
    [updateDistanceFromPageX]
  );

  const footerBottom = Math.max(insets.bottom, 8);
  const contentBottomPadding = 168 + footerBottom;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={styles.screen}>
        <View style={styles.headerWrap}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Pressable onPress={() => router.back()} style={styles.closeButton}>
                <Ionicons color="#ffffff" name="close" size={16} />
              </Pressable>
              <Text style={styles.headerTitle}>Filters</Text>
            </View>
            <Text style={styles.headerBrand}>FuelFinder</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: contentBottomPadding }]}
          keyboardShouldPersistTaps="handled"
          ref={scrollViewRef}
          scrollEnabled={!isSlidingDistance}
          showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fuel Type</Text>
            <View style={styles.fuelChipRow}>
              {(["regular", "midgrade", "premium", "diesel"] as FuelType[]).map((fuel) => (
                <Pressable
                  key={fuel}
                  onPress={() => setDraftFuel(fuel)}
                  style={[styles.fuelChip, draftFuel === fuel && styles.fuelChipActive]}>
                  <Text style={[styles.fuelChipText, draftFuel === fuel && styles.fuelChipTextActive]}>
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
              <View
                onLayout={(event) => {
                  setSliderTrackWidth(event.nativeEvent.layout.width);
                  requestAnimationFrame(measureSliderTrack);
                }}
                ref={sliderTrackRef}
                style={styles.sliderTrack}
                {...sliderPanResponder.panHandlers}>
                <View style={styles.sliderTrackBase} />
                <View style={[styles.sliderProgress, { width: sliderProgress }]} />
                <View style={[styles.sliderThumb, { left: sliderThumbLeft }]} />
              </View>

              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>0 mi</Text>
                <Text style={styles.sliderLabel}>10 mi</Text>
                <Text style={styles.sliderLabel}>20 mi</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sort Results By</Text>

            <View style={[styles.sortGroupCard, styles.sortCardActive]}>
              <View style={styles.sortGroupBlock}>
                <View style={styles.sortTypeRow}>
                  <Pressable
                    onPress={() => setDraftSortField("distance")}
                    style={[styles.sortTypeButton, draftSortField === "distance" && styles.sortTypeButtonActive]}>
                    <Text style={[styles.sortTypeText, draftSortField === "distance" && styles.sortTypeTextActive]}>
                      Distance
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDraftSortField("price")}
                    style={[styles.sortTypeButton, draftSortField === "price" && styles.sortTypeButtonActive]}>
                    <Text style={[styles.sortTypeText, draftSortField === "price" && styles.sortTypeTextActive]}>
                      Price
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDraftSortField("total_cost")}
                    style={[styles.sortTypeButton, draftSortField === "total_cost" && styles.sortTypeButtonActive]}>
                    <Text style={[styles.sortTypeText, draftSortField === "total_cost" && styles.sortTypeTextActive]}>
                      Total Cost
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.sortGroupDivider} />

              <View style={styles.sortOrderRow}>
                <Text style={[styles.sortLabel, styles.orderLabel]}>Order</Text>
                <View style={styles.toggleWrap}>
                  <Pressable
                    onPress={() => setDraftSortDirection("low_high")}
                    style={[styles.toggleButton, draftSortDirection === "low_high" && styles.toggleButtonActive]}>
                    <Text
                      style={[
                        styles.toggleButtonText,
                        draftSortDirection === "low_high" && styles.toggleButtonTextActive,
                      ]}>
                      LOW-HIGH
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDraftSortDirection("high_low")}
                    style={[styles.toggleButton, draftSortDirection === "high_low" && styles.toggleButtonActive]}>
                    <Text
                      style={[
                        styles.toggleButtonText,
                        draftSortDirection === "high_low" && styles.toggleButtonTextActive,
                      ]}>
                      HIGH-LOW
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={[styles.timeCostCard, styles.sortCardActive]}>
              <View style={styles.timeCostHeader}>
                <View style={styles.sortLabelWrap}>
                  <Image contentFit="contain" source={timeCostIcon} style={styles.timeCostIcon} />
                  <Text style={styles.sortLabel}>Time-Cost</Text>
                </View>
                <Text style={styles.timeCostPrompt}>HOW MUCH IS A MILE WORTH TO YOU?</Text>
              </View>

              <View style={styles.timeCostInputRow}>
                <TextInput
                  inputMode="decimal"
                  keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                  onBlur={() => {
                    const parsedValue = parseTimeCostInput(draftTimeCostInput);

                    if (parsedValue == null) {
                      setDraftTimeCostInput(formatTimeCostInput(DEFAULT_TIME_COST));
                      return;
                    }

                    setDraftTimeCostInput(formatTimeCostInput(parsedValue));
                  }}
                  onChangeText={(value) => setDraftTimeCostInput(sanitizeMoneyInput(value))}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 150);
                  }}
                  placeholder="0.50"
                  placeholderTextColor="#80654f"
                  selectionColor="#ff9f4a"
                  style={styles.timeCostInput}
                  value={draftTimeCostInput}
                />
                <Text style={styles.timeCostSuffix}>$ per mile</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { bottom: footerBottom }]}>
          <Pressable
            onPress={() => {
              setDraftFuel("regular");
              setDraftSortField("total_cost");
              setDraftSortDirection("low_high");
              setDraftMaxDistance(10);
              setDraftTimeCostInput(formatTimeCostInput(DEFAULT_TIME_COST));
            }}
            style={styles.resetButton}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              const parsedTimeCost = parseTimeCostInput(draftTimeCostInput);

              applyFilters({
                selectedFuel: draftFuel,
                sortField: draftSortField,
                sortDirection: draftSortDirection,
                maxDistance: draftMaxDistance,
                timeCostPerMile: parsedTimeCost ?? DEFAULT_TIME_COST,
              });
              router.back();
            }}
            style={styles.applyButton}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    borderRadius: 14.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#262626",
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
    paddingHorizontal: 24,
    gap: 40,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    color: "#e4e2e1",
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "700",
  },
  fuelChipRow: {
    flexDirection: "row",
    gap: 8,
  },
  fuelChip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 6,
    backgroundColor: "#474747",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  fuelChipActive: {
    backgroundColor: "#ff9f4a",
  },
  fuelChipText: {
    color: "#adaaaa",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  fuelChipTextActive: {
    color: "#442100",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
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
    top: 0,
    marginLeft: -12,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#ff9f4a",
    borderWidth: 4,
    borderColor: "#0e0e0e",
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
    borderWidth: 2,
    borderColor: "#422f1e",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sortCardActive: {
    borderColor: "rgba(255,159,74,0.2)",
  },
  sortGroupCard: {
    backgroundColor: "#131313",
    borderWidth: 2,
    borderColor: "#422f1e",
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  sortGroupBlock: {
    gap: 8,
  },
  sortGroupDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(72,72,71,0.3)",
  },
  sortOrderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  orderLabel: {
    minWidth: 56,
  },
  sortTypeRow: {
    flexDirection: "row",
    gap: 8,
  },
  sortTypeButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: "#262626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  sortTypeButtonActive: {
    backgroundColor: "#ff9f4a",
  },
  sortTypeText: {
    color: "#adaaaa",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  sortTypeTextActive: {
    color: "#442100",
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
  timeCostCard: {
    backgroundColor: "#131313",
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 18,
  },
  timeCostHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  timeCostIcon: {
    width: 24,
    height: 24,
  },
  timeCostPrompt: {
    flex: 1,
    color: "#adaaaa",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
  },
  timeCostInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 28,
  },
  timeCostInput: {
    width: 128,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#2c2c2c",
    color: "#ff9f4a",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    textAlign: "center",
  },
  timeCostSuffix: {
    color: "#ff9f4a",
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    flexDirection: "row",
    gap: 16,
    backgroundColor: "rgba(14,14,14,0.8)",
  },
  resetButton: {
    width: 124,
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
    flex: 1,
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
