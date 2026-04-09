import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { Check, Users, GraduationCap, Shield } from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import * as Haptics from 'expo-haptics';

export default function TitlesSettingsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const getTitleSettings = useAppStore((s) => s.getTitleSettings);
  const updateTitleSettings = useAppStore((s) => s.updateTitleSettings);

  const titleSettings = currentHalauId ? getTitleSettings(currentHalauId) : null;

  const [teacherTitle, setTeacherTitle] = useState(titleSettings?.teacherTitle || 'Teacher');
  const [studentTitle, setStudentTitle] = useState(titleSettings?.studentTitle || 'Student');
  const [adminTitle, setAdminTitle] = useState(titleSettings?.adminTitle || 'Admin');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (titleSettings) {
      const changed =
        teacherTitle !== titleSettings.teacherTitle ||
        studentTitle !== titleSettings.studentTitle ||
        adminTitle !== titleSettings.adminTitle;
      setHasChanges(changed);
    }
  }, [teacherTitle, studentTitle, adminTitle, titleSettings]);

  const handleSave = () => {
    if (!currentHalauId) return;
    updateTitleSettings(currentHalauId, {
      teacherTitle: teacherTitle.trim() || 'Teacher',
      studentTitle: studentTitle.trim() || 'Student',
      adminTitle: adminTitle.trim() || 'Admin',
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHasChanges(false);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Customize Titles',
          headerStyle: { backgroundColor: isDark ? '#000000' : '#FFFFFF' },
          headerTintColor: isDark ? '#FFFFFF' : '#111827',
          headerShadowVisible: false,
          headerLeft: () => <BackButton />,
          headerRight: () =>
            hasChanges ? (
              <Pressable onPress={handleSave} className="mr-2">
                <Check size={24} color="#0D9488" />
              </Pressable>
            ) : null,
        }}
      />
      <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-gray-50')}>
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
          bottomOffset={16}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Info */}
          <View className={cn('px-5 py-6', isDark ? 'bg-gray-900/50' : 'bg-white')}>
            <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
              Customize how roles are displayed throughout your app. These titles will appear in member lists, profiles, and other areas.
            </Text>
          </View>

          <View className="px-5 py-4">
            {/* Teacher Title */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <View className="w-9 h-9 rounded-xl bg-amber-500/10 items-center justify-center mr-3">
                  <Users size={18} color="#F59E0B" />
                </View>
                <View>
                  <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                    Instructor Title
                  </Text>
                  <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                    Default: Teacher
                  </Text>
                </View>
              </View>
              <TextInput
                className={cn(
                  'px-4 py-3 rounded-xl text-base',
                  isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                )}
                placeholder="e.g., Kumu, Instructor, Coach"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={teacherTitle}
                onChangeText={setTeacherTitle}
                autoCapitalize="words"
              />
            </View>

            {/* Student Title */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <View className="w-9 h-9 rounded-xl bg-teal-500/10 items-center justify-center mr-3">
                  <GraduationCap size={18} color="#0D9488" />
                </View>
                <View>
                  <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                    Student Title
                  </Text>
                  <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                    Default: Student
                  </Text>
                </View>
              </View>
              <TextInput
                className={cn(
                  'px-4 py-3 rounded-xl text-base',
                  isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                )}
                placeholder="e.g., Haumana, Member, Dancer"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={studentTitle}
                onChangeText={setStudentTitle}
                autoCapitalize="words"
              />
            </View>

            {/* Admin Title */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <View className="w-9 h-9 rounded-xl bg-purple-500/10 items-center justify-center mr-3">
                  <Shield size={18} color="#A855F7" />
                </View>
                <View>
                  <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                    Admin Title
                  </Text>
                  <Text className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                    Default: Admin
                  </Text>
                </View>
              </View>
              <TextInput
                className={cn(
                  'px-4 py-3 rounded-xl text-base',
                  isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
                )}
                placeholder="e.g., Manager, Coordinator"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={adminTitle}
                onChangeText={setAdminTitle}
                autoCapitalize="words"
              />
            </View>

            {/* Preview */}
            <View className={cn('rounded-2xl p-4', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
              <Text className={cn('text-xs font-medium mb-3', isDark ? 'text-gray-500' : 'text-gray-400')}>
                PREVIEW
              </Text>
              <View className="gap-2">
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-amber-500 items-center justify-center mr-2">
                    <Text className="text-white text-sm font-bold">K</Text>
                  </View>
                  <Text className={cn('flex-1', isDark ? 'text-white' : 'text-gray-900')}>Kumu Lani</Text>
                  <View className="px-2 py-0.5 rounded-full bg-amber-500/10">
                    <Text className="text-xs font-medium text-amber-600">{teacherTitle || 'Teacher'}</Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-teal-500 items-center justify-center mr-2">
                    <Text className="text-white text-sm font-bold">M</Text>
                  </View>
                  <Text className={cn('flex-1', isDark ? 'text-white' : 'text-gray-900')}>Malia Smith</Text>
                  <View className="px-2 py-0.5 rounded-full bg-teal-500/10">
                    <Text className="text-xs font-medium text-teal-600">{studentTitle || 'Student'}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Save Button */}
          {hasChanges && (
            <View className="px-5 mt-4">
              <Pressable
                onPress={handleSave}
                className="bg-teal-500 py-4 rounded-xl items-center"
              >
                <Text className="text-white font-bold text-base">Save Changes</Text>
              </Pressable>
            </View>
          )}
          </KeyboardAwareScrollView>
      </View>
    </>
  );
}
