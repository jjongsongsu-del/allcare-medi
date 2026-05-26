import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

export type AppDesignMode = "basic" | "design1" | "design2" | "design3";

type DesignModeContextValue = {
  designMode: AppDesignMode;
  isDesignOne: boolean;
  isDesignTwo: boolean;
  isDesignThree: boolean;
  loading: boolean;
  setDesignMode: (mode: AppDesignMode) => Promise<void>;
};

const designModeStorageKey = "allcaremedi.appDesignMode";
const DesignModeContext = createContext<DesignModeContextValue | null>(null);

export function DesignModeProvider({ children }: PropsWithChildren) {
  const [designMode, setDesignModeState] = useState<AppDesignMode>("basic");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDesignMode() {
      try {
        const stored = await AsyncStorage.getItem(designModeStorageKey);
        if (stored === "basic" || stored === "design1" || stored === "design2" || stored === "design3") {
          setDesignModeState(stored);
        }
      } finally {
        setLoading(false);
      }
    }

    loadDesignMode();
  }, []);

  const value = useMemo(
    () => ({
      designMode,
      isDesignOne: designMode === "design1",
      isDesignTwo: designMode === "design2",
      isDesignThree: designMode === "design3",
      loading,
      setDesignMode: async (nextMode: AppDesignMode) => {
        setDesignModeState(nextMode);
        await AsyncStorage.setItem(designModeStorageKey, nextMode);
      }
    }),
    [designMode, loading]
  );

  return <DesignModeContext.Provider value={value}>{children}</DesignModeContext.Provider>;
}

export function useDesignMode() {
  const value = useContext(DesignModeContext);
  if (!value) {
    throw new Error("useDesignMode must be used inside DesignModeProvider");
  }
  return value;
}
