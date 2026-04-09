import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import {
  Calendar,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Smartphone,
  Banknote,
  FileText,
  ChevronRight,
  ExternalLink,
} from 'lucide-react-native';
import BackButton from '@/components/BackButton';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Animated Pressable component for tap feedback
const AnimatedPressable = ({ children, onPress, style, className: classNameProp, disabled }: {
  children: React.ReactNode;
  onPress: () => void;
  style?: object;
  className?: string;
  disabled?: boolean;
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[animatedStyle, style]} className={classNameProp}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

type PaymentMethod = 'venmo' | 'zelle' | 'cash' | 'check';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: typeof CreditCard; color: string; description: string }[] = [
  { id: 'venmo', label: 'Venmo', icon: Smartphone, color: '#008CFF', description: 'Pay via Venmo app' },
  { id: 'zelle', label: 'Zelle', icon: Banknote, color: '#6D1ED4', description: 'Pay via Zelle transfer' },
  { id: 'cash', label: 'Cash', icon: DollarSign, color: '#10B981', description: 'Pay in person' },
  { id: 'check', label: 'Check', icon: FileText, color: '#F59E0B', description: 'Pay by check' },
];

export default function DuesDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id } = useLocalSearchParams<{ id: string }>();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [isFullAmount, setIsFullAmount] = useState(true);
  const [invoiceNumber, setInvoiceNumber] = useState('');

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentMember = useAppStore((s) => s.currentMember);
  const getHalau = useAppStore((s) => s.getHalau);
  const memberDues = useAppStore((s) => s.memberDues);
  const members = useAppStore((s) => s.members);
  const submitPaymentForConfirmation = useAppStore((s) => s.submitPaymentForConfirmation);
  const pendingPaymentSubmissions = useAppStore((s) => s.pendingPaymentSubmissions);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  // Get the halau's theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  // Find the specific due
  const due = useMemo(() => {
    return memberDues.find((d) => d.id === id);
  }, [memberDues, id]);

  // Check if there's already a pending submission for this due
  const existingPendingSubmission = useMemo(() => {
    if (!id) return null;
    return pendingPaymentSubmissions.find((s) => s.memberDueId === id && s.status === 'pending');
  }, [pendingPaymentSubmissions, id]);

  // Get studio admin info for payment details
  const studioAdmin = useMemo(() => {
    if (!currentHalauId) return null;
    return members.find((m) => m.halauId === currentHalauId && m.role === 'teacher');
  }, [members, currentHalauId]);

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: 'bg-emerald-500/15', text: 'text-emerald-600', color: '#10B981' };
      case 'partial':
        return { bg: 'bg-amber-500/15', text: 'text-amber-600', color: '#F59E0B' };
      case 'overdue':
        return { bg: 'bg-red-500/15', text: 'text-red-500', color: '#EF4444' };
      default:
        return { bg: isDark ? 'bg-slate-800' : 'bg-slate-100', text: isDark ? 'text-slate-400' : 'text-slate-500', color: '#64748B' };
    }
  };

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMethod(method);
  };

  const handleOpenPaymentApp = async (method: PaymentMethod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const amount = due ? (due.amount - due.amountPaid).toFixed(2) : '0';
    const note = `${halau?.name || 'Studio'} - ${due?.name || 'Dues'}`;

    let url = '';

    switch (method) {
      case 'venmo':
        // Venmo deep link - user would need to enter recipient
        url = `venmo://paycharge?txn=pay&amount=${amount}&note=${encodeURIComponent(note)}`;
        break;
      case 'zelle':
        // Zelle doesn't have a universal deep link, open app store or website
        Alert.alert(
          'Pay with Zelle',
          `Open your banking app and send ${formatCurrency(parseFloat(amount))} via Zelle.\n\nNote: ${note}`,
          [{ text: 'OK' }]
        );
        return;
      case 'cash':
        Alert.alert(
          'Pay with Cash',
          `Please pay ${formatCurrency(parseFloat(amount))} in cash to your instructor at your next class.\n\nThey will mark your payment as received.`,
          [{ text: 'OK' }]
        );
        return;
      case 'check':
        Alert.alert(
          'Pay by Check',
          `Please make a check payable to "${halau?.name || 'the studio'}" for ${formatCurrency(parseFloat(amount))}.\n\nBring it to your next class or mail it to the studio address.`,
          [{ text: 'OK' }]
        );
        return;
    }

    if (url) {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert(
            'App Not Found',
            `${method.charAt(0).toUpperCase() + method.slice(1)} app is not installed on this device.`,
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        Alert.alert('Error', 'Unable to open payment app.');
      }
    }
  };

  const handleMarkAsPending = () => {
    if (!selectedMethod || !due || !id) return;

    const remainingAmount = due.amount - due.amountPaid;
    const submitAmount = isFullAmount
      ? remainingAmount
      : parseFloat(paymentAmountInput);

    if (!isFullAmount && (isNaN(submitAmount) || submitAmount <= 0)) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }
    if (!isFullAmount && submitAmount > remainingAmount) {
      Alert.alert('Amount Too High', `Payment cannot exceed the remaining balance of ${formatCurrency(remainingAmount)}.`);
      return;
    }

    const notes = undefined;
    const invoice = invoiceNumber.trim() || undefined;

    setIsSubmitting(true);
    try {
      submitPaymentForConfirmation(id, submitAmount, selectedMethod, notes, invoice);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Payment Submitted',
        'Your payment has been submitted for confirmation. Your instructor will review and confirm it shortly.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to submit payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!due) {
    return (
      <View className={cn('flex-1 items-center justify-center', isDark ? 'bg-black' : 'bg-slate-50')}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text className={cn('text-lg', isDark ? 'text-slate-400' : 'text-slate-500')}>
          Due not found
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-4 px-6 py-3 rounded-xl"
          style={{ backgroundColor: theme.primary }}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const statusStyle = getStatusColor(due.status);
  const remainingAmount = due.amount - due.amountPaid;
  const progressPercent = Math.min((due.amountPaid / due.amount) * 100, 100);

  const cardShadow = {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: isDark ? 0.5 : 0.2,
    shadowRadius: 6,
    elevation: isDark ? 6 : 5,
  };

  return (
    <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-slate-50')}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{ paddingTop: insets.top }}>
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingBottom: 32 }}
        >
          {/* Top Bar */}
          <View className="flex-row items-center justify-between px-5 py-4">
            <BackButton color="#FFFFFF" />

            <Text className="text-white text-lg font-semibold">Payment Details</Text>

            <View className="w-10" />
          </View>

          {/* Amount Display */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)} className="items-center px-5">
            <Text className="text-white/70 text-sm mb-1">Amount Due</Text>
            <Text className="text-white text-4xl font-bold">
              {formatCurrency(remainingAmount)}
            </Text>
            {due.amountPaid > 0 && (
              <Text className="text-white/60 text-sm mt-1">
                of {formatCurrency(due.amount)} total
              </Text>
            )}
          </Animated.View>
        </LinearGradient>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Due Info Card */}
        <View className="px-5 -mt-4">
          <Animated.View
            entering={FadeInUp.delay(150).duration(400)}
            className={cn('rounded-2xl p-5 border', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')}
            style={cardShadow}
          >
            {/* Title & Status */}
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-1 mr-3">
                <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-slate-900')}>
                  {due.name}
                </Text>
                {due.notes && (
                  <Text className={cn('text-sm mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    {due.notes}
                  </Text>
                )}
              </View>
              <View className={cn('px-3 py-1.5 rounded-lg', statusStyle.bg)}>
                <Text className={cn('text-xs font-semibold uppercase', statusStyle.text)}>
                  {due.status}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            {due.amountPaid > 0 && (
              <View className="mb-4">
                <View className="flex-row justify-between mb-2">
                  <Text className={cn('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                    Payment Progress
                  </Text>
                  <Text className={cn('text-xs font-medium', isDark ? 'text-slate-300' : 'text-slate-600')}>
                    {progressPercent.toFixed(0)}%
                  </Text>
                </View>
                <View className={cn('h-2 rounded-full overflow-hidden', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                  <View
                    className="h-2 rounded-full"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: due.status === 'paid' ? '#10B981' : theme.primary,
                    }}
                  />
                </View>
              </View>
            )}

            {/* Details Grid */}
            <View className={cn('pt-4 border-t', isDark ? 'border-slate-800' : 'border-slate-100')}>
              <View className="flex-row">
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Calendar size={14} color={isDark ? '#64748B' : '#94A3B8'} />
                    <Text className={cn('text-xs ml-1.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                      Due Date
                    </Text>
                  </View>
                  <Text className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                    {formatShortDate(due.dueDate)}
                  </Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Clock size={14} color={isDark ? '#64748B' : '#94A3B8'} />
                    <Text className={cn('text-xs ml-1.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                      Created
                    </Text>
                  </View>
                  <Text className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-slate-900')}>
                    {formatShortDate(due.createdAt)}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Pending Confirmation Message */}
        {existingPendingSubmission && (
          <View className="px-5 mt-6">
            <Animated.View
              entering={FadeIn.delay(200).duration(400)}
              className={cn('p-5 rounded-2xl flex-row items-center', 'bg-amber-500/10 border border-amber-500/20')}
            >
              <View className="w-12 h-12 rounded-full bg-amber-500/20 items-center justify-center mr-4">
                <Clock size={24} color="#F59E0B" />
              </View>
              <View className="flex-1">
                <Text className={cn('font-semibold', isDark ? 'text-amber-300' : 'text-amber-700')}>
                  Awaiting Confirmation
                </Text>
                <Text className={cn('text-sm mt-0.5', isDark ? 'text-amber-400/70' : 'text-amber-600')}>
                  Your {existingPendingSubmission.method} payment of {formatCurrency(existingPendingSubmission.amount)} is pending instructor review
                </Text>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Payment Amount + Methods Section */}
        {due.status !== 'paid' && !existingPendingSubmission && (
          <View className="px-5 mt-6">
            <Animated.View entering={FadeIn.delay(200).duration(400)}>

              {/* Payment Amount */}
              <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
                Payment Amount
              </Text>
              <View className={cn('rounded-2xl border mb-5 overflow-hidden', isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')} style={cardShadow}>
                {/* Full Amount toggle */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsFullAmount(true);
                    setPaymentAmountInput('');
                  }}
                  className={cn(
                    'flex-row items-center justify-between px-4 py-4 border-b',
                    isDark ? 'border-slate-800' : 'border-slate-100',
                    isFullAmount && (isDark ? 'bg-slate-800' : 'bg-slate-50')
                  )}
                >
                  <View className="flex-1">
                    <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                      Full Amount
                    </Text>
                    <Text className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
                      {formatCurrency(remainingAmount)}
                    </Text>
                  </View>
                  <View className={cn(
                    'w-6 h-6 rounded-full border-2 items-center justify-center',
                    isFullAmount
                      ? 'border-transparent'
                      : isDark ? 'border-slate-600' : 'border-slate-300'
                  )} style={isFullAmount ? { backgroundColor: theme.primary } : {}}>
                    {isFullAmount && <View className="w-2.5 h-2.5 rounded-full bg-white" />}
                  </View>
                </Pressable>

                {/* Partial / custom amount */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsFullAmount(false);
                  }}
                  className={cn(
                    'flex-row items-center px-4 py-4',
                    !isFullAmount && (isDark ? 'bg-slate-800' : 'bg-slate-50')
                  )}
                >
                  <View className="flex-1">
                    <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-slate-900')}>
                      Partial / Other Amount
                    </Text>
                    {!isFullAmount && (
                      <View className={cn('flex-row items-center mt-2 rounded-xl px-3 py-2.5 border', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200')}>
                        <Text className={cn('text-base font-bold mr-1', isDark ? 'text-slate-300' : 'text-slate-500')}>$</Text>
                        <TextInput
                          value={paymentAmountInput}
                          onChangeText={setPaymentAmountInput}
                          placeholder="0.00"
                          placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                          keyboardType="decimal-pad"
                          className={cn('flex-1 text-base font-semibold', isDark ? 'text-white' : 'text-slate-900')}
                          autoFocus={!isFullAmount}
                        />
                      </View>
                    )}
                  </View>
                  <View className={cn(
                    'w-6 h-6 rounded-full border-2 items-center justify-center',
                    !isFullAmount
                      ? 'border-transparent'
                      : isDark ? 'border-slate-600' : 'border-slate-300'
                  )} style={!isFullAmount ? { backgroundColor: theme.primary } : {}}>
                    {!isFullAmount && <View className="w-2.5 h-2.5 rounded-full bg-white" />}
                  </View>
                </Pressable>
              </View>

              {/* Select Payment Method */}
              <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-3', isDark ? 'text-slate-500' : 'text-slate-400')}>
                Select Payment Method
              </Text>

              <View className="gap-3">
                {PAYMENT_METHODS.map((method) => (
                  <AnimatedPressable
                    key={method.id}
                    onPress={() => handlePaymentMethodSelect(method.id)}
                    className={cn(
                      'p-4 rounded-2xl border flex-row items-center',
                      selectedMethod === method.id
                        ? 'border-2'
                        : isDark
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-100'
                    )}
                    style={[
                      cardShadow,
                      selectedMethod === method.id && { borderColor: method.color, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' },
                    ]}
                  >
                    <View
                      className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                      style={{ backgroundColor: `${method.color}15` }}
                    >
                      <method.icon size={24} color={method.color} />
                    </View>
                    <View className="flex-1">
                      <Text className={cn('font-semibold text-base', isDark ? 'text-white' : 'text-slate-900')}>
                        {method.label}
                      </Text>
                      <Text className={cn('text-xs mt-0.5', isDark ? 'text-slate-500' : 'text-slate-500')}>
                        {method.description}
                      </Text>
                    </View>
                    {selectedMethod === method.id ? (
                      <View
                        className="w-6 h-6 rounded-full items-center justify-center"
                        style={{ backgroundColor: method.color }}
                      >
                        <CheckCircle2 size={16} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View className={cn('w-6 h-6 rounded-full border-2', isDark ? 'border-slate-700' : 'border-slate-200')} />
                    )}
                  </AnimatedPressable>
                ))}
              </View>

              {/* Invoice / Reference Number for Venmo, Zelle, Check */}
              {(selectedMethod === 'venmo' || selectedMethod === 'zelle' || selectedMethod === 'check') && (
                <Animated.View entering={FadeIn.duration(250)} className="mt-4">
                  <Text className={cn('text-xs font-semibold uppercase tracking-wider mb-2', isDark ? 'text-slate-500' : 'text-slate-400')}>
                    Invoice / Reference Number
                  </Text>
                  <View className={cn('flex-row items-center px-4 py-3 rounded-2xl border', isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')} style={cardShadow}>
                    <FileText size={18} color={isDark ? '#64748B' : '#94A3B8'} />
                    <TextInput
                      value={invoiceNumber}
                      onChangeText={setInvoiceNumber}
                      placeholder={selectedMethod === 'check' ? 'Check number (optional)' : 'Transaction ID (optional)'}
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      className={cn('flex-1 ml-3 text-base', isDark ? 'text-white' : 'text-slate-900')}
                      autoCapitalize="none"
                    />
                  </View>
                </Animated.View>
              )}

            </Animated.View>
          </View>
        )}

        {/* Already Paid Message */}
        {due.status === 'paid' && (
          <View className="px-5 mt-6">
            <Animated.View
              entering={FadeIn.delay(200).duration(400)}
              className={cn('p-5 rounded-2xl flex-row items-center', 'bg-emerald-500/10 border border-emerald-500/20')}
            >
              <View className="w-12 h-12 rounded-full bg-emerald-500/20 items-center justify-center mr-4">
                <CheckCircle2 size={24} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className={cn('font-semibold', isDark ? 'text-emerald-300' : 'text-emerald-700')}>
                  Payment Complete
                </Text>
                <Text className={cn('text-sm mt-0.5', isDark ? 'text-emerald-400/70' : 'text-emerald-600')}>
                  This due has been fully paid
                </Text>
              </View>
            </Animated.View>
          </View>
        )}

        {/* Payment Instructions */}
        {due.status !== 'paid' && selectedMethod && (
          <View className="px-5 mt-6">
            <Animated.View
              entering={FadeIn.duration(300)}
              className={cn('p-4 rounded-2xl', isDark ? 'bg-slate-900/50' : 'bg-slate-100')}
            >
              <View className="flex-row items-start">
                <AlertCircle size={18} color={isDark ? '#64748B' : '#94A3B8'} className="mt-0.5" />
                <View className="flex-1 ml-3">
                  <Text className={cn('text-sm font-medium mb-1', isDark ? 'text-slate-300' : 'text-slate-700')}>
                    How it works
                  </Text>
                  <Text className={cn('text-xs leading-relaxed', isDark ? 'text-slate-500' : 'text-slate-500')}>
                    {selectedMethod === 'venmo' && 'Tap the button below to open Venmo. Send payment to your instructor, then return here.'}
                    {selectedMethod === 'zelle' && 'Open your banking app and send payment via Zelle to your instructor.'}
                    {selectedMethod === 'cash' && 'Bring cash to your next class. Your instructor will mark the payment as received.'}
                    {selectedMethod === 'check' && 'Write a check to the studio and bring it to your next class or mail it.'}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Button */}
      {due.status !== 'paid' && !existingPendingSubmission && (
        <View
          className={cn('absolute bottom-0 left-0 right-0 px-5 pt-4 pb-2', isDark ? 'bg-black' : 'bg-slate-50')}
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            <AnimatedPressable
              onPress={() => {
                if (selectedMethod) {
                  handleOpenPaymentApp(selectedMethod);
                } else {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  Alert.alert('Select Payment Method', 'Please select how you would like to pay.');
                }
              }}
              disabled={!selectedMethod || isSubmitting}
              className={cn(
                'py-4 rounded-2xl flex-row items-center justify-center',
                (!selectedMethod || isSubmitting) && 'opacity-50'
              )}
              style={{ backgroundColor: selectedMethod ? PAYMENT_METHODS.find(m => m.id === selectedMethod)?.color || theme.primary : theme.primary }}
            >
              {selectedMethod === 'venmo' || selectedMethod === 'zelle' ? (
                <>
                  <ExternalLink size={20} color="#FFFFFF" />
                  <Text className="text-white font-bold text-base ml-2">
                    Open {selectedMethod === 'venmo' ? 'Venmo' : 'Banking App'}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="text-white font-bold text-base">
                    {selectedMethod ? 'View Instructions' : 'Select Payment Method'}
                  </Text>
                  <ChevronRight size={20} color="#FFFFFF" />
                </>
              )}
            </AnimatedPressable>

            {selectedMethod && (
              <Pressable
                onPress={handleMarkAsPending}
                disabled={isSubmitting}
                className={cn('mt-3 py-3', isSubmitting && 'opacity-50')}
              >
                <Text className={cn('text-center font-medium', isDark ? 'text-slate-300' : 'text-slate-600')}>
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      )}
    </View>
  );
}
