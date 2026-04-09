// Web-specific color scheme hook.
// Reads the persisted isDarkMode preference from the app store so that
// the user's dark mode toggle works on web exactly as it does on native.
import { useAppStore } from './store';

export function useColorScheme(): 'light' | 'dark' {
  const isDarkMode = useAppStore((s) => s.isDarkMode);
  return isDarkMode ? 'dark' : 'light';
}
