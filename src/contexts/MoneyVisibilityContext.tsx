import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

interface MoneyVisibilityContextType {
  showValues: boolean;
  toggleValues: () => void;
  maskValue: (value: string) => string;
}

const MoneyVisibilityContext = createContext<MoneyVisibilityContextType | undefined>(undefined);

const STORAGE_KEY = 'money_values_visible';
const MASK = '****';

export function MoneyVisibilityProvider({ children }: { children: ReactNode }) {
  const [showValues, setShowValues] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? stored === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(showValues));
  }, [showValues]);

  const toggleValues = () => setShowValues((prev) => !prev);

  const maskValue = (value: string) => {
    return showValues ? value : MASK;
  };

  const value = useMemo(
    () => ({
      showValues,
      toggleValues,
      maskValue,
    }),
    [showValues]
  );

  return <MoneyVisibilityContext.Provider value={value}>{children}</MoneyVisibilityContext.Provider>;
}

export function useMoneyVisibility() {
  const context = useContext(MoneyVisibilityContext);
  if (!context) {
    throw new Error('useMoneyVisibility must be used within a MoneyVisibilityProvider');
  }
  return context;
}


