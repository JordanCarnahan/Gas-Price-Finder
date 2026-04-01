import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useVehicleConfig } from '@/hooks/use-vehicle-config';

const MAP_BACKGROUND = 'https://www.figma.com/api/mcp/asset/6583fe3c-3ec3-4107-a6a9-c1a308d125e5';

export default function LocationAccessScreen() {
  const router = useRouter();
  const { isConfigured, setLocationPermission } = useVehicleConfig();

  const handleChoice = (permission: 'allow' | 'deny') => {
    setLocationPermission(permission);
    router.replace('/(tabs)');
  };

  if (!isConfigured) {
    router.replace('/fuel-configuration');
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <Image contentFit="cover" source={MAP_BACKGROUND} style={styles.mapBackground} />
        <View style={styles.mapOverlay} />
        <View style={styles.verticalFade} />

        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.cardHero}>
              <View style={styles.heroGlow} />
              <View style={styles.heroIconCircle}>
                <MaterialCommunityIcons name="map-marker-radius-outline" size={30} color="#ff9f4a" />
              </View>
              <View style={styles.heroAccent}>
                <MaterialCommunityIcons name="compass-outline" size={22} color="#9d8a59" />
              </View>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.title}>Find gas stations{'\n'}near you</Text>
              <Text style={styles.body}>
                Allow <Text style={styles.bodyAccent}>Fuel Finder</Text> to access your location
                while using the app?
              </Text>

              <View style={styles.actions}>
                <Pressable
                  onPress={() => handleChoice('allow')}
                  style={[styles.actionButton, styles.primaryAction]}>
                  <Text style={styles.primaryActionLabel}>Allow</Text>
                  <Ionicons name="arrow-forward" size={20} color="#442100" />
                </Pressable>

                <Pressable
                  onPress={() => handleChoice('deny')}
                  style={[styles.actionButton, styles.secondaryAction]}>
                  <Text style={styles.secondaryActionLabel}>Deny</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0e0e0e',
  },
  screen: {
    flex: 1,
    backgroundColor: '#0e0e0e',
    overflow: 'hidden',
  },
  mapBackground: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
    transform: [{ scale: 1.2 }],
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14,14,14,0.8)',
  },
  verticalFade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 118,
  },
  card: {
    borderRadius: 12,
    backgroundColor: '#131313',
    padding: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  cardHero: {
    height: 192,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -32,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: 'rgba(255,159,74,0.1)',
  },
  heroIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(38,38,38,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,159,74,0.2)',
  },
  heroAccent: {
    position: 'absolute',
    right: 112,
    top: 66,
    opacity: 0.55,
    transform: [{ rotate: '12deg' }],
  },
  cardBody: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 48,
    gap: 16,
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    letterSpacing: -0.75,
    textAlign: 'center',
  },
  body: {
    color: '#adadad',
    fontSize: 18,
    lineHeight: 29,
    textAlign: 'center',
    maxWidth: 244,
  },
  bodyAccent: {
    color: '#ff9f4a',
    fontWeight: '700',
  },
  actions: {
    width: '100%',
    gap: 16,
    paddingTop: 24,
  },
  actionButton: {
    minHeight: 60,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryAction: {
    backgroundColor: '#ff9f4a',
    shadowColor: '#ff9f4a',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  secondaryAction: {
    backgroundColor: '#262626',
  },
  primaryActionLabel: {
    color: '#442100',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
  },
  secondaryActionLabel: {
    color: '#ffffff',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '700',
  },
});
