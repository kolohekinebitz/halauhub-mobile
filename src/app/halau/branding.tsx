import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  Image as ImageIcon,
  Check,
  Sparkles,
  Leaf,
  Sun,
  Moon,
  Waves,
  Mountain,
  Flower2,
  TreePalm,
  Lock,
  Building2,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import Animated, { FadeInDown, FadeIn, ZoomIn } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { THEME_PALETTES, type ThemeColors } from '@/lib/themes';
import { useSubscription } from '@/lib/useSubscription';

// Map theme IDs to icons
const getThemeIcon = (themeId: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    ocean: <Waves size={18} color="white" />,
    sunset: <Sun size={18} color="white" />,
    fern: <Leaf size={18} color="white" />,
    orchid: <Flower2 size={18} color="white" />,
    sand: <TreePalm size={18} color="white" />,
    lagoon: <Waves size={18} color="white" />,
    coral: <Sparkles size={18} color="white" />,
    volcanic: <Mountain size={18} color="white" />,
    plumeria: <Flower2 size={18} color="white" />,
    maile: <Leaf size={18} color="white" />,
    tapa: <Sparkles size={18} color="white" />,
    moonlight: <Moon size={18} color="white" />,
  };
  return iconMap[themeId] || <Sparkles size={18} color="white" />;
};

export default function HalauBrandingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Subscription check
  const { canCustomizeBranding, isLoading: subscriptionLoading, tier } = useSubscription();

  // Store
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const getHalau = useAppStore((s) => s.getHalau);
  const updateHalauBranding = useAppStore((s) => s.updateHalauBranding);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  // Form state
  const [selectedTheme, setSelectedTheme] = useState<ThemeColors>(
    THEME_PALETTES.find((t) => t.id === halau?.themeId) || THEME_PALETTES[0]
  );
  const [logo, setLogo] = useState<string | undefined>(halau?.logo);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (halau) {
      const theme = THEME_PALETTES.find((t) => t.id === halau.themeId) ||
                    THEME_PALETTES.find((t) => t.primary === halau.primaryColor) ||
                    THEME_PALETTES[0];
      setSelectedTheme(theme);
      setLogo(halau.logo);
    }
  }, [halau]);

  useEffect(() => {
    if (halau) {
      const currentTheme = THEME_PALETTES.find((t) => t.id === halau.themeId) ||
                           THEME_PALETTES.find((t) => t.primary === halau.primaryColor);
      const changed =
        selectedTheme.id !== currentTheme?.id ||
        logo !== halau.logo;
      setHasChanges(changed);
    }
  }, [selectedTheme, logo, halau]);

  const handlePickLogo = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to add a logo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setLogo(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleRemoveLogo = () => {
    setLogo(undefined);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSelectTheme = (theme: ThemeColors) => {
    setSelectedTheme(theme);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleSave = () => {
    if (!currentHalauId) return;

    updateHalauBranding(currentHalauId, {
      primaryColor: selectedTheme.primary,
      secondaryColor: selectedTheme.secondary,
      themeId: selectedTheme.id,
      logo,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success', 'Your school theme has been updated!');
    setHasChanges(false);
  };

  if (!halau) {
    return (
      <View className={cn('flex-1 items-center justify-center', isDark ? 'bg-black' : 'bg-gray-50')}>
        <Text className={cn('text-lg', isDark ? 'text-white' : 'text-gray-900')}>
          No school found
        </Text>
      </View>
    );
  }

  // Show upgrade prompt if not Enterprise tier
  if (!subscriptionLoading && !canCustomizeBranding) {
    return (
      <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-[#FAFAFA]')}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header */}
        <View
          className={cn('px-5 pb-4 border-b', isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-100')}
          style={{ paddingTop: insets.top + 12 }}
        >
          <View className="flex-row items-center justify-between">
            <BackButton />

            <Text className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              Customize Theme
            </Text>

            <View className="w-10" />
          </View>
        </View>

        {/* Upgrade Prompt */}
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-violet-500/20 items-center justify-center mb-6">
            <Lock size={40} color="#7c3aed" />
          </View>

          <Text className={cn('text-2xl font-bold text-center mb-3', isDark ? 'text-white' : 'text-gray-900')}>
            Enterprise Feature
          </Text>

          <Text className={cn('text-center mb-8 leading-6', isDark ? 'text-gray-400' : 'text-gray-600')}>
            Custom school branding is only available with the Enterprise plan. Upgrade to personalize your school with custom themes and logos.
          </Text>

          <Pressable
            onPress={() => router.push('/paywall')}
            className="px-8 py-4 rounded-2xl bg-violet-600 active:opacity-80"
          >
            <View className="flex-row items-center">
              <Building2 size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Upgrade to Enterprise</Text>
            </View>
          </Pressable>

          <Text className={cn('text-sm mt-4', isDark ? 'text-gray-500' : 'text-gray-400')}>
            Current plan: Free
          </Text>
        </View>
      </View>
    );
  }

  if (subscriptionLoading) {
    return (
      <View className={cn('flex-1 items-center justify-center', isDark ? 'bg-black' : 'bg-gray-50')}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  return (
    <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-[#FAFAFA]')}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        className={cn('px-5 pb-4 border-b', isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-100')}
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-row items-center justify-between">
          <BackButton />

          <Text className={cn('text-lg font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            Customize Theme
          </Text>

          <View className="w-10" />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: hasChanges ? 100 : 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-5 py-6">
          {/* Preview Card */}
          <Animated.View entering={FadeInDown.delay(50).duration(400)} className="mb-8">
            <Text className={cn('text-xs font-medium uppercase tracking-wider mb-3', isDark ? 'text-gray-500' : 'text-gray-400')}>
              Live Preview
            </Text>
            <View className="rounded-3xl overflow-hidden">
              <LinearGradient
                colors={[selectedTheme.gradientStart, selectedTheme.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 24 }}
              >
                <View className="items-center">
                  {logo ? (
                    <Animated.View entering={ZoomIn.duration(300)}>
                      <Image
                        source={{ uri: logo }}
                        className="w-20 h-20 rounded-2xl mb-4"
                        style={{ borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)' }}
                      />
                    </Animated.View>
                  ) : (
                    <View
                      className="w-20 h-20 rounded-2xl mb-4 items-center justify-center"
                      style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                    >
                      <Text className="text-4xl">🌺</Text>
                    </View>
                  )}
                  <Text className="text-white font-bold text-xl mb-1">{halau.name}</Text>
                  <Text className="text-white/70 text-sm mb-4">{selectedTheme.description}</Text>

                  {/* Sample UI Elements */}
                  <View className="flex-row gap-3">
                    <View
                      className="px-5 py-2.5 rounded-xl"
                      style={{ backgroundColor: selectedTheme.secondary }}
                    >
                      <Text className="text-white font-semibold text-sm">Primary</Text>
                    </View>
                    <View
                      className="px-5 py-2.5 rounded-xl"
                      style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                    >
                      <Text className="text-white font-semibold text-sm">Secondary</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Cultural Note */}
            {selectedTheme.culturalNote && (
              <Animated.View
                entering={FadeIn.delay(200).duration(400)}
                className={cn('mt-3 p-3 rounded-xl', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}
              >
                <Text className={cn('text-xs text-center italic', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {selectedTheme.culturalNote}
                </Text>
              </Animated.View>
            )}
          </Animated.View>

          {/* Logo Section */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-8">
            <Text className={cn('text-xs font-medium uppercase tracking-wider mb-3', isDark ? 'text-gray-500' : 'text-gray-400')}>
              School Logo
            </Text>
            <View
              className={cn('rounded-2xl p-5', isDark ? 'bg-gray-900' : 'bg-white')}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: isDark ? 0.5 : 0.2,
                shadowRadius: 6,
                elevation: isDark ? 6 : 5,
              }}
            >
              <View className="flex-row items-center">
                {logo ? (
                  <Image
                    source={{ uri: logo }}
                    className="w-20 h-20 rounded-2xl"
                  />
                ) : (
                  <View
                    className={cn(
                      'w-20 h-20 rounded-2xl items-center justify-center',
                      isDark ? 'bg-gray-800' : 'bg-gray-100'
                    )}
                  >
                    <ImageIcon size={32} color={isDark ? '#4B5563' : '#9CA3AF'} />
                  </View>
                )}
                <View className="flex-1 ml-4">
                  <Text className={cn('font-semibold mb-0.5', isDark ? 'text-white' : 'text-gray-900')}>
                    {logo ? 'Logo uploaded' : 'Add your logo'}
                  </Text>
                  <Text className={cn('text-sm mb-4', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    Square image, 512x512px recommended
                  </Text>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={handlePickLogo}
                      className="px-4 py-2.5 rounded-xl active:opacity-80"
                      style={{ backgroundColor: selectedTheme.primary }}
                    >
                      <Text className="text-white font-medium text-sm">
                        {logo ? 'Change' : 'Upload'}
                      </Text>
                    </Pressable>
                    {logo && (
                      <Pressable
                        onPress={handleRemoveLogo}
                        className={cn(
                          'px-4 py-2.5 rounded-xl',
                          isDark ? 'bg-gray-800' : 'bg-gray-100'
                        )}
                      >
                        <Text className={cn('font-medium text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>
                          Remove
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Theme Palettes */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)} className="mb-6">
            <Text className={cn('text-xs font-medium uppercase tracking-wider mb-3', isDark ? 'text-gray-500' : 'text-gray-400')}>
              Choose Your Theme
            </Text>
            <Text className={cn('text-sm mb-4', isDark ? 'text-gray-400' : 'text-gray-500')}>
              Culturally-inspired color palettes designed for your school
            </Text>

            <View className="gap-3">
              {THEME_PALETTES.map((theme, index) => {
                const isSelected = theme.id === selectedTheme.id;
                return (
                  <Animated.View
                    key={theme.id}
                    entering={FadeInDown.delay(200 + index * 30).duration(400)}
                  >
                    <Pressable
                      onPress={() => handleSelectTheme(theme)}
                      className={cn(
                        'rounded-2xl p-4 flex-row items-center',
                        isDark ? 'bg-gray-900' : 'bg-white',
                        isSelected && 'border-2'
                      )}
                      style={[
                        {
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: isDark ? 0.5 : 0.2,
                          shadowRadius: 6,
                          elevation: isDark ? 6 : 5,
                        },
                        isSelected && { borderColor: theme.primary },
                      ]}
                    >
                      {/* Color Preview */}
                      <View className="mr-4">
                        <LinearGradient
                          colors={[theme.gradientStart, theme.gradientEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          className="w-14 h-14 rounded-xl items-center justify-center"
                        >
                          {getThemeIcon(theme.id)}
                        </LinearGradient>
                      </View>

                      {/* Theme Info */}
                      <View className="flex-1">
                        <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                          {theme.name}
                        </Text>
                        <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                          {theme.description}
                        </Text>

                        {/* Color Swatches */}
                        <View className="flex-row gap-1.5 mt-2">
                          <View
                            className="w-5 h-5 rounded-full"
                            style={{ backgroundColor: theme.primary }}
                          />
                          <View
                            className="w-5 h-5 rounded-full"
                            style={{ backgroundColor: theme.primarySoft }}
                          />
                          <View
                            className="w-5 h-5 rounded-full"
                            style={{ backgroundColor: theme.secondary }}
                          />
                          <View
                            className="w-5 h-5 rounded-full"
                            style={{ backgroundColor: theme.accent }}
                          />
                        </View>
                      </View>

                      {/* Selected Indicator */}
                      {isSelected && (
                        <View
                          className="w-8 h-8 rounded-full items-center justify-center"
                          style={{ backgroundColor: theme.primary }}
                        >
                          <Check size={18} color="white" />
                        </View>
                      )}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>

          {/* Info */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <View className={cn('rounded-2xl p-4', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
              <Text className={cn('text-sm text-center', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Your theme colors will be used throughout the app for buttons, headers, and accents. All members will see this branding.
              </Text>
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Save Button */}
      {hasChanges && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          className={cn('px-5 py-4 border-t', isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-100')}
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Pressable
            onPress={handleSave}
            className="py-4 rounded-2xl items-center flex-row justify-center active:opacity-80"
            style={{ backgroundColor: selectedTheme.primary }}
          >
            <Check size={20} color="white" />
            <Text className="ml-2 text-white font-semibold text-base">Save Theme</Text>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}
