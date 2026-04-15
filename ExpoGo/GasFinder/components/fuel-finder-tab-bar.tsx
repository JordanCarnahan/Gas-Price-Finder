import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type FuelFinderTabBarProps = {
  activeTab: "favorites" | "list";
};

export function FuelFinderTabBar({ activeTab }: FuelFinderTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Pressable
        onPress={() => {
          if (activeTab !== "list") {
            router.replace("/(tabs)");
          }
        }}
        style={[styles.item, activeTab === "list" && styles.itemActive]}>
        <MaterialCommunityIcons
          color={activeTab === "list" ? "#ff9f4a" : "#8c8783"}
          name="format-list-bulleted"
          size={20}
        />
        <Text style={[styles.label, activeTab === "list" && styles.labelActive]}>LIST</Text>
      </Pressable>

      <Pressable
        onPress={() => {
          if (activeTab !== "favorites") {
            router.replace("/(tabs)/explore");
          }
        }}
        style={[styles.item, activeTab === "favorites" && styles.itemActive]}>
        <Ionicons
          color={activeTab === "favorites" ? "#ff9f4a" : "#8c8783"}
          name={activeTab === "favorites" ? "heart-outline" : "heart-outline"}
          size={20}
        />
        <Text style={[styles.label, activeTab === "favorites" && styles.labelActive]}>FAVORITES</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingTop: 9,
    paddingHorizontal: 16,
    backgroundColor: "rgba(14,14,14,0.96)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  item: {
    minWidth: 140,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  itemActive: {
    backgroundColor: "#262626",
  },
  label: {
    color: "#8c8783",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },
  labelActive: {
    color: "#ff9f4a",
  },
});
