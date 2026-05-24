import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

export type ExperienceMode = "easy" | "detail";

type ExperienceModeContextValue = {
  mode: ExperienceMode;
  isEasyMode: boolean;
  loading: boolean;
  setMode: (mode: ExperienceMode) => Promise<void>;
};

const modeStorageKey = "allcaremedi.experienceMode";
const ExperienceModeContext = createContext<ExperienceModeContextValue | null>(null);

export function ExperienceModeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ExperienceMode>("detail");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMode() {
      try {
        const stored = await AsyncStorage.getItem(modeStorageKey);
        if (stored === "easy" || stored === "detail") {
          setModeState(stored);
        }
      } finally {
        setLoading(false);
      }
    }

    loadMode();
  }, []);

  const value = useMemo(
    () => ({
      mode,
      isEasyMode: mode === "easy",
      loading,
      setMode: async (nextMode: ExperienceMode) => {
        setModeState(nextMode);
        await AsyncStorage.setItem(modeStorageKey, nextMode);
      }
    }),
    [loading, mode]
  );

  return <ExperienceModeContext.Provider value={value}>{children}</ExperienceModeContext.Provider>;
}

export function useExperienceMode() {
  const value = useContext(ExperienceModeContext);
  if (!value) {
    throw new Error("useExperienceMode must be used inside ExperienceModeProvider");
  }
  return value;
}
