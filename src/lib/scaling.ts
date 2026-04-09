/**
 * Responsive scaling utilities for cross-device compatibility.
 * Scales UI elements based on screen dimensions relative to a base design (375x812 - iPhone 11).
 */

import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base design dimensions (iPhone 11 / standard 375pt wide)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Horizontal scale factor
export const widthScale = SCREEN_WIDTH / BASE_WIDTH;
// Vertical scale factor
export const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;

/**
 * Scale a horizontal dimension (width, horizontal padding, etc.)
 */
export function s(size: number): number {
  return Math.round(size * widthScale);
}

/**
 * Scale a vertical dimension (height, vertical padding, etc.)
 */
export function vs(size: number): number {
  return Math.round(size * heightScale);
}

/**
 * Scale a font size with moderate scaling (avoids too-large fonts on big screens).
 * Uses a blend of width and identity to keep text readable without becoming huge.
 */
export function fs(size: number): number {
  const newSize = size * widthScale;
  // Clamp: don't scale fonts up more than 25% or down more than 15%
  const clampedSize = Math.max(size * 0.85, Math.min(size * 1.25, newSize));
  return Math.round(PixelRatio.roundToNearestPixel(clampedSize));
}

/**
 * Moderate scale - a gentler version that scales less aggressively.
 * Good for padding and border radius.
 */
export function ms(size: number, factor: number = 0.5): number {
  return Math.round(size + (s(size) - size) * factor);
}

/**
 * Current screen dimensions (live)
 */
export function getScreenDimensions() {
  return Dimensions.get('window');
}

export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;

// Breakpoints for screen size classification
export const isSmallDevice = SCREEN_WIDTH < 375;    // iPhone SE, older small phones
export const isMediumDevice = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414;  // iPhone standard
export const isLargeDevice = SCREEN_WIDTH >= 414;   // Plus/Max/Pro Max, large Androids

// Platform-aware safe tab bar heights
export const TAB_BAR_HEIGHT = Platform.OS === 'ios'
  ? (isSmallDevice ? 70 : 84)
  : (isSmallDevice ? 56 : 64);
