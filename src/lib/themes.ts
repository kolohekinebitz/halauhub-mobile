// HalauHub Theme System
// Culturally-inspired color palettes with softer, modern tones

export interface ThemeColors {
  id: string;
  name: string;
  description: string;
  primary: string;
  primarySoft: string;
  primaryMuted: string;
  secondary: string;
  secondarySoft: string;
  accent: string;
  gradientStart: string;
  gradientEnd: string;
  // Cultural inspiration
  culturalNote?: string;
}

// Curated theme palettes inspired by Hawaiian and Pacific Island aesthetics
export const THEME_PALETTES: ThemeColors[] = [
  {
    id: 'ocean',
    name: 'Ocean Mist',
    description: 'Calm, coastal vibes',
    primary: '#5A9EAD',
    primarySoft: '#7AB5C2',
    primaryMuted: '#A8D0D8',
    secondary: '#E8A87C',
    secondarySoft: '#F0C4A8',
    accent: '#C38D9E',
    gradientStart: '#6AABB8',
    gradientEnd: '#4A8E9B',
    culturalNote: 'Inspired by the tranquil Pacific waters',
  },
  {
    id: 'sunset',
    name: 'Island Sunset',
    description: 'Warm, golden hues',
    primary: '#C17767',
    primarySoft: '#D99B8F',
    primaryMuted: '#E8C4BC',
    secondary: '#E8B87C',
    secondarySoft: '#F0D4A8',
    accent: '#8B7355',
    gradientStart: '#D4887A',
    gradientEnd: '#A85A4A',
    culturalNote: 'Reflecting Hawaiian sunset skies',
  },
  {
    id: 'fern',
    name: 'Fern Valley',
    description: 'Lush, natural greens',
    primary: '#5B8A72',
    primarySoft: '#7BA892',
    primaryMuted: '#A8C9B8',
    secondary: '#D4A574',
    secondarySoft: '#E4C4A0',
    accent: '#8B6B4A',
    gradientStart: '#6B9A82',
    gradientEnd: '#4A7A62',
    culturalNote: 'Inspired by Hawaiian rainforest ferns',
  },
  {
    id: 'orchid',
    name: 'Orchid Garden',
    description: 'Elegant, soft purples',
    primary: '#8B7B9B',
    primarySoft: '#A89BB5',
    primaryMuted: '#C8BED5',
    secondary: '#D4A5A5',
    secondarySoft: '#E4C5C5',
    accent: '#9B8B7B',
    gradientStart: '#9B8BAB',
    gradientEnd: '#7B6B8B',
    culturalNote: 'Honoring the beauty of Hawaiian orchids',
  },
  {
    id: 'sand',
    name: 'Sandy Shore',
    description: 'Warm, earthy neutrals',
    primary: '#A89078',
    primarySoft: '#C4B098',
    primaryMuted: '#D8D0C0',
    secondary: '#7B9B8B',
    secondarySoft: '#A0BBA8',
    accent: '#C8A080',
    gradientStart: '#B8A088',
    gradientEnd: '#988068',
    culturalNote: 'Echoing warm Hawaiian beaches',
  },
  {
    id: 'lagoon',
    name: 'Blue Lagoon',
    description: 'Deep, serene blues',
    primary: '#5B7B9B',
    primarySoft: '#7B9BB5',
    primaryMuted: '#A8BED5',
    secondary: '#9BB5A8',
    secondarySoft: '#B8D0C5',
    accent: '#D4A574',
    gradientStart: '#6B8BAB',
    gradientEnd: '#4B6B8B',
    culturalNote: 'Inspired by crystal-clear island lagoons',
  },
  {
    id: 'coral',
    name: 'Coral Reef',
    description: 'Vibrant, playful corals',
    primary: '#C88080',
    primarySoft: '#D8A0A0',
    primaryMuted: '#E8C8C8',
    secondary: '#80B8B8',
    secondarySoft: '#A0D0D0',
    accent: '#F0C080',
    gradientStart: '#D89090',
    gradientEnd: '#B87070',
    culturalNote: 'Celebrating Pacific coral reefs',
  },
  {
    id: 'volcanic',
    name: 'Volcanic Earth',
    description: 'Rich, grounded tones',
    primary: '#6B5B5B',
    primarySoft: '#8B7B7B',
    primaryMuted: '#B8A8A8',
    secondary: '#C89B7B',
    secondarySoft: '#D8B898',
    accent: '#A87B5B',
    gradientStart: '#7B6B6B',
    gradientEnd: '#5B4B4B',
    culturalNote: 'Honoring the volcanic origins of Hawaii',
  },
  {
    id: 'plumeria',
    name: 'Plumeria Bloom',
    description: 'Soft, floral whites',
    primary: '#9B8B7B',
    primarySoft: '#B5A898',
    primaryMuted: '#D0C8C0',
    secondary: '#E8D8C8',
    secondarySoft: '#F0E8E0',
    accent: '#D8A8B8',
    gradientStart: '#AB9B8B',
    gradientEnd: '#8B7B6B',
    culturalNote: 'Inspired by fragrant plumeria flowers',
  },
  {
    id: 'maile',
    name: 'Maile Lei',
    description: 'Sacred, deep greens',
    primary: '#4B6B5B',
    primarySoft: '#6B8B7B',
    primaryMuted: '#98B8A8',
    secondary: '#B8A878',
    secondarySoft: '#D0C8A0',
    accent: '#8B7B5B',
    gradientStart: '#5B7B6B',
    gradientEnd: '#3B5B4B',
    culturalNote: 'Representing the sacred maile vine',
  },
  {
    id: 'tapa',
    name: 'Tapa Cloth',
    description: 'Traditional earth tones',
    primary: '#8B7058',
    primarySoft: '#A89078',
    primaryMuted: '#C8B8A8',
    secondary: '#5B4B3B',
    secondarySoft: '#7B6B5B',
    accent: '#D8C098',
    gradientStart: '#9B8068',
    gradientEnd: '#7B6048',
    culturalNote: 'Inspired by traditional kapa patterns',
  },
  {
    id: 'moonlight',
    name: 'Moonlit Shore',
    description: 'Cool, peaceful nights',
    primary: '#5B6B7B',
    primarySoft: '#7B8B9B',
    primaryMuted: '#A8B8C8',
    secondary: '#9BA8B8',
    secondarySoft: '#B8C8D5',
    accent: '#C8B8A8',
    gradientStart: '#6B7B8B',
    gradientEnd: '#4B5B6B',
    culturalNote: 'Reflecting moonlit Hawaiian nights',
  },
];

// Get theme by ID
export const getThemeById = (id: string): ThemeColors | undefined => {
  return THEME_PALETTES.find((t) => t.id === id);
};

// Default theme
export const DEFAULT_THEME = THEME_PALETTES[0]; // Ocean Mist

// App-wide UI constants with softer values
export const UI_CONSTANTS = {
  // Border radius (softer, more rounded)
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    full: 9999,
  },
  // Shadows (enhanced for buttons and cards)
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 6,
    },
    // Enhanced button shadow for prominent CTAs
    button: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 6,
    },
    // Extra prominent shadow for primary actions
    buttonStrong: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
  },
  // Spacing scale
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
  },
};

// Background patterns inspired by Hawaiian motifs
export const BACKGROUND_PATTERNS = [
  { id: 'none', name: 'None', value: undefined },
  { id: 'wave', name: 'Ocean Waves', value: 'wave' },
  { id: 'fern', name: 'Fern Leaves', value: 'fern' },
  { id: 'tapa', name: 'Tapa Pattern', value: 'tapa' },
  { id: 'plumeria', name: 'Plumeria', value: 'plumeria' },
];

// Dark mode color adjustments
export const getDarkModeColors = (theme: ThemeColors) => ({
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1A1A1A',
  border: '#2A2A2A',
  text: '#F5F5F5',
  textSecondary: '#A0A0A0',
  textMuted: '#707070',
  primary: theme.primary,
  primarySoft: theme.primaryMuted,
});

// Light mode color adjustments
export const getLightModeColors = (theme: ThemeColors) => ({
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: '#E8E8E8',
  text: '#1A1A1A',
  textSecondary: '#6B6B6B',
  textMuted: '#9B9B9B',
  primary: theme.primary,
  primarySoft: theme.primarySoft,
});
