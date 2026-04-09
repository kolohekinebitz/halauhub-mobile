/**
 * InteractiveTour
 * A self-contained, on-demand walkthrough system.
 * No cross-screen ref wiring needed — each step describes where on screen
 * the pointer should appear (0–1 relative coords) and what to say.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Dimensions,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { ChevronRight, ChevronLeft, X, Sparkles, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/lib/useColorScheme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TourStep {
  /** 0–1 relative X on screen where the pointer lands */
  targetX: number;
  /** 0–1 relative Y on screen where the pointer lands */
  targetY: number;
  /** Main instructional text */
  text: string;
  /** Optional short label shown above text */
  label?: string;
  /** Optional icon name hint (display only) */
  icon?: React.ReactNode;
}

export interface TourConfig {
  id: string;
  title: string;
  steps: TourStep[];
}

interface InteractiveTourProps {
  config: TourConfig | null;
  onClose: () => void;
  primaryColor?: string;
}

// ─── Pointer / Spotlight ──────────────────────────────────────────────────────

function SpotlightPointer({
  x,
  y,
  color,
}: {
  x: number;
  y: number;
  color: string;
}) {
  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);
  const pulse3 = useSharedValue(1);
  const opacity1 = useSharedValue(0.5);
  const opacity2 = useSharedValue(0.4);
  const opacity3 = useSharedValue(0.3);

  useEffect(() => {
    pulse1.value = withRepeat(
      withSequence(
        withTiming(2.2, { duration: 900 }),
        withTiming(1, { duration: 0 })
      ),
      -1,
      false
    );
    opacity1.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 900 }),
        withTiming(0.5, { duration: 0 })
      ),
      -1,
      false
    );

    pulse2.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(2.2, { duration: 900 }),
          withTiming(1, { duration: 0 })
        ),
        -1,
        false
      )
    );
    opacity2.value = withDelay(
      300,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 900 }),
          withTiming(0.4, { duration: 0 })
        ),
        -1,
        false
      )
    );

    pulse3.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(2.2, { duration: 900 }),
          withTiming(1, { duration: 0 })
        ),
        -1,
        false
      )
    );
    opacity3.value = withDelay(
      600,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 900 }),
          withTiming(0.3, { duration: 0 })
        ),
        -1,
        false
      )
    );
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse1.value }],
    opacity: opacity1.value,
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse2.value }],
    opacity: opacity2.value,
  }));
  const ring3Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse3.value }],
    opacity: opacity3.value,
  }));

  const px = x * SCREEN_WIDTH;
  const py = y * SCREEN_HEIGHT;

  return (
    <View
      style={[StyleSheet.absoluteFillObject, { pointerEvents: 'none' }]}
    >
      {/* Rings */}
      <Animated.View
        style={[
          styles.ring,
          ring3Style,
          { left: px - 36, top: py - 36, borderColor: color, width: 72, height: 72, borderRadius: 36 },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          ring2Style,
          { left: px - 28, top: py - 28, borderColor: color, width: 56, height: 56, borderRadius: 28 },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          ring1Style,
          { left: px - 22, top: py - 22, borderColor: color, width: 44, height: 44, borderRadius: 22 },
        ]}
      />
      {/* Core dot */}
      <View
        style={[
          styles.coreDot,
          { left: px - 10, top: py - 10, backgroundColor: color },
        ]}
      />
      {/* Inner white center */}
      <View
        style={[
          styles.innerDot,
          { left: px - 4, top: py - 4 },
        ]}
      />
    </View>
  );
}

// ─── Tooltip Card ─────────────────────────────────────────────────────────────

function TooltipCard({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onClose,
  onSkip,
  primaryColor,
  isDark,
}: {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onSkip: () => void;
  primaryColor: string;
  isDark: boolean;
}) {
  const insets = useSafeAreaInsets();
  const isLast = stepIndex === totalSteps - 1;
  const isFirst = stepIndex === 0;

  // Position card: if pointer is in top half, card goes bottom; else card goes top
  const pointerIsInTopHalf = step.targetY < 0.55;

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(18)}
      exiting={SlideOutDown.duration(200)}
      style={[
        styles.tooltipContainer,
        pointerIsInTopHalf
          ? { bottom: insets.bottom + 24 }
          : { top: insets.top + 16 },
        {
          backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.6 : 0.18,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
          elevation: 20,
        },
      ]}
    >
      {/* Step indicator */}
      <View style={styles.stepRow}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === stepIndex
                      ? primaryColor
                      : isDark
                      ? '#333'
                      : '#E5E7EB',
                  width: i === stepIndex ? 20 : 7,
                },
              ]}
            />
          ))}
        </View>

        {/* Close */}
        <Pressable
          onPress={onClose}
          style={[
            styles.closeBtn,
            { backgroundColor: isDark ? '#2A2A2A' : '#F3F4F6' },
          ]}
        >
          <X size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
        </Pressable>
      </View>

      {/* Label */}
      {step.label && (
        <View style={[styles.labelPill, { backgroundColor: `${primaryColor}18` }]}>
          {step.icon ? (
            <View style={{ marginRight: 5 }}>{step.icon}</View>
          ) : (
            <MapPin size={11} color={primaryColor} style={{ marginRight: 4 }} />
          )}
          <Text style={[styles.labelText, { color: primaryColor }]}>
            {step.label}
          </Text>
        </View>
      )}

      {/* Main text */}
      <Text
        style={[
          styles.stepText,
          { color: isDark ? '#F5F5F5' : '#111827' },
        ]}
      >
        {step.text}
      </Text>

      {/* Counter + nav */}
      <View style={styles.navRow}>
        {/* Skip link — shown on all steps except the last */}
        {!isLast ? (
          <Pressable onPress={onSkip} hitSlop={8}>
            <Text style={[styles.skipText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
              Skip Tutorial
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.counter, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
            {stepIndex + 1} / {totalSteps}
          </Text>
        )}

        <View style={styles.navBtns}>
          {!isFirst && (
            <Pressable
              onPress={onPrev}
              style={[
                styles.navBtn,
                {
                  backgroundColor: isDark ? '#2A2A2A' : '#F3F4F6',
                  marginRight: 8,
                },
              ]}
            >
              <ChevronLeft size={18} color={isDark ? '#D1D5DB' : '#374151'} />
            </Pressable>
          )}
          <Pressable
            onPress={onNext}
            style={[
              styles.nextBtn,
              { backgroundColor: primaryColor },
            ]}
          >
            {isLast ? (
              <>
                <Sparkles size={15} color="#fff" />
                <Text style={styles.nextBtnText}>Done</Text>
              </>
            ) : (
              <>
                <Text style={styles.nextBtnText}>Next</Text>
                <ChevronRight size={15} color="#fff" />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function InteractiveTour({
  config,
  onClose,
  primaryColor = '#5A9EAD',
}: InteractiveTourProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [currentStep, setCurrentStep] = React.useState(0);

  // Reset step when config changes
  useEffect(() => {
    if (config) {
      setCurrentStep(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [config?.id]);

  const handleNext = useCallback(() => {
    if (!config) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep < config.steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    }
  }, [config, currentStep, onClose]);

  const handlePrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  }, [onClose]);

  if (!config) return null;

  const step = config.steps[currentStep];

  return (
    <Modal
      transparent
      visible={!!config}
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Dark overlay */}
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={[StyleSheet.absoluteFillObject, styles.overlay]}
        pointerEvents="box-none"
      >
        {/* Tap-to-advance overlay area (excluding tooltip) */}
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={handleNext}
        />
      </Animated.View>

      {/* Spotlight pointer */}
      <Animated.View
        key={`pointer-${currentStep}`}
        entering={FadeIn.duration(400)}
        exiting={FadeOut.duration(200)}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      >
        <SpotlightPointer
          x={step.targetX}
          y={step.targetY}
          color={primaryColor}
        />
      </Animated.View>

      {/* Connecting line from pointer to tooltip */}
      <Animated.View
        key={`line-${currentStep}`}
        entering={FadeIn.delay(200).duration(300)}
        style={[
          styles.connectingLine,
          {
            left: step.targetX * SCREEN_WIDTH - 1,
            top: step.targetY < 0.55
              ? step.targetY * SCREEN_HEIGHT + 14
              : undefined,
            bottom: step.targetY >= 0.55
              ? SCREEN_HEIGHT - step.targetY * SCREEN_HEIGHT + 14
              : undefined,
            height: Math.abs(
              (step.targetY < 0.55
                ? (1 - step.targetY) * SCREEN_HEIGHT - 180
                : step.targetY * SCREEN_HEIGHT - 200)
            ) * 0.18,
            backgroundColor: `${primaryColor}50`,
          },
        ]}
        pointerEvents="none"
      />

      {/* Tooltip card */}
      <View
        style={styles.tooltipWrapper}
        pointerEvents="box-none"
      >
        <TooltipCard
          key={`tooltip-${currentStep}`}
          step={step}
          stepIndex={currentStep}
          totalSteps={config.steps.length}
          onNext={handleNext}
          onPrev={handlePrev}
          onClose={handleClose}
          onSkip={handleClose}
          primaryColor={primaryColor}
          isDark={isDark}
        />
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  coreDot: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  innerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  tooltipWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    pointerEvents: 'box-none',
  },
  tooltipContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 24,
    padding: 20,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  stepText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 18,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counter: {
    fontSize: 13,
    fontWeight: '500',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  navBtns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 22,
    gap: 5,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  connectingLine: {
    position: 'absolute',
    width: 2,
    borderRadius: 1,
  },
});
