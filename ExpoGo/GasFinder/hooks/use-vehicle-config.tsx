import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';

type VehicleConfigContextValue = {
  fuelEconomy: number | null;
  gallonsNeeded: number | null;
  isConfigured: boolean;
  locationPermission: 'allow' | 'deny' | null;
  isLocationStepComplete: boolean;
  saveConfig: (config: { fuelEconomy: number; gallonsNeeded: number }) => void;
  setLocationPermission: (permission: 'allow' | 'deny') => void;
};

const VehicleConfigContext = createContext<VehicleConfigContextValue | null>(null);

export function VehicleConfigProvider({ children }: PropsWithChildren) {
  const [gallonsNeeded, setGallonsNeeded] = useState<number | null>(null);
  const [fuelEconomy, setFuelEconomy] = useState<number | null>(null);
  const [locationPermission, setLocationPermissionState] = useState<'allow' | 'deny' | null>(null);

  const value = useMemo<VehicleConfigContextValue>(
    () => ({
      gallonsNeeded,
      fuelEconomy,
      isConfigured:
        gallonsNeeded != null && gallonsNeeded > 0 && fuelEconomy != null && fuelEconomy > 0,
      locationPermission,
      isLocationStepComplete: locationPermission != null,
      saveConfig: ({ fuelEconomy: nextFuelEconomy, gallonsNeeded: nextGallonsNeeded }) => {
        setFuelEconomy(nextFuelEconomy);
        setGallonsNeeded(nextGallonsNeeded);
      },
      setLocationPermission: (permission) => {
        setLocationPermissionState(permission);
      },
    }),
    [fuelEconomy, gallonsNeeded, locationPermission],
  );

  return <VehicleConfigContext.Provider value={value}>{children}</VehicleConfigContext.Provider>;
}

export function useVehicleConfig() {
  const context = useContext(VehicleConfigContext);

  if (!context) {
    throw new Error('useVehicleConfig must be used within VehicleConfigProvider.');
  }

  return context;
}
