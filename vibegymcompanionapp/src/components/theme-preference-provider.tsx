import Storage from 'expo-sqlite/kv-store';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { Appearance } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemePreferenceContext =
  createContext<ThemePreferenceContextValue | null>(null);

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    Storage.getItemAsync('theme-preference')
      .then((value) => {
        if (!active) return;
        const savedPreference = parseThemePreference(value);
        setPreference(savedPreference);
        Appearance.setColorScheme(toColorScheme(savedPreference));
      })
      .catch(() => {
        if (active) Appearance.setColorScheme('unspecified');
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    Appearance.setColorScheme(toColorScheme(preference));
    void Storage.setItemAsync('theme-preference', preference).catch(() => {});
  }, [preference, ready]);

  if (!ready) return null;

  return (
    <ThemePreferenceContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const value = useContext(ThemePreferenceContext);
  if (!value) {
    throw new Error(
      'useThemePreference must be used within ThemePreferenceProvider',
    );
  }
  return value;
}

function parseThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

function toColorScheme(preference: ThemePreference) {
  return preference === 'system' ? 'unspecified' : preference;
}
