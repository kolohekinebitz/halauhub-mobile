import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Platform } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  Search,
  Plus,
  DollarSign,
  CreditCard,
  ChevronRight,
  X,
  Check,
  TrendingUp,
  Clock,
  AlertCircle,
  Filter,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';
import type { Payment, PaymentMethod, PaymentStatus, Member } from '@/lib/types';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | PaymentStatus>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [status, setStatus] = useState<PaymentStatus>('paid');
  const [category, setCategory] = useState('Tuition');
  const [notes, setNotes] = useState('');

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const paymentsData = useAppStore((s) => s.payments); // Subscribe to payments for reactivity
  const getPaymentsByHalau = useAppStore((s) => s.getPaymentsByHalau);
  const getPaymentStats = useAppStore((s) => s.getPaymentStats);
  const getMembersByHalau = useAppStore((s) => s.getMembersByHalau);
  const getMember = useAppStore((s) => s.getMember);
  const recordPayment = useAppStore((s) => s.recordPayment);

  const payments = useMemo(() => {
    return currentHalauId ? getPaymentsByHalau(currentHalauId) : [];
  }, [currentHalauId, getPaymentsByHalau, paymentsData]); // paymentsData triggers re-render when payments change

  const stats = useMemo(() => {
    return currentHalauId ? getPaymentStats(currentHalauId) : { totalPaid: 0, totalPending: 0, totalOverdue: 0 };
  }, [currentHalauId, getPaymentStats, paymentsData]); // paymentsData triggers re-render when payments change

  const members = currentHalauId ? getMembersByHalau(currentHalauId) : [];

  const filteredPayments = payments.filter((p) => {
    const member = getMember(p.memberId);
    const matchesSearch = member
      ? `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
      : false;
    const matchesFilter = selectedFilter === 'all' || p.status === selectedFilter;
    return (searchQuery ? matchesSearch : true) && matchesFilter;
  });

  const handleRecordPayment = () => {
    if (!selectedMemberId || !amount || !currentHalauId) return;

    recordPayment({
      halauId: currentHalauId,
      memberId: selectedMemberId,
      amount: parseFloat(amount),
      method,
      status,
      category,
      notes: notes.trim() || undefined,
      paidAt: status === 'paid' ? new Date().toISOString() : undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset form
    setSelectedMemberId('');
    setAmount('');
    setMethod('cash');
    setStatus('paid');
    setCategory('Tuition');
    setNotes('');
    setShowAddModal(false);
  };

  const getStatusColor = (paymentStatus: PaymentStatus) => {
    switch (paymentStatus) {
      case 'paid':
        return { bg: 'bg-green-500/10', text: 'text-green-600' };
      case 'partial':
        return { bg: 'bg-amber-500/10', text: 'text-amber-600' };
      case 'pending':
        return { bg: 'bg-blue-500/10', text: 'text-blue-600' };
      case 'overdue':
        return { bg: 'bg-red-500/10', text: 'text-red-600' };
    }
  };

  const getMethodIcon = (paymentMethod: PaymentMethod) => {
    switch (paymentMethod) {
      case 'venmo':
        return '💳';
      case 'zelle':
        return '💰';
      case 'cash':
        return '💵';
      case 'check':
        return '📝';
    }
  };

  const StatCard = ({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) => (
    <View
      className={cn('flex-1 rounded-2xl p-4', isDark ? 'bg-gray-800/80' : 'bg-white')}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.6 : 0.25,
        shadowRadius: 8,
        elevation: isDark ? 8 : 6,
      }}
    >
      <View className="w-10 h-10 rounded-xl items-center justify-center mb-2" style={{ backgroundColor: `${color}20` }}>
        {icon}
      </View>
      <Text className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
        ${value.toLocaleString()}
      </Text>
      <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>{title}</Text>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Payments',
          headerStyle: { backgroundColor: isDark ? '#111827' : '#FFFFFF' },
          headerTintColor: isDark ? '#FFFFFF' : '#111827',
          headerShadowVisible: false,
        }}
      />
      <View className={cn('flex-1', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Stats */}
          <View className="px-4 pt-2 pb-4 flex-row gap-3">
            <StatCard
              title="Collected"
              value={stats.totalPaid}
              icon={<TrendingUp size={20} color="#10B981" />}
              color="#10B981"
            />
            <StatCard
              title="Pending"
              value={stats.totalPending}
              icon={<Clock size={20} color="#F59E0B" />}
              color="#F59E0B"
            />
            <StatCard
              title="Overdue"
              value={stats.totalOverdue}
              icon={<AlertCircle size={20} color="#EF4444" />}
              color="#EF4444"
            />
          </View>

          {/* Search */}
          <View className="px-4 pb-4">
            <View
              className={cn(
                'flex-row items-center px-4 py-3 rounded-xl',
                isDark ? 'bg-gray-800' : 'bg-white'
              )}
            >
              <Search size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
              <TextInput
                className={cn('flex-1 ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}
                placeholder="Search by member name..."
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                cursorColor={isDark ? '#FFFFFF' : '#000000'}
                selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
              />
            </View>
          </View>

          {/* Filter Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 mb-4">
            <View className="flex-row gap-2">
              {(['all', 'paid', 'pending', 'partial', 'overdue'] as const).map((filter) => (
                <Pressable
                  key={filter}
                  onPress={() => setSelectedFilter(filter)}
                  className={cn(
                    'px-4 py-2 rounded-full',
                    selectedFilter === filter
                      ? 'bg-teal-500'
                      : isDark
                        ? 'bg-gray-800'
                        : 'bg-white'
                  )}
                >
                  <Text
                    className={cn(
                      'font-medium capitalize',
                      selectedFilter === filter
                        ? 'text-white'
                        : isDark
                          ? 'text-gray-300'
                          : 'text-gray-600'
                    )}
                  >
                    {filter}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Payment List */}
          <View className="px-4">
            {filteredPayments.length > 0 ? (
              filteredPayments.map((payment, index) => {
                const member = getMember(payment.memberId);
                const statusColor = getStatusColor(payment.status);

                return (
                  <Animated.View
                    key={payment.id}
                    entering={FadeInDown.delay(index * 50).duration(400)}
                  >
                    <Pressable
                      className={cn(
                        'flex-row items-center p-4 rounded-2xl mb-2 active:opacity-80',
                        isDark ? 'bg-gray-800/80' : 'bg-white'
                      )}
                      style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isDark ? 0.6 : 0.25,
                        shadowRadius: 8,
                        elevation: isDark ? 8 : 6,
                      }}
                    >
                      <View className="w-12 h-12 rounded-full bg-teal-500/10 items-center justify-center mr-3">
                        <Text className="text-xl">{getMethodIcon(payment.method)}</Text>
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center justify-between">
                          <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                            {member ? `${member.firstName} ${member.lastName}` : 'Unknown'}
                          </Text>
                          <Text className={cn('font-bold text-lg', isDark ? 'text-white' : 'text-gray-900')}>
                            ${payment.amount.toLocaleString()}
                          </Text>
                        </View>
                        <View className="flex-row items-center mt-1">
                          <View className={cn('px-2 py-0.5 rounded-full mr-2', statusColor.bg)}>
                            <Text className={cn('text-xs font-medium capitalize', statusColor.text)}>
                              {payment.status}
                            </Text>
                          </View>
                          <Text className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            {payment.category} • {format(parseISO(payment.recordedAt), 'MMM d')}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })
            ) : (
              <View className={cn('rounded-2xl p-8 items-center', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
                <CreditCard size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
                <Text className={cn('mt-4 text-center font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {searchQuery ? 'No payments match your search' : 'No payments recorded yet'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Add Payment FAB */}
        <Pressable
          onPress={() => setShowAddModal(true)}
          className="absolute bottom-24 right-4 w-14 h-14 bg-teal-500 rounded-full items-center justify-center shadow-lg active:opacity-80"
          style={{
            shadowColor: '#0D9488',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 10,
            elevation: 10,
          }}
        >
          <Plus size={28} color="white" />
        </Pressable>

        {/* Add Payment Modal */}
        <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
          <View className={cn('flex-1', isDark ? 'bg-gray-900' : 'bg-white')}>
            <View
              className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
              style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
            >
              <Pressable onPress={() => setShowAddModal(false)}>
                <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </Pressable>
              <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                Record Payment
              </Text>
              <Pressable
                onPress={handleRecordPayment}
                disabled={!selectedMemberId || !amount}
                className={cn((!selectedMemberId || !amount) && 'opacity-50')}
              >
                <Check size={24} color="#0D9488" />
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 py-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <View className="gap-4">
                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Member *
                  </Text>
                  <View className={cn('rounded-xl overflow-hidden', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                    <Picker
                      selectedValue={selectedMemberId}
                      onValueChange={setSelectedMemberId}
                      style={{ color: isDark ? 'white' : 'black' }}
                    >
                      <Picker.Item label="Select a member" value="" />
                      {members.map((m) => (
                        <Picker.Item key={m.id} label={`${m.firstName} ${m.lastName}`} value={m.id} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Amount *
                  </Text>
                  <View className={cn('flex-row items-center px-4 rounded-xl', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                    <DollarSign size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
                    <TextInput
                      className={cn('flex-1 py-3 ml-2 text-base', isDark ? 'text-white' : 'text-gray-900')}
                      placeholder="0.00"
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="decimal-pad"
                      cursorColor={isDark ? '#FFFFFF' : '#000000'}
                      selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                    />
                  </View>
                </View>

                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Payment Method
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(['cash', 'check', 'venmo', 'zelle'] as PaymentMethod[]).map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => setMethod(m)}
                        className={cn(
                          'px-4 py-2 rounded-full',
                          method === m ? 'bg-teal-500' : isDark ? 'bg-gray-800' : 'bg-gray-100'
                        )}
                      >
                        <Text
                          className={cn(
                            'font-medium capitalize',
                            method === m ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                          )}
                        >
                          {getMethodIcon(m)} {m}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Status
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {(['paid', 'partial', 'pending', 'overdue'] as PaymentStatus[]).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => setStatus(s)}
                        className={cn(
                          'px-4 py-2 rounded-full',
                          status === s ? 'bg-teal-500' : isDark ? 'bg-gray-800' : 'bg-gray-100'
                        )}
                      >
                        <Text
                          className={cn(
                            'font-medium capitalize',
                            status === s ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                          )}
                        >
                          {s}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Category
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {['Tuition', 'Registration', 'Costume', 'Event', 'Other'].map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setCategory(c)}
                        className={cn(
                          'px-4 py-2 rounded-full',
                          category === c ? 'bg-teal-500' : isDark ? 'bg-gray-800' : 'bg-gray-100'
                        )}
                      >
                        <Text
                          className={cn(
                            'font-medium',
                            category === c ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                          )}
                        >
                          {c}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Notes
                  </Text>
                  <TextInput
                    className={cn(
                      'px-4 py-3 rounded-xl text-base',
                      isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    )}
                    placeholder="Add any notes..."
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={3}
                    style={{ minHeight: 80, textAlignVertical: 'top' }}
                    cursorColor={isDark ? '#FFFFFF' : '#000000'}
                    selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </>
  );
}
