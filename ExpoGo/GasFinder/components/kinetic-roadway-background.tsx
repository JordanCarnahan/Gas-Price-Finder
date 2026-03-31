import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const ROADWAY_BACKGROUND =
  'https://www.figma.com/api/mcp/asset/62cb770b-1889-4360-b95b-25d0a8dda97c';

export function KineticRoadwayBackground() {
  return (
    <View pointerEvents="none" style={styles.container}>
      <Image contentFit="cover" source={ROADWAY_BACKGROUND} style={styles.image} />
      <View style={styles.overlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
    transform: [{ scale: 1.18 }],
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 14, 14, 0.76)',
  },
});
