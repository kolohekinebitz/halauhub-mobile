import { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useAppStore, useShallow } from '@/lib/store';

type _StoreState = ReturnType<typeof useAppStore.getState>;
const selectRecovery = (s: _StoreState) => ({
  retryAccountRecovery: s.retryAccountRecovery,
  recoveryAttempts: s.recoveryAttempts,
  signOut: s.signOut,
});

export default function RecoveringScreen() {
  const { retryAccountRecovery, recoveryAttempts, signOut } =
    useAppStore(useShallow(selectRecovery));
  const [hasFailed, setHasFailed] = useState(false);
  const hasTriedRef = useRef(false);

  // Auto-retry on mount (handles the case where the sign-in recovery itself timed out).
  // Navigation away is handled exclusively by _layout.tsx once isHydrating clears.
  useEffect(() => {
    if (hasTriedRef.current) return;
    hasTriedRef.current = true;

    void (async () => {
      const result = await retryAccountRecovery();
      if (!result.confirmed) {
        setHasFailed(true);
      }
    })();
  }, [retryAccountRecovery]);

  const handleRetry = async () => {
    setHasFailed(false);
    hasTriedRef.current = false;
    const result = await retryAccountRecovery();
    if (!result.confirmed) {
      setHasFailed(true);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <View className="flex-1 bg-gray-950 items-center justify-center px-8">
      {!hasFailed ? (
        <>
          <ActivityIndicator size="large" color="#0D9488" />
          <Text className="mt-6 text-white text-lg font-semibold text-center">
            Restoring your account...
          </Text>
          <Text className="mt-2 text-gray-400 text-sm text-center">
            This usually takes just a moment.
          </Text>
          {recoveryAttempts > 1 && (
            <Text className="mt-3 text-gray-500 text-xs text-center">
              Attempt {recoveryAttempts}...
            </Text>
          )}
        </>
      ) : (
        <>
          <View className="w-14 h-14 rounded-full bg-red-500/20 items-center justify-center mb-5">
            <Text className="text-red-400 text-2xl">!</Text>
          </View>
          <Text className="text-white text-lg font-semibold text-center">
            Unable to restore your account
          </Text>
          <Text className="mt-2 text-gray-400 text-sm text-center leading-5">
            We couldn't connect to our servers. Please check your internet connection and try again.
          </Text>
          <Pressable
            onPress={handleRetry}
            className="mt-8 bg-teal-600 rounded-xl px-8 py-3.5 active:opacity-80"
          >
            <Text className="text-white font-semibold text-base">Try Again</Text>
          </Pressable>
          <Pressable
            onPress={handleSignOut}
            className="mt-4 px-8 py-3 active:opacity-60"
          >
            <Text className="text-gray-500 text-sm">Sign out</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
