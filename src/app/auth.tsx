import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react-native';
import Animated, { FadeIn, FadeInUp, FadeInDown } from 'react-native-reanimated';
import { useAppStore } from '@/lib/store';
import { DEFAULT_THEME, UI_CONSTANTS } from '@/lib/themes';
import { s, ms } from '@/lib/scaling';
import { cn } from '@/lib/cn';
import { Image } from 'expo-image';

type AuthMode = 'login' | 'signup' | 'forgot';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const signUp = useAppStore((s) => s.signUp);
  const signIn = useAppStore((s) => s.signIn);
  const resetPassword = useAppStore((s) => s.resetPassword);

  // Track mount state so setTimeout navigation never fires on an unmounted component
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)})${digits.slice(3)}`;
    return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!email || !password) {
          setError('Please fill in all fields');
          setLoading(false);
          return;
        }
        const result = await signIn(email, password);
        if (result.success) {
          // Check if email is verified and if user has selected a halau
          const { isEmailVerified: verified, currentHalauId } = useAppStore.getState();
          // setTimeout lets the store finish its final set() before navigation
          setTimeout(() => {
            if (!isMountedRef.current) return;
            if (!verified) {
              router.replace('/verify-email');
            } else if (!currentHalauId) {
              router.replace('/onboarding');
            } else {
              router.replace('/(tabs)');
            }
          }, 50);
        } else {
          setError(result.error || 'Login failed');
        }
      } else if (mode === 'signup') {
        if (!email || !password || !confirmPassword || !firstName || !lastName) {
          setError('Please fill in all required fields');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        const result = await signUp(email, password, firstName, lastName, phone);
        if (result.success) {
          // After signup, redirect to verify email screen
          setTimeout(() => {
            if (!isMountedRef.current) return;
            router.replace('/verify-email');
          }, 50);
        } else {
          setError(result.error || 'Signup failed');
        }
      } else if (mode === 'forgot') {
        if (!email) {
          setError('Please enter your email');
          setLoading(false);
          return;
        }
        const result = await resetPassword(email);
        if (result.success) {
          setSuccess('If an account exists with this email, you will receive a password reset link.');
        } else {
          setError(result.error || 'Failed to send reset email');
        }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    icon: React.ReactNode,
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    options?: {
      secureTextEntry?: boolean;
      keyboardType?: TextInput['props']['keyboardType'];
      autoCapitalize?: TextInput['props']['autoCapitalize'];
    }
  ) => (
    <View
      className="flex-row items-center bg-white/15 rounded-2xl px-4 py-3.5 mb-3 border border-white/20"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <View className="mr-3">{icon}</View>
      <TextInput
        className="flex-1 text-white text-base font-medium"
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.6)"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={options?.secureTextEntry && !showPassword}
        keyboardType={options?.keyboardType}
        autoCapitalize={options?.autoCapitalize ?? 'none'}
        cursorColor="#FFFFFF"
        selectionColor="rgba(255, 255, 255, 0.4)"
      />
      {options?.secureTextEntry && (
        <Pressable onPress={() => setShowPassword(!showPassword)} className="p-1">
          {showPassword ? (
            <EyeOff size={20} color="rgba(255,255,255,0.7)" />
          ) : (
            <Eye size={20} color="rgba(255,255,255,0.7)" />
          )}
        </Pressable>
      )}
    </View>
  );

  return (
    <View className="flex-1">
      {/* Dark to Ocean Mist gradient - starts dark above black, fades to Ocean Mist */}
      <LinearGradient
        colors={['#5A9EAD', '#3A6A75', '#1A2A2F', '#0D1517']}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={16}
        showsVerticalScrollIndicator={false}
      >
          {/* Logo & Title with enhanced shadows */}
          <Animated.View entering={FadeInDown.delay(100).duration(600)} className="items-center mb-8">
            <View
              className="w-28 h-28 bg-white rounded-full items-center justify-center mb-5 overflow-hidden"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.35,
                shadowRadius: 16,
                elevation: 12,
              }}
            >
              <Image
                source={require('../../public/icon-only-black.png')}
                style={{ width: ms(72), height: ms(72) }}
                contentFit="contain"
              />
            </View>
            <Text className="text-white text-4xl font-bold tracking-tight" style={{ textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }}>HalauHub</Text>
            <Text className="text-white/90 text-lg mt-2 font-medium" style={{ textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>Knowledge from the source</Text>
          </Animated.View>

          {/* Mode Tabs with enhanced styling */}
          <Animated.View
            entering={FadeIn.delay(200).duration(400)}
            className="flex-row bg-white/20 rounded-full p-1.5 mb-6"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Pressable
              onPress={() => { setMode('login'); setError(''); setSuccess(''); }}
              className={cn(
                'flex-1 py-3 rounded-full',
                mode === 'login' && 'bg-white'
              )}
              style={mode === 'login' ? {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 3,
              } : undefined}
            >
              <Text
                className="text-center font-bold text-base"
                style={{ color: mode === 'login' ? '#3A7A87' : 'white' }}
              >
                Sign In
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setMode('signup'); setError(''); setSuccess(''); }}
              className={cn(
                'flex-1 py-3 rounded-full',
                mode === 'signup' && 'bg-white'
              )}
              style={mode === 'signup' ? {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
                elevation: 3,
              } : undefined}
            >
              <Text
                className="text-center font-bold text-base"
                style={{ color: mode === 'signup' ? '#3A7A87' : 'white' }}
              >
                Sign Up
              </Text>
            </Pressable>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            {mode === 'signup' && (
              <>
                <View className="flex-row gap-3 mb-0">
                  <View className="flex-1">
                    {renderInput(
                      <User size={20} color="white" />,
                      'First Name',
                      firstName,
                      setFirstName,
                      { autoCapitalize: 'words' }
                    )}
                  </View>
                  <View className="flex-1">
                    {renderInput(
                      <User size={20} color="white" />,
                      'Last Name',
                      lastName,
                      setLastName,
                      { autoCapitalize: 'words' }
                    )}
                  </View>
                </View>
                {renderInput(
                  <Phone size={20} color="white" />,
                  '(123)456-7890',
                  phone,
                  (text) => setPhone(formatPhone(text)),
                  { keyboardType: 'phone-pad' }
                )}
              </>
            )}

            {renderInput(
              <Mail size={20} color="white" />,
              'Email',
              email,
              setEmail,
              { keyboardType: 'email-address' }
            )}

            {mode !== 'forgot' && (
              <>
                {renderInput(
                  <Lock size={20} color="white" />,
                  'Password',
                  password,
                  setPassword,
                  { secureTextEntry: true }
                )}

                {mode === 'signup' && renderInput(
                  <Lock size={20} color="white" />,
                  'Confirm Password',
                  confirmPassword,
                  setConfirmPassword,
                  { secureTextEntry: true }
                )}
              </>
            )}

            {/* Error/Success Messages */}
            {error ? (
              <View className="bg-red-500/20 rounded-xl p-3 mb-3">
                <Text className="text-red-200 text-center">{error}</Text>
              </View>
            ) : null}
            {success ? (
              <View className="bg-green-500/20 rounded-xl p-3 mb-3">
                <Text className="text-green-200 text-center">{success}</Text>
              </View>
            ) : null}

            {/* Submit Button with enhanced shadow */}
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              className={cn(
                'bg-white rounded-2xl py-4 mt-2 active:opacity-80',
                loading && 'opacity-70'
              )}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 10,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#3A7A87" />
              ) : (
                <Text style={{ color: '#3A7A87' }} className="text-center font-bold text-lg">
                  {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
                </Text>
              )}
            </Pressable>

            {/* Forgot Password Link */}
            {mode === 'login' && (
              <Pressable
                onPress={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                className="mt-4"
              >
                <Text className="text-white/90 text-center font-medium">Forgot/Reset your password?</Text>
              </Pressable>
            )}

            {mode === 'forgot' && (
              <Pressable
                onPress={() => { setMode('login'); setError(''); setSuccess(''); }}
                className="mt-4"
              >
                <Text className="text-white/90 text-center font-medium">Back to Sign In</Text>
              </Pressable>
            )}
          </Animated.View>

          {/* Bottom Text */}
          <View className="flex-1" />
          <Text className="text-white/70 text-center text-sm mt-8 font-medium">
            By continuing, you agree to our Terms of Use (EULA) and Privacy Policy
          </Text>
      </KeyboardAwareScrollView>
    </View>
  );
}
