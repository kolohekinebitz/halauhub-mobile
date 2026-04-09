import { useColorScheme as useSystemColorScheme } from 'react-native';
import { useAppStore } from './store';

export function useColorScheme(): 'light' | 'dark' {
  const isDarkMode = useAppStore((s) => s.isDarkMode);

  // Use the store's dark mode setting, which persists user preference
  return isDarkMode ? 'dark' : 'light';
}
