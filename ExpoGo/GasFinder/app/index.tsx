import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { KineticRoadwayBackground } from '@/components/kinetic-roadway-background';

export default function SplashScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <KineticRoadwayBackground />
        <View style={styles.topGlow} />
        <View style={styles.bottomFade} />

        <View style={styles.content}>
          <View style={styles.topSpacer} />

          <View style={styles.brandSection}>
            <View style={styles.logoWrap}>
              <View style={styles.logoGlow} />
              <View style={styles.logoCard}>
                <MaterialCommunityIcons name="gas-station" size={48} color="#ff9f4a" />
                <View style={styles.badge}>
                  <MaterialCommunityIcons name="shield-half-full" size={18} color="#ff9f4a" />
                </View>
              </View>
            </View>

            <Text style={styles.title}>FUEL FINDER</Text>
          </View>

          <View style={styles.bottomSection}>
            <View style={styles.infoCard}>
              <View style={styles.infoIconCircle}>
                <Ionicons name="information" size={18} color="#1b1209" />
              </View>
              <Text style={styles.infoText}>
                Find the best fuel prices and optimize your route based on your vehicle&apos;s
                efficiency.
              </Text>
            </View>

            <Pressable style={styles.ctaButton} onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.ctaLabel}>START NAVIGATING</Text>
              <Ionicons name="arrow-forward" size={20} color="#442100" />
            </Pressable>
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
  topGlow: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 420,
    height: 520,
    borderRadius: 240,
    backgroundColor: 'rgba(255,159,74,0.2)',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 300,
    backgroundColor: 'rgba(14,14,14,0.88)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'space-between',
  },
  topSpacer: {
    height: 96,
  },
  brandSection: {
    alignItems: 'center',
    gap: 32,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 152,
    height: 152,
    borderRadius: 76,
    backgroundColor: 'rgba(255,159,74,0.16)',
  },
  logoCard: {
    width: 128,
    height: 128,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(72,72,71,0.28)',
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff9f4a',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  badge: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(72,72,71,0.2)',
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#ff9f4a',
    fontSize: 48,
    lineHeight: 48,
    fontWeight: '900',
    letterSpacing: -2.4,
    textAlign: 'center',
  },
  bottomSection: {
    gap: 32,
  },
  infoCard: {
    backgroundColor: '#131313',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(72,72,71,0.14)',
    paddingHorizontal: 24,
    paddingVertical: 26,
    alignItems: 'center',
    gap: 14,
  },
  infoIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff9f4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    color: '#d3d0cc',
    fontSize: 14,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 280,
  },
  ctaButton: {
    minHeight: 68,
    borderRadius: 999,
    backgroundColor: '#ff9f4a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#ff9f4a',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  ctaLabel: {
    color: '#442100',
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '900',
  },
});
