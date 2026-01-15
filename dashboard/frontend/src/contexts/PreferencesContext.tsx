import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserPreferences {
  oddsFormat: 'american' | 'decimal' | 'fractional';
  defaultSport: string;
  defaultStake: number;
  preferredBookmakers: string[];
}

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => void;
  useDecimalOdds: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  oddsFormat: 'american',
  defaultSport: 'all',
  defaultStake: 100,
  preferredBookmakers: []
};

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('userPreferences');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      } catch (error) {
        console.error('Failed to load preferences:', error);
      }
    }
  }, []);

  // Save to localStorage whenever preferences change
  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    localStorage.setItem('userPreferences', JSON.stringify(newPreferences));
  };

  // Computed value for decimal odds
  const useDecimalOdds = preferences.oddsFormat === 'decimal';

  return (
    <PreferencesContext.Provider value={{ preferences, updatePreference, useDecimalOdds }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
