import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FavoritesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.brand}>FuelFinder</Text>
        </View>
        <View style={styles.headerDivider} />

        <View style={styles.content}>
          <Text style={styles.title}>Favorites</Text>
          <Text style={styles.subtitle}>
            Saved stations have not been wired up yet. This tab is ready for the next Figma pass.
          </Text>

          <Pressable onPress={() => router.push("/(tabs)")} style={styles.button}>
            <Text style={styles.buttonText}>Back to List</Text>
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
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  brand: {
    color: "#ff9f4a",
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.9,
  },
  headerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  title: {
    color: "#ffffff",
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
  },
  subtitle: {
    color: "#adaaaa",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#ff9f4a",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#442100",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
});
