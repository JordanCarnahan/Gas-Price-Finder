import { createContext, type PropsWithChildren, useContext, useMemo, useState } from "react";

type FavoritesContextValue = {
  favoriteStationKeys: string[];
  isFavorite: (stationKey: string) => boolean;
  toggleFavorite: (stationKey: string) => void;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: PropsWithChildren) {
  const [favoriteStationKeys, setFavoriteStationKeys] = useState<string[]>([]);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favoriteStationKeys,
      isFavorite: (stationKey) => favoriteStationKeys.includes(stationKey),
      toggleFavorite: (stationKey) => {
        setFavoriteStationKeys((current) =>
          current.includes(stationKey)
            ? current.filter((entry) => entry !== stationKey)
            : [...current, stationKey]
        );
      },
    }),
    [favoriteStationKeys]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error("useFavorites must be used within FavoritesProvider.");
  }

  return context;
}
