import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

type AccessibilityContextValue = {
  highContrast: boolean;
  largeText: boolean;
  toggleHighContrast: () => void;
  toggleLargeText: () => void;
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function AccessibilityProvider({ children }: PropsWithChildren) {
  const [highContrast, setHighContrast] = useState(false);
  const [largeText, setLargeText] = useState(false);

  const value = useMemo(
    () => ({
      highContrast,
      largeText,
      toggleHighContrast: () => setHighContrast((current) => !current),
      toggleLargeText: () => setLargeText((current) => !current)
    }),
    [highContrast, largeText]
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibilitySettings() {
  const value = useContext(AccessibilityContext);
  if (!value) {
    throw new Error("useAccessibilitySettings must be used inside AccessibilityProvider");
  }
  return value;
}
