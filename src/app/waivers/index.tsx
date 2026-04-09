import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Linking, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  Plus,
  X,
  Check,
  FileText,
  Pen,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Link as LinkIcon,
  Upload,
  ExternalLink,
  Trash2,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { parseISO } from 'date-fns';
import type { Waiver } from '@/lib/types';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';

// Extended waiver type for documents
interface WaiverDocument {
  id: string;
  halauId: string;
  title: string;
  description?: string;
  type: 'link' | 'document';
  url: string;
  fileName?: string;
  createdAt: string;
}

export default function WaiversScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [showAddModal, setShowAddModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [selectedWaiver, setSelectedWaiver] = useState<Waiver | null>(null);
  const [signatureData, setSignatureData] = useState('');

  // Form state for adding waiver documents
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentDescription, setDocumentDescription] = useState('');
  const [documentType, setDocumentType] = useState<'link' | 'document'>('link');
  const [documentUrl, setDocumentUrl] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<{ name: string; uri: string } | null>(null);

  // Waiver documents state (would be stored in store in real implementation)
  const [waiverDocuments, setWaiverDocuments] = useState<WaiverDocument[]>([]);

  // Form state for creating text waivers (keeping existing functionality)
  const [waiverTitle, setWaiverTitle] = useState('');
  const [waiverContent, setWaiverContent] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('365');

  // Store selectors
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentMember = useAppStore((s) => s.currentMember);
  const getWaiversByHalau = useAppStore((s) => s.getWaiversByHalau);
  const getWaiverSignatures = useAppStore((s) => s.getWaiverSignatures);
  const getMemberWaiverStatus = useAppStore((s) => s.getMemberWaiverStatus);
  const createWaiver = useAppStore((s) => s.createWaiver);
  const signWaiver = useAppStore((s) => s.signWaiver);
  const isKumu = useAppStore((s) => s.isKumu);
  const getMembersByHalau = useAppStore((s) => s.getMembersByHalau);
  const getHalau = useAppStore((s) => s.getHalau);

  const waivers = currentHalauId ? getWaiversByHalau(currentHalauId) : [];
  const members = currentHalauId ? getMembersByHalau(currentHalauId) : [];
  const myWaiverStatus = currentMember ? getMemberWaiverStatus(currentMember.id) : [];
  const isTeacher = isKumu();
  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  // Get theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  const handleCreateWaiver = () => {
    if (!waiverTitle.trim() || !waiverContent.trim() || !currentHalauId) return;

    createWaiver({
      halauId: currentHalauId,
      title: waiverTitle.trim(),
      content: waiverContent.trim(),
      expiresInDays: parseInt(expiresInDays) || undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset form
    setWaiverTitle('');
    setWaiverContent('');
    setExpiresInDays('365');
    setShowAddModal(false);
  };

  const handleAddDocument = () => {
    if (!documentTitle.trim() || !currentHalauId) return;

    if (documentType === 'link' && !documentUrl.trim()) {
      Alert.alert('Error', 'Please enter a URL for the waiver');
      return;
    }

    if (documentType === 'document' && !selectedDocument) {
      Alert.alert('Error', 'Please select a document to upload');
      return;
    }

    const newDoc: WaiverDocument = {
      id: Date.now().toString(),
      halauId: currentHalauId,
      title: documentTitle.trim(),
      description: documentDescription.trim() || undefined,
      type: documentType,
      url: documentType === 'link' ? documentUrl.trim() : selectedDocument!.uri,
      fileName: documentType === 'document' ? selectedDocument!.name : undefined,
      createdAt: new Date().toISOString(),
    };

    setWaiverDocuments([...waiverDocuments, newDoc]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset form
    resetDocumentForm();
    setShowAddModal(false);
  };

  const resetDocumentForm = () => {
    setDocumentTitle('');
    setDocumentDescription('');
    setDocumentType('link');
    setDocumentUrl('');
    setSelectedDocument(null);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedDocument({ name: asset.name, uri: asset.uri });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleOpenDocument = async (doc: WaiverDocument) => {
    try {
      if (doc.type === 'link') {
        const supported = await Linking.canOpenURL(doc.url);
        if (supported) {
          await Linking.openURL(doc.url);
        } else {
          Alert.alert('Error', 'Cannot open this URL');
        }
      } else {
        // For uploaded documents, open the file
        await Linking.openURL(doc.url);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open document');
    }
  };

  const handleDeleteDocument = (docId: string) => {
    Alert.alert(
      'Delete Waiver',
      'Are you sure you want to delete this waiver document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setWaiverDocuments(waiverDocuments.filter((d) => d.id !== docId));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleSignWaiver = () => {
    if (!selectedWaiver || !signatureData.trim()) return;

    signWaiver(selectedWaiver.id, signatureData.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setSignatureData('');
    setSelectedWaiver(null);
    setShowSignModal(false);
  };

  const getWaiverStatus = (waiverId: string): 'signed' | 'pending' | 'expired' => {
    const signature = myWaiverStatus.find((s) => s.waiverId === waiverId);
    if (!signature) return 'pending';
    if (signature.expiresAt && parseISO(signature.expiresAt) < new Date()) return 'expired';
    return 'signed';
  };

  // Waiver Document Card Component
  const WaiverDocumentCard = ({ doc, index }: { doc: WaiverDocument; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
      <Pressable
        onPress={() => handleOpenDocument(doc)}
        className={cn(
          'rounded-2xl p-4 mb-3 active:opacity-80',
          isDark ? 'bg-gray-800/80' : 'bg-white'
        )}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: isDark ? 0.5 : 0.2,
          shadowRadius: 6,
          elevation: isDark ? 6 : 5,
        }}
      >
        <View className="flex-row items-start">
          <View
            className="w-12 h-12 rounded-xl items-center justify-center mr-4"
            style={{ backgroundColor: `${theme.primary}15` }}
          >
            {doc.type === 'link' ? (
              <LinkIcon size={24} color={theme.primary} />
            ) : (
              <FileText size={24} color={theme.primary} />
            )}
          </View>
          <View className="flex-1">
            <Text className={cn('font-semibold text-lg', isDark ? 'text-white' : 'text-gray-900')}>
              {doc.title}
            </Text>
            {doc.description && (
              <Text className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-500')} numberOfLines={2}>
                {doc.description}
              </Text>
            )}
            <View className="flex-row items-center mt-2">
              <View
                className="px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${theme.primary}15` }}
              >
                <Text style={{ color: theme.primary }} className="text-xs font-medium">
                  {doc.type === 'link' ? 'Online Form' : 'Document'}
                </Text>
              </View>
              {doc.fileName && (
                <Text className={cn('text-xs ml-2', isDark ? 'text-gray-500' : 'text-gray-400')} numberOfLines={1}>
                  {doc.fileName}
                </Text>
              )}
            </View>
          </View>
          <View className="flex-row items-center">
            {isTeacher && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteDocument(doc.id);
                }}
                className="w-8 h-8 rounded-full items-center justify-center mr-2"
                style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)' }}
              >
                <Trash2 size={16} color="#EF4444" />
              </Pressable>
            )}
            <ExternalLink size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  const WaiverCard = ({ waiver, index }: { waiver: Waiver; index: number }) => {
    const signatures = getWaiverSignatures(waiver.id);
    const signedCount = signatures.filter((s) => s.status === 'signed').length;
    const status = getWaiverStatus(waiver.id);

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
        <Pressable
          onPress={() => {
            if (!isTeacher && status !== 'signed') {
              setSelectedWaiver(waiver);
              setShowSignModal(true);
            }
          }}
          className={cn(
            'rounded-2xl p-4 mb-3 active:opacity-80',
            isDark ? 'bg-gray-800/80' : 'bg-white'
          )}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: isDark ? 0.5 : 0.2,
            shadowRadius: 6,
            elevation: isDark ? 6 : 5,
          }}
        >
          <View className="flex-row items-start">
            <View
              className={cn(
                'w-12 h-12 rounded-xl items-center justify-center mr-4',
                status === 'signed' ? 'bg-green-500/10' : status === 'expired' ? 'bg-red-500/10' : 'bg-amber-500/10'
              )}
            >
              {status === 'signed' ? (
                <CheckCircle size={24} color="#10B981" />
              ) : status === 'expired' ? (
                <AlertCircle size={24} color="#EF4444" />
              ) : (
                <FileText size={24} color="#F59E0B" />
              )}
            </View>
            <View className="flex-1">
              <Text className={cn('font-semibold text-lg', isDark ? 'text-white' : 'text-gray-900')}>
                {waiver.title}
              </Text>
              <Text className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-500')} numberOfLines={2}>
                {waiver.content}
              </Text>
              <View className="flex-row items-center mt-2">
                {isTeacher ? (
                  <>
                    <CheckCircle size={14} color="#10B981" />
                    <Text className="text-sm ml-1.5 text-green-600">
                      {signedCount}/{members.length} signed
                    </Text>
                  </>
                ) : (
                  <View
                    className={cn(
                      'px-2 py-0.5 rounded-full',
                      status === 'signed' ? 'bg-green-500/10' : status === 'expired' ? 'bg-red-500/10' : 'bg-amber-500/10'
                    )}
                  >
                    <Text
                      className={cn(
                        'text-xs font-medium capitalize',
                        status === 'signed' ? 'text-green-600' : status === 'expired' ? 'text-red-600' : 'text-amber-600'
                      )}
                    >
                      {status}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {!isTeacher && status !== 'signed' && (
              <ChevronRight size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const hasDocuments = waiverDocuments.filter((d) => d.halauId === currentHalauId).length > 0;
  const hasWaivers = waivers.length > 0;
  const hasPendingWaivers = !isTeacher && waivers.some((w) => getWaiverStatus(w.id) !== 'signed');

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Waivers',
          headerStyle: { backgroundColor: isDark ? '#111827' : '#FFFFFF' },
          headerTintColor: isDark ? '#FFFFFF' : '#111827',
          headerShadowVisible: false,
          headerBackTitle: '',
          headerBackVisible: true,
        }}
      />
      <View className={cn('flex-1', isDark ? 'bg-gray-900' : 'bg-gray-50')}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* Info Banner for Students */}
          {hasPendingWaivers && (
            <View className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-4">
              <View className="flex-row items-center">
                <Pen size={20} color="#F59E0B" />
                <Text className="text-amber-700 dark:text-amber-400 font-semibold ml-2">
                  Waivers Required
                </Text>
              </View>
              <Text className="text-amber-600/70 dark:text-amber-500/70 text-sm mt-1">
                Please review and sign all pending waivers to participate in activities.
              </Text>
            </View>
          )}

          {/* Waiver Documents Section */}
          {(hasDocuments || isTeacher) && (
            <View className="mb-6">
              <Text className={cn('text-lg font-bold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
                Waiver Forms
              </Text>
              <Text className={cn('text-sm mb-4', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {isTeacher
                  ? 'Add links to online waiver forms or upload waiver documents for new members to complete.'
                  : 'Please review and complete the following waiver forms.'}
              </Text>

              {waiverDocuments
                .filter((d) => d.halauId === currentHalauId)
                .map((doc, index) => (
                  <WaiverDocumentCard key={doc.id} doc={doc} index={index} />
                ))}

              {!hasDocuments && !isTeacher && (
                <View className={cn('rounded-2xl p-6 items-center', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
                  <FileText size={40} color={isDark ? '#4B5563' : '#9CA3AF'} />
                  <Text className={cn('mt-3 text-center font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    No waiver forms available
                  </Text>
                  <Text className={cn('text-sm text-center mt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    Your instructor will add waiver forms here
                  </Text>
                </View>
              )}

              {!hasDocuments && isTeacher && (
                <Pressable
                  onPress={() => setShowAddModal(true)}
                  className={cn(
                    'rounded-2xl p-6 items-center border-2 border-dashed',
                    isDark ? 'border-gray-700 bg-gray-800/30' : 'border-gray-300 bg-gray-50'
                  )}
                >
                  <View
                    className="w-14 h-14 rounded-full items-center justify-center mb-3"
                    style={{ backgroundColor: `${theme.primary}15` }}
                  >
                    <Plus size={28} color={theme.primary} />
                  </View>
                  <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                    Add Waiver Form
                  </Text>
                  <Text className={cn('text-sm text-center mt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    Link to an online form or upload a document
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* In-App Waivers Section (existing functionality) */}
          {(hasWaivers || isTeacher) && (
            <View>
              <Text className={cn('text-lg font-bold mb-3', isDark ? 'text-white' : 'text-gray-900')}>
                In-App Waivers
              </Text>

              {waivers.map((waiver, index) => (
                <WaiverCard key={waiver.id} waiver={waiver} index={index} />
              ))}

              {!hasWaivers && (
                <View className={cn('rounded-2xl p-6 items-center', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
                  <FileText size={40} color={isDark ? '#4B5563' : '#9CA3AF'} />
                  <Text className={cn('mt-3 text-center font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    No in-app waivers yet
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Add Waiver FAB (Teacher only) */}
        {isTeacher && (
          <Pressable
            onPress={() => setShowAddModal(true)}
            className="absolute bottom-24 right-4 w-14 h-14 rounded-full items-center justify-center shadow-lg"
            style={{
              backgroundColor: theme.primary,
              shadowColor: theme.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Plus size={28} color="white" />
          </Pressable>
        )}

        {/* Add Waiver Modal */}
        <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1 }} className={cn(isDark ? 'bg-gray-900' : 'bg-white')}>
            <View
              className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
              style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
            >
              <Pressable onPress={() => { setShowAddModal(false); resetDocumentForm(); }}>
                <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </Pressable>
              <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                Add Waiver
              </Text>
              <Pressable
                onPress={handleAddDocument}
                disabled={!documentTitle.trim() || (documentType === 'link' && !documentUrl.trim()) || (documentType === 'document' && !selectedDocument)}
                className={cn(
                  (!documentTitle.trim() || (documentType === 'link' && !documentUrl.trim()) || (documentType === 'document' && !selectedDocument)) && 'opacity-50'
                )}
              >
                <Check size={24} color={theme.primary} />
              </Pressable>
            </View>

            <KeyboardAwareScrollView className="flex-1 px-5 py-4" keyboardShouldPersistTaps="handled" bottomOffset={16}>
              {/* Type Selection */}
              <View className="mb-6">
                <Text className={cn('text-sm font-medium mb-3', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Waiver Type
                </Text>
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => setDocumentType('link')}
                    className={cn(
                      'flex-1 p-4 rounded-xl border-2 items-center',
                      documentType === 'link'
                        ? 'border-transparent'
                        : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                    )}
                    style={documentType === 'link' ? { backgroundColor: `${theme.primary}15`, borderColor: theme.primary } : undefined}
                  >
                    <LinkIcon size={28} color={documentType === 'link' ? theme.primary : (isDark ? '#9CA3AF' : '#6B7280')} />
                    <Text
                      className={cn(
                        'font-medium mt-2',
                        documentType === 'link' ? '' : isDark ? 'text-gray-300' : 'text-gray-600'
                      )}
                      style={documentType === 'link' ? { color: theme.primary } : undefined}
                    >
                      Online Link
                    </Text>
                    <Text className={cn('text-xs text-center mt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      Google Forms, DocuSign, etc.
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setDocumentType('document')}
                    className={cn(
                      'flex-1 p-4 rounded-xl border-2 items-center',
                      documentType === 'document'
                        ? 'border-transparent'
                        : isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
                    )}
                    style={documentType === 'document' ? { backgroundColor: `${theme.primary}15`, borderColor: theme.primary } : undefined}
                  >
                    <Upload size={28} color={documentType === 'document' ? theme.primary : (isDark ? '#9CA3AF' : '#6B7280')} />
                    <Text
                      className={cn(
                        'font-medium mt-2',
                        documentType === 'document' ? '' : isDark ? 'text-gray-300' : 'text-gray-600'
                      )}
                      style={documentType === 'document' ? { color: theme.primary } : undefined}
                    >
                      Upload File
                    </Text>
                    <Text className={cn('text-xs text-center mt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      PDF or Word document
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Title */}
              <View className="mb-4">
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Title *
                </Text>
                <TextInput
                  className={cn(
                    'px-4 py-3 rounded-xl text-base',
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                  placeholder="e.g., Liability Waiver, Registration Form"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={documentTitle}
                  onChangeText={setDocumentTitle}
                  cursorColor={isDark ? '#FFFFFF' : '#000000'}
                  selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                />
              </View>

              {/* Description */}
              <View className="mb-4">
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Description (optional)
                </Text>
                <TextInput
                  className={cn(
                    'px-4 py-3 rounded-xl text-base',
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                  placeholder="Brief description of this waiver..."
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={documentDescription}
                  onChangeText={setDocumentDescription}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                  cursorColor={isDark ? '#FFFFFF' : '#000000'}
                  selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                />
              </View>

              {/* URL Input (for link type) */}
              {documentType === 'link' && (
                <View className="mb-4">
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    URL *
                  </Text>
                  <TextInput
                    className={cn(
                      'px-4 py-3 rounded-xl text-base',
                      isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    )}
                    placeholder="https://forms.google.com/..."
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={documentUrl}
                    onChangeText={setDocumentUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                    cursorColor={isDark ? '#FFFFFF' : '#000000'}
                    selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                  />
                  <Text className={cn('text-xs mt-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    Enter the full URL to your online waiver form (Google Forms, DocuSign, JotForm, etc.)
                  </Text>
                </View>
              )}

              {/* Document Picker (for document type) */}
              {documentType === 'document' && (
                <View className="mb-4">
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Document *
                  </Text>
                  {selectedDocument ? (
                    <View className={cn('p-4 rounded-xl flex-row items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                      <FileText size={24} color={theme.primary} />
                      <Text className={cn('flex-1 ml-3 font-medium', isDark ? 'text-white' : 'text-gray-900')} numberOfLines={1}>
                        {selectedDocument.name}
                      </Text>
                      <Pressable onPress={() => setSelectedDocument(null)}>
                        <X size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={handlePickDocument}
                      className={cn(
                        'p-6 rounded-xl border-2 border-dashed items-center',
                        isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-300 bg-gray-50'
                      )}
                    >
                      <Upload size={32} color={isDark ? '#6B7280' : '#9CA3AF'} />
                      <Text className={cn('font-medium mt-2', isDark ? 'text-gray-300' : 'text-gray-600')}>
                        Tap to select document
                      </Text>
                      <Text className={cn('text-xs mt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        PDF or Word files supported
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Info Box */}
              <View
                className={cn('p-4 rounded-xl mt-4', isDark ? 'bg-gray-800' : 'bg-blue-50')}
                style={{ borderLeftWidth: 3, borderLeftColor: theme.primary }}
              >
                <Text className={cn('text-sm font-medium mb-1', isDark ? 'text-white' : 'text-gray-900')}>
                  How it works
                </Text>
                <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  {documentType === 'link'
                    ? 'Members will be able to tap to open the link in their browser where they can fill out and submit the waiver form directly.'
                    : 'Members will be able to download and view the document. They can print, sign, and return it to you as needed.'}
                </Text>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </Modal>

        {/* Sign Waiver Modal */}
        <Modal visible={showSignModal} animationType="slide" presentationStyle="pageSheet">
          <View style={{ flex: 1 }} className={cn(isDark ? 'bg-gray-900' : 'bg-white')}>
            <View
              className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
              style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
            >
              <Pressable onPress={() => { setShowSignModal(false); setSelectedWaiver(null); }}>
                <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </Pressable>
              <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                Sign Waiver
              </Text>
              <Pressable
                onPress={handleSignWaiver}
                disabled={!signatureData.trim()}
                className={cn(!signatureData.trim() && 'opacity-50')}
              >
                <Check size={24} color={theme.primary} />
              </Pressable>
            </View>

            {selectedWaiver && (
              <KeyboardAwareScrollView className="flex-1 px-5 py-4" keyboardShouldPersistTaps="handled" bottomOffset={16}>
                <Text className={cn('text-xl font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
                  {selectedWaiver.title}
                </Text>

                <View className={cn('rounded-xl p-4 mb-6', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                  <Text className={cn('text-sm leading-6', isDark ? 'text-gray-300' : 'text-gray-700')}>
                    {selectedWaiver.content}
                  </Text>
                </View>

                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Type Your Full Name to Sign *
                  </Text>
                  <TextInput
                    className={cn(
                      'px-4 py-3 rounded-xl text-base',
                      isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                    )}
                    placeholder="Your full legal name"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={signatureData}
                    onChangeText={setSignatureData}
                    autoCapitalize="words"
                    cursorColor={isDark ? '#FFFFFF' : '#000000'}
                    selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                  />
                  <Text className={cn('text-xs mt-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    By typing your name, you agree to the terms of this waiver.
                  </Text>
                </View>
              </KeyboardAwareScrollView>
            )}
          </View>
        </Modal>
      </View>
    </>
  );
}
