import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Colors } from '@/constants/theme';
import { FavoritesProvider } from '@/hooks/use-favorites';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FiltersProvider } from '@/hooks/use-filters';
import { StationsDataProvider } from '@/hooks/use-stations-data';
import { VehicleConfigProvider } from '@/hooks/use-vehicle-config';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const navigationTheme = colorScheme === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: palette.background,
          card: palette.card,
          text: palette.text,
          border: palette.border,
          primary: palette.tint,
          notification: palette.notification,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: palette.background,
          card: palette.card,
          text: palette.text,
          border: palette.border,
          primary: palette.tint,
          notification: palette.notification,
        },
      };

  return (
    <VehicleConfigProvider>
      <FiltersProvider>
        <StationsDataProvider>
          <FavoritesProvider>
            <ThemeProvider value={navigationTheme}>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="fuel-configuration" options={{ headerShown: false }} />
                <Stack.Screen name="location-access" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="station-details" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ headerShown: false, presentation: 'modal' }} />
              </Stack>
              <StatusBar style="light" />
            </ThemeProvider>
          </FavoritesProvider>
        </StationsDataProvider>
      </FiltersProvider>
    </VehicleConfigProvider>
  );
}
