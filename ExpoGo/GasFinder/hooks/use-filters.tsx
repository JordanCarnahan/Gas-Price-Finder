import { createContext, type PropsWithChildren, useContext, useMemo, useState } from "react";

export type FuelType = "regular" | "midgrade" | "premium" | "diesel";
export type SortOrder = "cheapest" | "most_expensive" | "closest" | "furthest";

type FiltersState = {
  selectedFuel: FuelType;
  sortOrder: SortOrder;
  maxDistance: number;
};

type FiltersContextValue = FiltersState & {
  applyFilters: (nextFilters: FiltersState) => void;
  resetFilters: () => void;
  setSelectedFuel: (fuel: FuelType) => void;
};

const DEFAULT_FILTERS: FiltersState = {
  selectedFuel: "regular",
  sortOrder: "cheapest",
  maxDistance: 10,
};

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: PropsWithChildren) {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);

  const value = useMemo<FiltersContextValue>(
    () => ({
      ...filters,
      applyFilters: (nextFilters) => {
        setFilters(nextFilters);
      },
      resetFilters: () => {
        setFilters(DEFAULT_FILTERS);
      },
      setSelectedFuel: (fuel) => {
        setFilters((current) => ({
          ...current,
          selectedFuel: fuel,
        }));
      },
    }),
    [filters]
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const context = useContext(FiltersContext);

  if (!context) {
    throw new Error("useFilters must be used within FiltersProvider.");
  }

  return context;
}
