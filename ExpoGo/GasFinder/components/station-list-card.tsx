import { Ionicons } from "@expo/vector-icons";
import { type GestureResponderEvent, Pressable, StyleSheet, Text, View } from "react-native";

import { type FuelType } from "@/hooks/use-filters";
import {
  type DisplayRow,
  formatDistanceLabel,
  formatStationAddress,
  formatUpdatedLabel,
  getPriceForFuel,
  getUpdatedForFuel,
  money,
} from "@/lib/stations";

type StationListCardProps = {
  isFavorite: boolean;
  onAddressPress: () => void;
  onPress: () => void;
  onToggleFavorite: () => void;
  row: DisplayRow;
  selectedFuel: FuelType;
};

export function StationListCard({
  isFavorite,
  onAddressPress,
  onPress,
  onToggleFavorite,
  row,
  selectedFuel,
}: StationListCardProps) {
  const handleAddressPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onAddressPress();
  };

  const handleFavoritePress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onToggleFavorite();
  };

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <View style={styles.headerTopRow}>
            <Text numberOfLines={1} style={styles.stationName}>
              {row.station_name}
            </Text>
            <Text numberOfLines={1} style={styles.updatedLabel}>
              Updated {formatUpdatedLabel(getUpdatedForFuel(row, selectedFuel))}
            </Text>
          </View>

          <Pressable onPress={handleAddressPress} style={styles.addressButton}>
            <Text numberOfLines={1} style={styles.addressLine}>
              <Text style={styles.addressText}>{formatStationAddress(row)}</Text>
              <Text style={styles.addressText}> • </Text>
              <Text style={styles.distanceText}>{formatDistanceLabel(row.distanceMiles)}</Text>
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityLabel={isFavorite ? "Remove station from favorites" : "Add station to favorites"}
          hitSlop={10}
          onPress={handleFavoritePress}
          style={styles.favoriteButton}>
          <Ionicons
            color={isFavorite ? "#f4ea2a" : "#7f7a76"}
            name={isFavorite ? "star" : "star-outline"}
            size={20}
          />
        </Pressable>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.leftPricePanel}>
          <Text style={styles.leftPriceValue}>{money(getPriceForFuel(row, selectedFuel))}</Text>
          <Text style={styles.leftPriceCaption}>PER GALLON</Text>
        </View>

        <View style={styles.rightPricePanel}>
          <Text style={styles.rightPriceValue}>{money(row.fuelPriceTotal)}</Text>
          <Text style={styles.rightPriceCaption}>TOTAL FILL-UP COST</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#131313",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#262626",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.995 }],
  },
  header: {
    backgroundColor: "#262626",
    paddingLeft: 14,
    paddingRight: 10,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stationName: {
    flex: 1,
    color: "#ffffff",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
  },
  updatedLabel: {
    flexShrink: 1,
    color: "#63f45e",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "right",
  },
  addressButton: {
    alignSelf: "flex-start",
  },
  addressLine: {
    color: "#adaaaa",
    fontSize: 13,
    lineHeight: 18,
  },
  addressText: {
    color: "#adaaaa",
  },
  distanceText: {
    color: "#ff9f4a",
    fontWeight: "800",
  },
  favoriteButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  leftPricePanel: {
    flex: 1,
    backgroundColor: "rgba(255,159,74,0.08)",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,159,74,0.12)",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: "center",
  },
  leftPriceValue: {
    color: "#ff9f4a",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -0.75,
  },
  leftPriceCaption: {
    marginTop: 2,
    color: "rgba(255,159,74,0.82)",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  rightPricePanel: {
    flex: 1,
    backgroundColor: "#ff9f4a",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: "center",
  },
  rightPriceValue: {
    color: "#1f1a16",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -0.75,
  },
  rightPriceCaption: {
    marginTop: 2,
    color: "#1f1a16",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
