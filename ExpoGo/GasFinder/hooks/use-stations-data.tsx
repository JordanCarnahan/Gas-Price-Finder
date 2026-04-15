import { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from "react";

import { BIOLA_COORDS, type GasRow, type UserCoords } from "@/lib/stations";

type StationsDataContextValue = {
  canFetch: boolean;
  errorMessage: string;
  loading: boolean;
  refreshStations: () => Promise<void>;
  rows: GasRow[];
  userCoords: UserCoords | null;
};

const StationsDataContext = createContext<StationsDataContextValue | null>(null);

export function StationsDataProvider({ children }: PropsWithChildren) {
  const [rows, setRows] = useState<GasRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [userCoords, setUserCoords] = useState<UserCoords | null>(null);
  const requestInFlightRef = useRef(false);

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const tableName = process.env.EXPO_PUBLIC_SUPABASE_TABLE ?? "gas_prices";

  const canFetch = useMemo(() => Boolean(supabaseUrl && supabaseAnonKey), [supabaseAnonKey, supabaseUrl]);

  const refreshStations = useCallback(async () => {
    if (requestInFlightRef.current) {
      return;
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      setErrorMessage("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    requestInFlightRef.current = true;
    setLoading(true);
    setErrorMessage("");

    try {
      setUserCoords(BIOLA_COORDS);

      const query =
        "select=id,run_timestamp,city,station_id,station_name,address,latitude,longitude,regular,regular_updated,midgrade,midgrade_updated,premium,premium_updated,diesel,diesel_updated&order=city.asc,station_name.asc";
      const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?${query}`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      });

      const payload = await response.json();
      if (!response.ok) {
        const apiMessage =
          typeof payload?.message === "string" ? payload.message : "Failed to fetch gas prices.";
        const missingTableMatch = apiMessage.match(/table\s+'public\.([^']+)'/i);

        if (missingTableMatch) {
          throw new Error(
            `Supabase table "${missingTableMatch[1]}" was not found. Check EXPO_PUBLIC_SUPABASE_TABLE in your .env file.`
          );
        }

        throw new Error(apiMessage);
      }

      setRows(Array.isArray(payload) ? (payload as GasRow[]) : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      setErrorMessage(message);
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }, [supabaseAnonKey, supabaseUrl, tableName]);

  const value = useMemo<StationsDataContextValue>(
    () => ({
      canFetch,
      errorMessage,
      loading,
      refreshStations,
      rows,
      userCoords,
    }),
    [canFetch, errorMessage, loading, refreshStations, rows, userCoords]
  );

  return <StationsDataContext.Provider value={value}>{children}</StationsDataContext.Provider>;
}

export function useStationsData() {
  const context = useContext(StationsDataContext);

  if (!context) {
    throw new Error("useStationsData must be used within StationsDataProvider.");
  }

  return context;
}
