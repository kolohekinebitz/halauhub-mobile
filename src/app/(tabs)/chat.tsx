import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, FlatList, Modal, Alert, useWindowDimensions } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore, useShallow } from '@/lib/store';
import { cn } from '@/lib/cn';
import { Send, Hash, Users, Plus, ArrowLeft, Search, MoreVertical, Edit2, Trash2, X, Check, Image as ImageIcon, Paperclip, File, UserPlus, Smile, BarChart3, Camera, Pin, Lock, GraduationCap, CornerUpLeft, MessageCircle } from 'lucide-react-native';
import { format, parseISO, isToday, isYesterday, differenceInMinutes, differenceInHours, differenceInDays, isSameDay } from 'date-fns';
import type { ChatChannel, ChatMessage, MessagePoll, PollOption, MessageReaction } from '@/lib/types';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import { useDeepMemo } from '@/lib/useDeepMemo';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { s, ms } from '@/lib/scaling';
import { ChatMessageItem } from '@/components/ChatMessageItem';
import { subscribeToHalauMessages } from '@/lib/firebaseService';

// Static emoji arrays - defined outside component to prevent recreation on every render
const QUICK_EMOJIS: string[] = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '👏'];
const ALL_EMOJIS: string[] = ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💝', '💘', '🔥', '⭐', '🌟', '✨', '💫', '🎉', '🎊', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🎸', '🎹', '🎤', '🎧'];

function ChatContent() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width: screenWidth } = useWindowDimensions();

  // Calculate image width based on chat bubble width (75% of screen minus padding)
  const chatBubbleWidth = (screenWidth - s(32)) * 0.75; // 32 is horizontal padding
  const imageWidth = chatBubbleWidth - s(24); // subtract padding inside bubble

  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showChannelOptions, setShowChannelOptions] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<{ type: 'image' | 'file'; uri: string; name?: string } | null>(null);
  const [selectedMessageForDelete, setSelectedMessageForDelete] = useState<ChatMessage | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedClassLevelIds, setSelectedClassLevelIds] = useState<string[]>([]);
  const [newChannelNameInput, setNewChannelNameInput] = useState('');
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);

  // Private message state
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const [privateRecipients, setPrivateRecipients] = useState<string[]>([]);
  const [showPrivateRecipientPicker, setShowPrivateRecipientPicker] = useState(false);

  // Pinned messages state
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);

  // New state for enhanced features
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDuration, setPollDuration] = useState<'1h' | '24h' | '3d' | '7d' | 'none'>('24h');

  // Edit poll state
  const [showPollEditor, setShowPollEditor] = useState(false);
  const [editingPollMessage, setEditingPollMessage] = useState<ChatMessage | null>(null);
  const [editPollQuestion, setEditPollQuestion] = useState('');
  const [editPollOptions, setEditPollOptions] = useState<string[]>(['', '']);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [selectedMessageForReaction, setSelectedMessageForReaction] = useState<ChatMessage | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  // Guard against double-sends when the user taps the send button rapidly
  // (both calls see the same non-empty messageText before the re-render clears it).
  const sendingRef = useRef(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showNewMessages, setShowNewMessages] = useState(false);
  const prevMessageCountRef = useRef(0);

  // Store selectors - use useShallow for object/array selectors to prevent unnecessary re-renders
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const currentMember = useDeepMemo(useAppStore((s) => s.currentMember));
  const isTeacher = useAppStore((s) => s.isKumu());

  // Subscribe directly to chatChannels and chatMessages for real-time updates
  const chatChannels = useAppStore((s) => s.chatChannels);
  const chatMessages = useAppStore((s) => s.chatMessages);
  // Subscribe directly to raw members state so new members trigger re-renders
  const storeMembers = useAppStore((s) => s.members);
  // Subscribe to halaus so classLevels recomputes when class names change
  const halaus = useAppStore((s) => s.halaus);

  // Store actions - these are stable references
  const storeActions = useAppStore(useShallow((s) => ({
    getChannelsByHalau: s.getChannelsByHalau,
    getChannelMessages: s.getChannelMessages,
    getUnreadCount: s.getUnreadCount,
    sendMessage: s.sendMessage,
    deleteMessage: s.deleteMessage,
    updateMessage: s.updateMessage,
    markMessageRead: s.markMessageRead,
    getMember: s.getMember,
    getMembersByHalau: s.getMembersByHalau,
    createChannel: s.createChannel,
    updateChannel: s.updateChannel,
    deleteChannel: s.deleteChannel,
    addReaction: s.addReaction,
    removeReaction: s.removeReaction,
    votePoll: s.votePoll,
    pinMessage: s.pinMessage,
    unpinMessage: s.unpinMessage,
    getHalau: s.getHalau,
    getClassLevelsForHalau: s.getClassLevelsForHalau,
    mergeChatMessages: s.mergeChatMessages,
  })));

  // ─── Firestore real-time chat listener ────────────────────────────────────
  // Delegates to firebaseService which owns all direct Firestore access and
  // manages network enable/disable at subscription boundaries.
  useEffect(() => {
    if (!currentHalauId) return;
    const unsubscribe = subscribeToHalauMessages(
      currentHalauId,
      (incoming) => {
        if (incoming.length > 0) {
          useAppStore.getState().mergeChatMessages(incoming);
        }
      },
    );
    return unsubscribe;
  }, [currentHalauId]);

  const {
    getChannelsByHalau,
    getChannelMessages,
    getUnreadCount,
    sendMessage,
    deleteMessage,
    updateMessage,
    markMessageRead,
    getMember,
    getMembersByHalau,
    createChannel,
    updateChannel,
    deleteChannel,
    addReaction,
    removeReaction,
    votePoll,
    pinMessage,
    unpinMessage,
    getHalau,
    getClassLevelsForHalau,
  } = storeActions;

  const halau = currentHalauId ? getHalau(currentHalauId) : null;

  // Derive channels from subscribed chatChannels state for real-time updates
  const channels = useMemo(() => {
    if (!currentHalauId) return [];
    return chatChannels.filter(
      (c) =>
        c.halauId === currentHalauId &&
        (c.type === 'halau' || (currentMember && c.memberIds.includes(currentMember.id)))
    );
  }, [currentHalauId, chatChannels, currentMember]);

  const members = useMemo(
    () => currentHalauId ? storeMembers.filter((m) => m.halauId === currentHalauId && m.status === 'approved') : [],
    [currentHalauId, storeMembers]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const classLevels = useMemo(() => currentHalauId ? getClassLevelsForHalau(currentHalauId) : [], [currentHalauId, getClassLevelsForHalau, halaus]);

  // Get theme colors
  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  // Generate soft pastel background from theme color
  const getPastelBackground = (hexColor: string, isDarkMode: boolean): string => {
    // Convert hex to RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    if (isDarkMode) {
      // For dark mode: very subtle tinted dark background
      return `rgba(${r}, ${g}, ${b}, 0.08)`;
    } else {
      // For light mode: soft pastel tint
      return `rgba(${r}, ${g}, ${b}, 0.06)`;
    }
  };

  const chatBackground = getPastelBackground(theme.primary, isDark);

  // Filter channels: show all to creator, show only channels where user is a member (or type is 'halau' for General)
  const visibleChannels = useMemo(() => {
    return channels.filter((c) => {
      // General/halau channels are visible to all
      if (c.type === 'halau') return true;
      // Creator can always see their channels
      if (c.createdBy === currentMember?.id) return true;
      // Otherwise, user must be in memberIds
      return currentMember && c.memberIds.includes(currentMember.id);
    });
  }, [channels, currentMember]);

  const filteredChannels = useMemo(() => {
    const filtered = visibleChannels.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    // Always show General (halau-type) channels first
    return filtered.sort((a, b) => {
      if (a.type === 'halau' && b.type !== 'halau') return -1;
      if (a.type !== 'halau' && b.type === 'halau') return 1;
      return 0;
    });
  }, [visibleChannels, searchQuery]);

  const handleSelectChannel = useCallback((channel: ChatChannel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedChannel(channel);
  }, []);

  const handleOpenCreateChannel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setNewChannelNameInput('');
    setSelectedMemberIds(currentMember ? [currentMember.id] : []);
    setSelectedClassLevelIds([]);
    setShowCreateChannelModal(true);
  }, [currentMember]);

  const handleSendMessage = useCallback(() => {
    if (sendingRef.current) return;
    if ((!messageText.trim() && !pendingAttachment) || !selectedChannel) return;
    sendingRef.current = true;

    // Extract mentions from message text
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(messageText)) !== null) {
      mentions.push(match[2]); // Extract member ID
    }

    // Convert mention format to display format
    const displayText = messageText.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, '@$1');

    sendMessage(
      selectedChannel.id,
      displayText.trim() || (pendingAttachment ? '' : ''),
      pendingAttachment || undefined,
      mentions.length > 0 ? mentions : undefined,
      undefined,
      isPrivateMode && privateRecipients.length > 0 ? true : undefined,
      isPrivateMode && privateRecipients.length > 0 ? privateRecipients : undefined,
      replyToMessage?.id
    );
    sendingRef.current = false;
    setMessageText('');
    setPendingAttachment(null);
    setIsPrivateMode(false);
    setPrivateRecipients([]);
    setReplyToMessage(null);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messageText, selectedChannel, sendMessage, pendingAttachment, isPrivateMode, privateRecipients, replyToMessage]);

  const handleSendPoll = useCallback(() => {
    if (!pollQuestion.trim() || !selectedChannel) return;

    const validOptions = pollOptions.filter((opt) => opt.trim());
    if (validOptions.length < 2) {
      Alert.alert('Invalid Poll', 'Please add at least 2 options.');
      return;
    }

    // Calculate expiration time
    let expiresAt: string | undefined;
    const now = new Date();
    switch (pollDuration) {
      case '1h':
        expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
        break;
      case '24h':
        expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        break;
      case '3d':
        expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '7d':
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      default:
        expiresAt = undefined;
    }

    const poll: MessagePoll = {
      question: pollQuestion.trim(),
      options: validOptions.map((opt, idx) => ({
        id: `opt_${idx}_${Date.now()}`,
        text: opt.trim(),
        votes: [],
      })),
      expiresAt,
      allowMultiple: false,
      createdBy: currentMember?.id || '',
    };

    sendMessage(selectedChannel.id, '', undefined, undefined, poll);
    setShowPollCreator(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollDuration('24h');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [pollQuestion, pollOptions, pollDuration, selectedChannel, sendMessage, currentMember]);

  const handleInsertMention = useCallback((member: { id: string; firstName: string; lastName: string }) => {
    // Insert mention at cursor position
    const beforeCursor = messageText.slice(0, cursorPosition).replace(/@\w*$/, '');
    const afterCursor = messageText.slice(cursorPosition);
    const mentionText = `@[${member.firstName} ${member.lastName}](${member.id}) `;
    setMessageText(beforeCursor + mentionText + afterCursor);
    setShowMentionPicker(false);
    setMentionQuery('');
    inputRef.current?.focus();
  }, [messageText, cursorPosition]);

  const handleTextChange = useCallback((text: string) => {
    setMessageText(text);

    // Check for @ mention trigger
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = text.slice(lastAtIndex + 1);
      // Only show picker if @ is at start or after space, and no space after @
      const charBeforeAt = text[lastAtIndex - 1];
      if ((!charBeforeAt || charBeforeAt === ' ' || charBeforeAt === '\n') && !textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt.toLowerCase());
        setShowMentionPicker(true);
        return;
      }
    }
    setShowMentionPicker(false);
  }, []);

  const handleInsertEmoji = useCallback((emoji: string) => {
    setMessageText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  }, []);

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addReaction(messageId, emoji);
    setShowReactionPicker(false);
    setSelectedMessageForReaction(null);
  }, [addReaction]);

  const handleRemoveReaction = useCallback((messageId: string, emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeReaction(messageId, emoji);
  }, [removeReaction]);

  const handleVotePoll = useCallback((messageId: string, optionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    votePoll(messageId, optionId);
  }, [votePoll]);

  const handleOpenPollEditor = useCallback((message: ChatMessage) => {
    if (!message.poll) return;
    setEditingPollMessage(message);
    setEditPollQuestion(message.poll.question);
    setEditPollOptions(message.poll.options.map((o) => o.text));
    setShowPollEditor(true);
    setShowReactionPicker(false);
    setSelectedMessageForReaction(null);
  }, []);

  const handleSaveEditedPoll = useCallback(() => {
    if (!editingPollMessage?.poll || !editPollQuestion.trim()) return;
    const validOptions = editPollOptions.filter((opt) => opt.trim());
    if (validOptions.length < 2) {
      Alert.alert('Invalid Poll', 'Please keep at least 2 options.');
      return;
    }
    // Preserve existing votes for options that still exist (matched by text), reset for changed/new
    const updatedOptions = validOptions.map((optText, idx) => {
      const existing = editingPollMessage.poll!.options.find((o) => o.text === optText.trim());
      return existing
        ? { ...existing, text: optText.trim() }
        : { id: `opt_${idx}_${Date.now()}`, text: optText.trim(), votes: [] };
    });
    const updatedPoll: MessagePoll = {
      ...editingPollMessage.poll,
      question: editPollQuestion.trim(),
      options: updatedOptions,
    };
    updateMessage(editingPollMessage.id, { poll: updatedPoll });
    setShowPollEditor(false);
    setEditingPollMessage(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [editingPollMessage, editPollQuestion, editPollOptions, updateMessage]);

  const handlePinMessage = useCallback((messageId: string) => {
    if (!selectedChannel) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    pinMessage(selectedChannel.id, messageId);
    setShowReactionPicker(false);
    setSelectedMessageForReaction(null);
  }, [selectedChannel, pinMessage]);

  const handleUnpinMessage = useCallback((messageId: string) => {
    if (!selectedChannel) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    unpinMessage(selectedChannel.id, messageId);
  }, [selectedChannel, unpinMessage]);

  // Helper: given a list of member IDs, return the IDs of any linked guardians not already included
  const getGuardianIdsForMembers = useCallback((memberIds: string[]) => {
    const guardianIds: string[] = [];
    for (const memberId of memberIds) {
      const member = members.find((m) => m.id === memberId);
      if (member?.isKeiki && member.linkedToMemberId) {
        const guardian = members.find((m) => m.id === member.linkedToMemberId);
        if (guardian && !memberIds.includes(guardian.id)) {
          guardianIds.push(guardian.id);
        }
      }
    }
    return [...new Set(guardianIds)];
  }, [members]);

  const handleToggleClassLevel = useCallback((classLevelId: string) => {
    const classLevel = classLevels.find((cl) => cl.id === classLevelId);
    if (!classLevel) return;

    // Get all members in this class level
    const membersInClass = members.filter(
      (m) => m.classLevel === classLevel.id || m.classLevel === classLevel.value
    );
    const memberIdsInClass = membersInClass.map((m) => m.id);

    setSelectedClassLevelIds((prev) => {
      if (prev.includes(classLevelId)) {
        // Deselect: remove class level and its members
        setSelectedMemberIds((prevMembers) =>
          prevMembers.filter((id) => !memberIdsInClass.includes(id))
        );
        return prev.filter((id) => id !== classLevelId);
      } else {
        // Select: add class level members and their linked guardians
        const guardianIds = getGuardianIdsForMembers(memberIdsInClass);
        setSelectedMemberIds((prevMembers) =>
          [...new Set([...prevMembers, ...memberIdsInClass, ...guardianIds])]
        );
        return [...prev, classLevelId];
      }
    });
  }, [classLevels, members, getGuardianIdsForMembers]);

  const getPollTimeRemaining = useCallback((expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    if (expiry <= now) return 'Ended';

    const minutes = differenceInMinutes(expiry, now);
    if (minutes < 60) return `${minutes}m left`;

    const hours = differenceInHours(expiry, now);
    if (hours < 24) return `${hours}h left`;

    const days = differenceInDays(expiry, now);
    return `${days}d left`;
  }, []);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to share images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingAttachment({
        type: 'image',
        uri: result.assets[0].uri,
        name: result.assets[0].fileName || 'image.jpg',
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const fileName = result.assets[0].name || 'Document';
        setPendingAttachment({
          type: 'file',
          uri: result.assets[0].uri,
          name: fileName.trim() || 'Document',
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      if (__DEV__) {
        console.log('Document picker error:', error);
      }
    }
  };

  const handleTakePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your camera to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingAttachment({
        type: 'image',
        uri: result.assets[0].uri,
        name: 'photo.jpg',
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleRenameChannel = () => {
    if (!selectedChannel || !newChannelName.trim()) return;
    updateChannel(selectedChannel.id, { name: newChannelName.trim() });
    setSelectedChannel({ ...selectedChannel, name: newChannelName.trim() });
    setShowRenameModal(false);
    setShowChannelOptions(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDeleteChannel = () => {
    if (!selectedChannel) return;
    // Protect the General (halau-type) channel from deletion
    if (selectedChannel.type === 'halau') {
      Alert.alert('Cannot Delete', 'The General channel cannot be deleted — it is visible to all members.');
      return;
    }
    Alert.alert(
      'Delete Channel',
      `Are you sure you want to delete "${selectedChannel.name}"? All messages will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteChannel(selectedChannel.id);
            setSelectedChannel(null);
            setShowChannelOptions(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleDeleteMessage = (message: ChatMessage) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMessage(message.id);
            setSelectedMessageForDelete(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleMessageLongPress = (message: ChatMessage) => {
    if (isTeacher) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedMessageForDelete(message);
    }
  };

  // Stable callbacks for ChatMessageItem props
  const handleOnLongPress = useCallback((message: ChatMessage) => {
    handleMessageLongPress(message);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

  const handleOpenReactionPicker = useCallback((message: ChatMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessageForReaction(message);
    setShowReactionPicker(true);
  }, []);

  const handleReply = useCallback((message: ChatMessage) => {
    setReplyToMessage(message);
  }, []);

  const handleScrollToIndex = useCallback((index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  }, []);

  const handleChatScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const nearBottom = distanceFromBottom < 150;
    setIsNearBottom(nearBottom);
    if (nearBottom) setShowNewMessages(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowNewMessages(false);
  }, []);

  const formatChannelTime = (messages: ChatMessage[]) => {
    if (messages.length === 0) return '';
    const lastMessage = messages[messages.length - 1];
    const date = parseISO(lastMessage.sentAt);
    if (isToday(date)) return format(date, 'h:mm a');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  };

  const renderChannelList = () => (
    <View className="flex-1" style={{ backgroundColor: isDark ? '#000000' : '#F9FAFB' }}>
      {/* Header */}
      <View
        className={cn('px-5 pb-4', isDark ? 'bg-black' : 'bg-white')}
        style={{ paddingTop: insets.top + 12 }}
      >
        <Text className={cn('text-2xl font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
          Messages
        </Text>

        {/* Search */}
        <View
          className={cn(
            'flex-row items-center px-4 py-3 rounded-xl',
            isDark ? 'bg-gray-800' : 'bg-gray-100'
          )}
        >
          <Search size={20} color={isDark ? '#6B7280' : '#9CA3AF'} />
          <TextInput
            className={cn('flex-1 ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}
            placeholder="Search conversations..."
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            cursorColor={isDark ? '#FFFFFF' : '#000000'}
            selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
          />
        </View>
      </View>

      {/* Channel List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
      >
        {/* Action Buttons Row */}
        {isTeacher && (
          <View className="flex-row gap-2 mb-3">
            {/* New Channel Button */}
            <Pressable
              onPress={handleOpenCreateChannel}
              className={cn(
                'flex-1 flex-row items-center px-3 py-2.5 rounded-xl active:opacity-70',
                isDark ? 'bg-gray-800/50' : 'bg-white'
              )}
              style={{
                shadowColor: isDark ? '#000' : '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.5 : 0.2,
                shadowRadius: 6,
                elevation: isDark ? 6 : 5,
              }}
            >
              <View
                className="w-8 h-8 rounded-full items-center justify-center mr-2"
                style={{ backgroundColor: `${theme.primary}15` }}
              >
                <Plus size={18} color={theme.primary} />
              </View>
              <Text className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                New Channel
              </Text>
            </Pressable>

            {/* Private Message Button */}
            <Pressable
              onPress={() => setShowPrivateRecipientPicker(true)}
              className={cn(
                'flex-1 flex-row items-center px-3 py-2.5 rounded-xl active:opacity-70',
                isDark ? 'bg-gray-800/50' : 'bg-white'
              )}
              style={{
                shadowColor: isDark ? '#000' : '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: isDark ? 0.5 : 0.2,
                shadowRadius: 6,
                elevation: isDark ? 6 : 5,
              }}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-2 bg-purple-500/15">
                <Lock size={18} color="#8B5CF6" />
              </View>
              <Text className={cn('font-medium text-sm', isDark ? 'text-white' : 'text-gray-900')}>
                Private Message
              </Text>
            </Pressable>
          </View>
        )}

        {filteredChannels.length > 0 ? (
          filteredChannels.map((channel, index) => {
            const channelMessages = getChannelMessages(channel.id);
            const unreadCount = getUnreadCount(channel.id);
            const lastMessage = channelMessages[channelMessages.length - 1];
            const lastSender = lastMessage ? getMember(lastMessage.senderId) : null;

            // Get preview text for last message
            const getPreviewText = () => {
              if (!lastMessage) return 'No messages yet';
              const senderName = lastSender?.firstName || 'Unknown';
              if (lastMessage.poll) return `${senderName}: 📊 Poll`;
              if (lastMessage.attachment) {
                return `${senderName}: ${lastMessage.attachment.type === 'image' ? '📷 Photo' : '📎 File'}`;
              }
              // Truncate long text and clean up mentions
              const cleanText = lastMessage.text.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
              return `${senderName}: ${cleanText}`;
            };

            return (
              <Pressable
                key={channel.id}
                onPress={() => handleSelectChannel(channel)}
                className={cn(
                  'flex-row items-center px-3 py-2.5 rounded-xl mb-2 active:opacity-70',
                  isDark ? 'bg-gray-800/80' : 'bg-white'
                )}
                style={{
                  shadowColor: isDark ? '#000' : '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isDark ? 0.4 : 0.12,
                  shadowRadius: 4,
                  elevation: isDark ? 4 : 3,
                }}
              >
                <View
                  className={cn(
                    'w-9 h-9 rounded-full items-center justify-center mr-2.5 flex-shrink-0'
                  )}
                  style={{ backgroundColor: channel.type === 'halau' ? `${theme.primary}15` : 'rgba(139, 92, 246, 0.15)' }}
                >
                  {channel.type === 'halau' ? (
                    <Hash size={18} color={theme.primary} />
                  ) : (
                    <Users size={18} color="#8B5CF6" />
                  )}
                </View>

                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1 mr-2 min-w-0">
                      <Text
                        className={cn('font-semibold text-[15px] mr-1.5', isDark ? 'text-white' : 'text-gray-900')}
                        numberOfLines={1}
                      >
                        {channel.name}
                      </Text>
                      {channel.type === 'halau' && (
                        <View
                          className="rounded-full px-1.5 py-0.5 flex-shrink-0"
                          style={{ backgroundColor: `${theme.primary}20` }}
                        >
                          <Text className="text-[10px] font-semibold" style={{ color: theme.primary }}>
                            Everyone
                          </Text>
                        </View>
                      )}
                    </View>
                    {lastMessage && (
                      <Text className={cn('text-xs flex-shrink-0', isDark ? 'text-gray-500' : 'text-gray-400')}>
                        {formatChannelTime(channelMessages)}
                      </Text>
                    )}
                  </View>
                  <View className="flex-row items-center justify-between mt-0.5">
                    <Text
                      className={cn('text-xs flex-1 mr-2', isDark ? 'text-gray-400' : 'text-gray-500')}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {getPreviewText()}
                    </Text>
                    {unreadCount > 0 && (
                      <View
                      className="rounded-full min-w-[18px] h-[18px] items-center justify-center px-1 flex-shrink-0"
                      style={{ backgroundColor: theme.primary }}
                    >
                        <Text className="text-white text-xs font-bold">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })
        ) : (
          <View className="items-center py-12 px-6">
            <Hash size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
            <Text className={cn('mt-4 text-base font-semibold text-center', isDark ? 'text-gray-300' : 'text-gray-700')}>
              {searchQuery.trim() ? 'No channels match your search' : 'No conversations yet'}
            </Text>
            <Text className={cn('mt-2 text-sm text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {searchQuery.trim()
                ? 'Try a different search term'
                : isTeacher
                  ? 'Create a channel to start messaging your halau'
                  : "Your teacher hasn\'t created any channels yet"}
            </Text>
            {!searchQuery.trim() && isTeacher && (
              <Pressable
                onPress={() => setShowCreateChannelModal(true)}
                className="mt-5 px-6 py-3 rounded-full"
                style={{ backgroundColor: theme.primary }}
              >
                <Text className="text-white font-semibold text-sm">Create a Channel</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );

  // Get messages for selected channel - derive from subscribed chatMessages state for real-time updates
  // Filter out private messages that the current user shouldn't see
  const messages = useMemo(() => {
    if (!selectedChannel) return [];
    const channelMessages = chatMessages
      .filter((m) => m.channelId === selectedChannel.id)
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    return channelMessages.filter((msg) => {
      // Non-private messages are visible to all
      if (!msg.isPrivate) return true;
      // Private messages visible only to sender and recipients
      if (!currentMember) return false;
      if (msg.senderId === currentMember.id) return true;
      if (msg.privateRecipients?.includes(currentMember.id)) return true;
      return false;
    });
  }, [selectedChannel, chatMessages, currentMember]); // Dependencies for filtering messages

  // Get pinned messages
  const pinnedMessages = useMemo(() => {
    if (!selectedChannel?.pinnedMessageIds || selectedChannel.pinnedMessageIds.length === 0) return [];
    return messages.filter((msg) => selectedChannel.pinnedMessageIds?.includes(msg.id));
  }, [selectedChannel?.pinnedMessageIds, messages]);

  // Ensure every halau has a General channel visible to all members
  useEffect(() => {
    if (!currentHalauId || !currentMember) return;
    const hasGeneral = chatChannels.some(
      (c) => c.halauId === currentHalauId && c.type === 'halau'
    );
    if (!hasGeneral) {
      createChannel({
        halauId: currentHalauId,
        name: 'General',
        type: 'halau',
        description: 'Main channel — visible to everyone',
        memberIds: [currentMember.id],
      });
    }
  }, [currentHalauId, currentMember, chatChannels, createChannel]);

  // Mark messages as read when entering a channel (only once per channel selection)
  useEffect(() => {
    if (!selectedChannel || !currentMember) return;

    // Mark all unread messages as read when entering the channel
    const unreadMessages = messages.filter(msg => !msg.readBy.includes(currentMember.id));
    unreadMessages.forEach((msg) => {
      markMessageRead(msg.id);
    });
    // Only run when channel changes, not on every message update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChannel?.id, currentMember?.id]);

  // Mark new incoming messages as read while the user is actively viewing the channel
  useEffect(() => {
    if (!selectedChannel || !currentMember) return;

    // Find any unread messages that arrived while viewing this channel
    const unreadMessages = messages.filter(msg => !msg.readBy.includes(currentMember.id));
    if (unreadMessages.length > 0) {
      unreadMessages.forEach((msg) => {
        markMessageRead(msg.id);
      });
    }
  }, [selectedChannel, currentMember, messages, markMessageRead]);

  // Show "New messages" indicator when scrolled up and new messages arrive
  useEffect(() => {
    if (!selectedChannel) return;
    const count = messages.length;
    if (count > prevMessageCountRef.current && !isNearBottom) {
      setShowNewMessages(true);
    }
    prevMessageCountRef.current = count;
  }, [messages.length, isNearBottom, selectedChannel]);

  // Memoized renderItem for FlatList — delegates to React.memo'd ChatMessageItem
  const renderItem = useCallback(({ item: message, index }: { item: ChatMessage; index: number }) => (
    <ChatMessageItem
      message={message}
      index={index}
      messages={messages}
      isDark={isDark}
      theme={theme}
      imageWidth={imageWidth}
      currentMember={currentMember}
      selectedChannel={selectedChannel!}
      isTeacher={isTeacher}
      getMember={getMember}
      onVotePoll={handleVotePoll}
      onReact={handleReaction}
      onRemoveReaction={handleRemoveReaction}
      onLongPress={handleOnLongPress}
      onOpenReactionPicker={handleOpenReactionPicker}
      onReply={handleReply}
      onScrollToIndex={handleScrollToIndex}
      getPollTimeRemaining={getPollTimeRemaining}
    />
  ), [messages, isDark, theme, imageWidth, currentMember, selectedChannel, isTeacher, getMember,
      handleVotePoll, handleReaction, handleRemoveReaction, handleOnLongPress,
      handleOpenReactionPicker, handleReply, handleScrollToIndex, getPollTimeRemaining]);

  const renderChat = () => {
    if (!selectedChannel) return null;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <View className="flex-1" style={{ backgroundColor: isDark ? '#111827' : '#F9FAFB' }}>
          {/* Soft pastel tint overlay */}
          <View
            className="absolute inset-0"
            style={{ backgroundColor: chatBackground }}
            pointerEvents="none"
          />
          {/* Chat Header */}
          <View
            className={cn(
              'flex-row items-center px-4 pb-3 border-b',
              isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
            )}
            style={{ paddingTop: insets.top + 8 }}
          >
            <Pressable
              onPress={() => setSelectedChannel(null)}
              className="w-10 h-10 items-center justify-center -ml-2"
            >
              <ArrowLeft size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: selectedChannel.type === 'halau' ? `${theme.primary}15` : 'rgba(139, 92, 246, 0.15)' }}
            >
              {selectedChannel.type === 'halau' ? (
                <Hash size={20} color={theme.primary} />
              ) : (
                <Users size={20} color="#8B5CF6" />
              )}
            </View>
            <View className="flex-1">
              <Text className={cn('font-semibold text-lg', isDark ? 'text-white' : 'text-gray-900')}>
                {selectedChannel.name}
              </Text>
              <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {selectedChannel.memberIds.length} members
              </Text>
            </View>
            {isTeacher && (
              <Pressable
                onPress={() => setShowChannelOptions(true)}
                className="w-10 h-10 items-center justify-center"
              >
                <MoreVertical size={22} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </Pressable>
            )}
          </View>

          {/* Pinned messages banner */}
          {pinnedMessages.length > 0 && (
            <Pressable
              onPress={() => setShowPinnedMessages(true)}
              className={cn(
                'flex-row items-center justify-between px-4 py-2 border-b',
                isDark ? 'bg-amber-900/20 border-amber-900/40' : 'bg-amber-50 border-amber-100'
              )}
            >
              <View className="flex-row items-center">
                <Pin size={12} color="#F59E0B" fill="#F59E0B" />
                <Text className={cn('ml-1.5 text-xs font-semibold', isDark ? 'text-amber-400' : 'text-amber-700')}>
                  {pinnedMessages.length} pinned {pinnedMessages.length === 1 ? 'message' : 'messages'}
                </Text>
              </View>
              <Text className={cn('text-xs', isDark ? 'text-amber-500/70' : 'text-amber-500')}>View all</Text>
            </Pressable>
          )}

          {/* Messages */}
          <View className="flex-1">
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              onContentSizeChange={() => {
                if (isNearBottom) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }}
              onScroll={handleChatScroll}
              scrollEventThrottle={50}
              renderItem={renderItem}
              ListEmptyComponent={() => (
                <View className="items-center py-12">
                  <Hash size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
                  <Text className={cn('mt-4 text-center', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    No messages yet. Start the conversation!
                  </Text>
                </View>
              )}
            />
            {/* New messages FAB */}
            {showNewMessages && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                className="absolute bottom-2 self-center"
                style={{ alignSelf: 'center' }}
              >
                <Pressable
                  onPress={scrollToBottom}
                  className="flex-row items-center px-4 py-2 rounded-full"
                  style={{ backgroundColor: theme.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 }}
                >
                  <Text className="text-white text-xs font-semibold">New messages ↓</Text>
                </Pressable>
              </Animated.View>
            )}
          </View>

          {/* Mention Picker */}
          {showMentionPicker && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              className={cn('mx-4 mb-2 rounded-xl overflow-hidden border max-h-48', isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}
            >
              <ScrollView>
                {members
                  .filter((m) =>
                    `${m.firstName} ${m.lastName}`.toLowerCase().includes(mentionQuery) ||
                    m.firstName.toLowerCase().includes(mentionQuery)
                  )
                  .slice(0, 5)
                  .map((member) => (
                    <Pressable
                      key={member.id}
                      onPress={() => handleInsertMention(member)}
                      className={cn('flex-row items-center px-4 py-3 border-b', isDark ? 'border-gray-700 active:bg-gray-700' : 'border-gray-100 active:bg-gray-50')}
                    >
                      <View className={cn('w-8 h-8 rounded-full items-center justify-center mr-3', member.role === 'teacher' ? 'bg-amber-500' : '')}>
                        <Text className="text-white text-sm font-bold">{member.firstName[0]?.toUpperCase()}</Text>
                      </View>
                      <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                        {member.firstName} {member.lastName}
                      </Text>
                    </Pressable>
                  ))}
                {members.filter((m) => `${m.firstName} ${m.lastName}`.toLowerCase().includes(mentionQuery)).length === 0 && (
                  <View className="px-4 py-3">
                    <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>No members found</Text>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          )}

          {/* Pending Attachment Preview */}
          {pendingAttachment ? (
            <View className={cn('mx-4 mb-2 rounded-xl overflow-hidden border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200')}>
              <View className="flex-row items-center p-3">
                {pendingAttachment.type === 'image' ? (
                  <Image source={{ uri: pendingAttachment.uri }} style={{ width: ms(50), height: ms(50), borderRadius: ms(8) }} />
                ) : (
                  <View
                  className="w-12 h-12 rounded-lg items-center justify-center"
                  style={{ backgroundColor: `${theme.primary}15` }}
                >
                    <File size={24} color={theme.primary} />
                  </View>
                )}
                <View className="flex-1 ml-3">
                  <Text className={cn('text-sm', isDark ? 'text-white' : 'text-gray-900')} numberOfLines={1}>
                    {pendingAttachment.name && pendingAttachment.name.trim() ? pendingAttachment.name : (pendingAttachment.type === 'image' ? 'Image' : 'File')}
                  </Text>
                </View>
                <Pressable onPress={() => setPendingAttachment(null)} className="w-8 h-8 items-center justify-center">
                  <X size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Private Mode Indicator */}
          {isPrivateMode && privateRecipients.length > 0 && (
            <View className={cn('mx-4 mb-2 p-3 rounded-xl flex-row items-center', isDark ? 'bg-purple-500/20' : 'bg-purple-100')}>
              <Lock size={16} color="#8B5CF6" />
              <Text className="text-purple-600 ml-2 flex-1 text-sm">
                Private to {privateRecipients.length} member{privateRecipients.length > 1 ? 's' : ''}
              </Text>
              <Pressable onPress={() => { setIsPrivateMode(false); setPrivateRecipients([]); }}>
                <X size={18} color="#8B5CF6" />
              </Pressable>
            </View>
          )}

          {/* Reply Indicator */}
          {replyToMessage && (
            <View className={cn('mx-4 mb-2 p-3 rounded-xl flex-row items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
              <CornerUpLeft size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <View className="flex-1 ml-2">
                <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Replying to {getMember(replyToMessage.senderId)?.firstName || 'Unknown'}
                </Text>
                <Text className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')} numberOfLines={1}>
                  {replyToMessage.text || (replyToMessage.attachment ? '📎 Attachment' : 'Message')}
                </Text>
              </View>
              <Pressable onPress={() => setReplyToMessage(null)}>
                <X size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </Pressable>
            </View>
          )}

          {/* Message Input */}
          <View
            className={cn(
              'px-3 py-2 border-t',
              isDark ? 'bg-black border-gray-800' : 'bg-white border-gray-200'
            )}
            style={{ paddingBottom: Math.max(insets.bottom, 8) }}
          >
            <View
              className={cn(
                'flex-row items-center rounded-full px-1',
                isDark ? 'bg-gray-800' : 'bg-gray-100',
                isPrivateMode && 'border-2 border-purple-500'
              )}
            >
              {/* Plus button for attachment menu */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAttachmentMenu(true);
                }}
                className="w-8 h-8 items-center justify-center"
              >
                <Plus size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </Pressable>
              <TextInput
                ref={inputRef}
                className={cn('flex-1 text-[13px]', isDark ? 'text-white' : 'text-gray-900')}
                style={{
                  minHeight: 36,
                  paddingVertical: 8,
                  textAlignVertical: 'center',
                  textAlign: 'left',
                }}
                placeholder={isPrivateMode ? "Type a private message..." : "Type a message..."}
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={messageText}
                onChangeText={handleTextChange}
                onSelectionChange={(e) => setCursorPosition(e.nativeEvent.selection.end)}
                multiline
                maxLength={1000}
                cursorColor={isDark ? '#FFFFFF' : '#000000'}
                selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
              />
              {/* Send button */}
              <Pressable
                onPress={handleSendMessage}
                disabled={!messageText.trim() && !pendingAttachment}
                className="w-8 h-8 rounded-full items-center justify-center ml-1"
                style={{ backgroundColor: (messageText.trim() || pendingAttachment) ? theme.primary : isDark ? '#374151' : '#E5E7EB' }}
              >
                <Send
                  size={16}
                  color={(messageText.trim() || pendingAttachment) ? 'white' : isDark ? '#6B7280' : '#9CA3AF'}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Channel Options Modal */}
        <Modal visible={showChannelOptions} transparent animationType="fade">
          <Pressable
            className="flex-1 bg-black/50 justify-end"
            onPress={() => setShowChannelOptions(false)}
          >
            <View className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')} style={{ paddingBottom: insets.bottom + 16 }}>
              <View className="w-10 h-1 bg-gray-300 rounded-full self-center my-4" />
              <Pressable
                onPress={() => {
                  setNewChannelName(selectedChannel?.name || '');
                  setShowRenameModal(true);
                }}
                className="flex-row items-center px-6 py-4"
              >
                <Edit2 size={22} color={theme.primary} />
                <Text className={cn('ml-4 text-base font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                  Rename Channel
                </Text>
              </Pressable>
              {/* Only show Manage Members for non-halau channels */}
              {selectedChannel?.type !== 'halau' && (
                <Pressable
                  onPress={() => {
                    setSelectedMemberIds(selectedChannel?.memberIds || []);
                    setShowMemberPicker(true);
                    setShowChannelOptions(false);
                  }}
                  className="flex-row items-center px-6 py-4"
                >
                  <UserPlus size={22} color="#8B5CF6" />
                  <Text className={cn('ml-4 text-base font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                    Manage Members
                  </Text>
                </Pressable>
              )}
              {/* Hide delete for General (halau-type) channels */}
              {selectedChannel?.type !== 'halau' && (
                <Pressable
                  onPress={handleDeleteChannel}
                  className="flex-row items-center px-6 py-4"
                >
                  <Trash2 size={22} color="#EF4444" />
                  <Text className="ml-4 text-base font-medium text-red-500">
                    Delete Channel
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => setShowChannelOptions(false)}
                className="flex-row items-center justify-center py-4 mt-2"
              >
                <Text className={cn('text-base font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Rename Modal */}
        <Modal visible={showRenameModal} transparent animationType="fade">
          <View className="flex-1 bg-black/50 justify-center items-center px-8">
            <View className={cn('w-full rounded-2xl p-6', isDark ? 'bg-gray-900' : 'bg-white')}>
              <Text className={cn('text-lg font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
                Rename Channel
              </Text>
              <TextInput
                className={cn('px-4 py-3 rounded-xl text-base mb-4', isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900')}
                placeholder="Channel name"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                value={newChannelName}
                onChangeText={setNewChannelName}
                autoFocus
                cursorColor={isDark ? '#FFFFFF' : '#000000'}
                selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setShowRenameModal(false);
                    setShowChannelOptions(false);
                  }}
                  className={cn('flex-1 py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                >
                  <Text className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleRenameChannel}
                  disabled={!newChannelName.trim()}
                  className={cn('flex-1 py-3 rounded-xl items-center', newChannelName.trim() ? '' : 'bg-gray-300')}
                >
                  <Text className={cn('font-medium', newChannelName.trim() ? 'text-white' : 'text-gray-500')}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete Message Modal */}
        <Modal visible={!!selectedMessageForDelete} transparent animationType="fade">
          <Pressable
            className="flex-1 bg-black/50 justify-end"
            onPress={() => setSelectedMessageForDelete(null)}
          >
            <View className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')} style={{ paddingBottom: insets.bottom + 16 }}>
              <View className="w-10 h-1 bg-gray-300 rounded-full self-center my-4" />
              <View className="px-6 pb-2">
                <Text className={cn('text-lg font-bold mb-1', isDark ? 'text-white' : 'text-gray-900')}>
                  Delete Message
                </Text>
                <Text className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  This will permanently remove this message for everyone.
                </Text>
              </View>
              <Pressable
                onPress={() => selectedMessageForDelete && handleDeleteMessage(selectedMessageForDelete)}
                className="flex-row items-center px-6 py-4"
              >
                <Trash2 size={22} color="#EF4444" />
                <Text className="ml-4 text-base font-medium text-red-500">
                  Delete Message
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedMessageForDelete(null)}
                className="flex-row items-center justify-center py-4 mt-2"
              >
                <Text className={cn('text-base font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Manage Members Modal */}
        <Modal visible={showMemberPicker} animationType="slide" presentationStyle="pageSheet">
          <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-white')}>
            <View
              className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
              style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
            >
              <Pressable onPress={() => setShowMemberPicker(false)}>
                <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </Pressable>
              <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                Manage Members
              </Text>
              <Pressable
                onPress={() => {
                  if (selectedChannel) {
                    updateChannel(selectedChannel.id, { memberIds: selectedMemberIds });
                    setSelectedChannel({ ...selectedChannel, memberIds: selectedMemberIds });
                    setShowMemberPicker(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }}
              >
                <Check size={24} color={theme.primary} />
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 py-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className={cn('text-sm font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Who can see this channel?
                </Text>
                <Pressable
                  onPress={() => {
                    const allMemberIds = members.map((m) => m.id);
                    setSelectedMemberIds(allMemberIds);
                  }}
                >
                  <Text style={{ color: theme.primary }} className="text-sm font-medium">Select All</Text>
                </Pressable>
              </View>
              <View className={cn('rounded-xl overflow-hidden border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                <ScrollView style={{ maxHeight: 400 }} nestedScrollEnabled>
                  {members.map((member) => {
                    const isSelected = selectedMemberIds.includes(member.id);
                    return (
                      <Pressable
                        key={member.id}
                        onPress={() => {
                          setSelectedMemberIds((prev) => {
                            if (isSelected) return prev.filter((id) => id !== member.id);
                            // If this is a keiki, also add their linked guardian
                            const guardianIds = getGuardianIdsForMembers([member.id]);
                            return [...new Set([...prev, member.id, ...guardianIds])];
                          });
                        }}
                        className={cn(
                          'flex-row items-center px-4 py-3 border-b',
                          isDark ? 'border-gray-700' : 'border-gray-100',
                          isSelected && (isDark ? `${theme.primary}30` : `${theme.primary}15`)
                        )}
                      >
                        <View
                          className={cn(
                            'w-10 h-10 rounded-full items-center justify-center mr-3',
                            member.role === 'teacher' ? 'bg-amber-500' : ''
                          )}
                        >
                          <Text className="text-white font-bold">
                            {member.firstName[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                            {member.firstName} {member.lastName}
                          </Text>
                          <Text className={cn('text-xs capitalize', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            {member.role}
                            {member.classLevel
                              ? ` · ${classLevels.find((l) => l.value === member.classLevel || l.id === member.classLevel)?.label ?? member.classLevel}`
                              : ''}
                          </Text>
                        </View>
                        <View
                          className={cn(
                            'w-6 h-6 rounded-full border-2 items-center justify-center',
                            isSelected
                              ? 'border-2'
                              : isDark
                                ? 'border-gray-600'
                                : 'border-gray-300'
                          )}
                          style={isSelected ? { backgroundColor: theme.primary, borderColor: theme.primary } : undefined}
                        >
                          {isSelected && <Check size={14} color="white" />}
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              <Text className={cn('text-xs mt-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
                {selectedMemberIds.length} member{selectedMemberIds.length !== 1 ? 's' : ''} selected
              </Text>
            </ScrollView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  };

  return (
    <>
      {selectedChannel ? renderChat() : renderChannelList()}

      {/* Create Channel Modal - Always rendered so it works from channel list */}
      <Modal visible={showCreateChannelModal} animationType="slide" presentationStyle="pageSheet">
        <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-white')}>
          <View
            className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
            style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
          >
            <Pressable onPress={() => setShowCreateChannelModal(false)}>
              <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              New Channel
            </Text>
            <Pressable
              onPress={() => {
                if (currentHalauId && newChannelNameInput.trim()) {
                  const newChannel = createChannel({
                    halauId: currentHalauId,
                    name: newChannelNameInput.trim(),
                    type: 'group',
                    memberIds: selectedMemberIds,
                  });
                  setShowCreateChannelModal(false);
                  setSelectedChannel(newChannel);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              }}
              disabled={!newChannelNameInput.trim() || selectedMemberIds.length === 0}
              className={cn((!newChannelNameInput.trim() || selectedMemberIds.length === 0) && 'opacity-50')}
            >
              <Check size={24} color={theme.primary} />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 py-4">
            <View className="gap-4">
              {/* Channel Name */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Channel Name
                </Text>
                <TextInput
                  className={cn(
                    'px-4 py-3 rounded-xl text-base',
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                  placeholder="e.g., Performance Updates"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={newChannelNameInput}
                  onChangeText={setNewChannelNameInput}
                  cursorColor={isDark ? '#FFFFFF' : '#000000'}
                  selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                />
              </View>

              {/* Class Level Selection */}
              {classLevels.length > 0 && (
                <View>
                  <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    Add by Class Level
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {classLevels.map((level) => {
                      const isSelected = selectedClassLevelIds.includes(level.id);
                      const memberCount = members.filter(
                        (m) => m.classLevel === level.id || m.classLevel === level.value
                      ).length;
                      return (
                        <Pressable
                          key={level.id}
                          onPress={() => handleToggleClassLevel(level.id)}
                          className={cn(
                            'flex-row items-center px-3 py-2 rounded-lg',
                            !isSelected && (isDark ? 'bg-gray-800' : 'bg-gray-100')
                          )}
                          style={isSelected ? { backgroundColor: theme.primary } : undefined}
                        >
                          <GraduationCap size={16} color={isSelected ? 'white' : theme.primary} />
                          <Text
                            className={cn(
                              'ml-2 font-medium',
                              isSelected ? 'text-white' : isDark ? 'text-white' : 'text-gray-900'
                            )}
                          >
                            {level.label}
                          </Text>
                          <View
                            className={cn(
                              'ml-2 px-1.5 rounded-full',
                              isSelected ? 'bg-white/20' : isDark ? 'bg-gray-700' : 'bg-gray-200'
                            )}
                          >
                            <Text
                              className={cn(
                                'text-xs',
                                isSelected ? 'text-white' : isDark ? 'text-gray-400' : 'text-gray-500'
                              )}
                            >
                              {memberCount}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Member Selection */}
              <View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className={cn('text-sm font-medium', isDark ? 'text-gray-400' : 'text-gray-600')}>
                    {classLevels.length > 0 ? 'Or select individual members' : 'Who can see this channel?'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      const allMemberIds = members.map((m) => m.id);
                      setSelectedMemberIds(allMemberIds);
                    }}
                  >
                    <Text style={{ color: theme.primary }} className="text-sm font-medium">Select All</Text>
                  </Pressable>
                </View>
                <View className={cn('rounded-xl overflow-hidden border', isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                  <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
                    {members.map((member) => {
                      const isSelected = selectedMemberIds.includes(member.id);
                      return (
                        <Pressable
                          key={member.id}
                          onPress={() => {
                            setSelectedMemberIds((prev) => {
                              if (isSelected) return prev.filter((id) => id !== member.id);
                              // If this is a keiki, also add their linked guardian
                              const guardianIds = getGuardianIdsForMembers([member.id]);
                              return [...new Set([...prev, member.id, ...guardianIds])];
                            });
                          }}
                          className={cn(
                            'flex-row items-center px-4 py-3 border-b',
                            isDark ? 'border-gray-700' : 'border-gray-100',
                            isSelected && (isDark ? `${theme.primary}30` : `${theme.primary}15`)
                          )}
                        >
                          <View
                            className={cn(
                              'w-10 h-10 rounded-full items-center justify-center mr-3',
                              member.role === 'teacher' ? 'bg-amber-500' : ''
                            )}
                          >
                            <Text className="text-white font-bold">
                              {member.firstName[0]?.toUpperCase() || '?'}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                              {member.firstName} {member.lastName}
                            </Text>
                            <Text className={cn('text-xs capitalize', isDark ? 'text-gray-500' : 'text-gray-400')}>
                              {member.role}
                              {member.classLevel
                                ? ` · ${classLevels.find((l) => l.value === member.classLevel || l.id === member.classLevel)?.label ?? member.classLevel}`
                                : ''}
                            </Text>
                          </View>
                          <View
                            className={cn(
                              'w-6 h-6 rounded-full border-2 items-center justify-center',
                              isSelected
                                ? 'border-2'
                                : isDark
                                  ? 'border-gray-600'
                                  : 'border-gray-300'
                            )}
                            style={isSelected ? { backgroundColor: theme.primary, borderColor: theme.primary } : undefined}
                          >
                            {isSelected && <Check size={14} color="white" />}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
                <Text className={cn('text-xs mt-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  {selectedMemberIds.length} member{selectedMemberIds.length !== 1 ? 's' : ''} selected
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Emoji Picker Modal */}
      <Modal visible={showEmojiPicker} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowEmojiPicker(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')} style={{ paddingBottom: insets.bottom + 16 }}>
              <View className="w-10 h-1 bg-gray-300 rounded-full self-center my-4" />
              <Text className={cn('text-center text-lg font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
                Choose Emoji
              </Text>
              <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
                <View className="flex-row flex-wrap justify-center gap-2">
                  {ALL_EMOJIS.map((emoji) => (
                    <Pressable
                      key={emoji}
                      onPress={() => handleInsertEmoji(emoji)}
                      className={cn('w-12 h-12 rounded-xl items-center justify-center', isDark ? 'active:bg-gray-800' : 'active:bg-gray-100')}
                    >
                      <Text className="text-2xl">{emoji}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reaction Picker Modal */}
      <Modal visible={showReactionPicker} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => {
            setShowReactionPicker(false);
            setSelectedMessageForReaction(null);
          }}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')} style={{ paddingBottom: insets.bottom + 16 }}>
              <View className="w-10 h-1 bg-gray-300 rounded-full self-center my-4" />
              <Text className={cn('text-center text-lg font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
                React to Message
              </Text>
              {/* Quick Reactions */}
              <View className="flex-row justify-center gap-2 px-4 mb-4">
                {QUICK_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => selectedMessageForReaction && handleReaction(selectedMessageForReaction.id, emoji)}
                    className={cn('w-12 h-12 rounded-full items-center justify-center', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                  >
                    <Text className="text-2xl">{emoji}</Text>
                  </Pressable>
                ))}
              </View>
              {/* More Emojis */}
              <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
                <View className="flex-row flex-wrap justify-center gap-2">
                  {ALL_EMOJIS.filter((e) => !QUICK_EMOJIS.includes(e)).map((emoji) => (
                    <Pressable
                      key={emoji}
                      onPress={() => selectedMessageForReaction && handleReaction(selectedMessageForReaction.id, emoji)}
                      className={cn('w-10 h-10 rounded-lg items-center justify-center', isDark ? 'active:bg-gray-800' : 'active:bg-gray-100')}
                    >
                      <Text className="text-xl">{emoji}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
              {/* Delete Option for Teachers */}
              {isTeacher && selectedMessageForReaction && (
                <>
                  {/* Edit Poll Option - only for poll messages */}
                  {selectedMessageForReaction.poll && (
                    <Pressable
                      onPress={() => handleOpenPollEditor(selectedMessageForReaction)}
                      className={cn('flex-row items-center justify-center py-4 mt-2 border-t', isDark ? 'border-gray-700' : 'border-gray-200')}
                    >
                      <Edit2 size={20} color={theme.primary} />
                      <Text style={{ color: theme.primary }} className="ml-2 font-medium">Edit Poll</Text>
                    </Pressable>
                  )}
                  {/* Pin/Unpin Option */}
                  <Pressable
                    onPress={() => {
                      if (selectedMessageForReaction) {
                        const isPinned = selectedChannel?.pinnedMessageIds?.includes(selectedMessageForReaction.id);
                        if (isPinned) {
                          handleUnpinMessage(selectedMessageForReaction.id);
                        } else {
                          handlePinMessage(selectedMessageForReaction.id);
                        }
                      }
                      setShowReactionPicker(false);
                      setSelectedMessageForReaction(null);
                    }}
                    className={cn('flex-row items-center justify-center py-4 border-t', isDark ? 'border-gray-700' : 'border-gray-200', !selectedMessageForReaction.poll && 'mt-2')}
                  >
                    <Pin size={20} color={theme.primary} />
                    <Text style={{ color: theme.primary }} className="ml-2 font-medium">
                      {selectedChannel?.pinnedMessageIds?.includes(selectedMessageForReaction.id) ? 'Unpin Message' : 'Pin Message'}
                    </Text>
                  </Pressable>
                  {/* Delete Option */}
                  <Pressable
                    onPress={() => {
                      setShowReactionPicker(false);
                      if (selectedMessageForReaction) {
                        handleDeleteMessage(selectedMessageForReaction);
                      }
                    }}
                    className={cn('flex-row items-center justify-center py-4 border-t', isDark ? 'border-gray-700' : 'border-gray-200')}
                  >
                    <Trash2 size={20} color="#EF4444" />
                    <Text className="ml-2 text-red-500 font-medium">Delete Message</Text>
                  </Pressable>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Poll Creator Modal */}
      <Modal visible={showPollCreator} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#FFFFFF' }}
        >
          <View
            className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
            style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
          >
            <Pressable onPress={() => setShowPollCreator(false)}>
              <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Create Poll
            </Text>
            <Pressable
              onPress={handleSendPoll}
              disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}
              className={cn((!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2) && 'opacity-50')}
            >
              <Check size={24} color={theme.primary} />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 py-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
            <View className="gap-4">
              {/* Poll Question */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Question
                </Text>
                <TextInput
                  className={cn(
                    'px-4 py-3 rounded-xl text-base',
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                  placeholder="Ask a question..."
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                  multiline
                  cursorColor={isDark ? '#FFFFFF' : '#000000'}
                  selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                />
              </View>

              {/* Poll Options */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Options
                </Text>
                {pollOptions.map((option, index) => (
                  <View key={index} className="flex-row items-center mb-2">
                    <TextInput
                      className={cn(
                        'flex-1 px-4 py-3 rounded-xl text-base',
                        isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                      )}
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      value={option}
                      onChangeText={(text) => {
                        const newOptions = [...pollOptions];
                        newOptions[index] = text;
                        setPollOptions(newOptions);
                      }}
                      cursorColor={isDark ? '#FFFFFF' : '#000000'}
                      selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                    />
                    {pollOptions.length > 2 && (
                      <Pressable
                        onPress={() => {
                          const newOptions = pollOptions.filter((_, i) => i !== index);
                          setPollOptions(newOptions);
                        }}
                        className="ml-2 w-10 h-10 items-center justify-center"
                      >
                        <X size={20} color="#EF4444" />
                      </Pressable>
                    )}
                  </View>
                ))}
                {pollOptions.length < 6 && (
                  <Pressable
                    onPress={() => setPollOptions([...pollOptions, ''])}
                    className={cn('flex-row items-center justify-center py-3 rounded-xl mt-2', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                  >
                    <Plus size={20} color={theme.primary} />
                    <Text style={{ color: theme.primary }} className="ml-2 font-medium">Add Option</Text>
                  </Pressable>
                )}
              </View>

              {/* Poll Duration */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Poll Duration
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { value: '1h' as const, label: '1 Hour' },
                    { value: '24h' as const, label: '24 Hours' },
                    { value: '3d' as const, label: '3 Days' },
                    { value: '7d' as const, label: '7 Days' },
                    { value: 'none' as const, label: 'No Limit' },
                  ].map((duration) => (
                    <Pressable
                      key={duration.value}
                      onPress={() => setPollDuration(duration.value)}
                      className={cn(
                        'px-4 py-2 rounded-full',
                        pollDuration === duration.value
                          ? ''
                          : isDark
                            ? 'bg-gray-800'
                            : 'bg-gray-100'
                      )}
                      style={pollDuration === duration.value ? { backgroundColor: theme.primary } : undefined}
                    >
                      <Text
                        className={cn(
                          'font-medium',
                          pollDuration === duration.value
                            ? 'text-white'
                            : isDark
                              ? 'text-gray-300'
                              : 'text-gray-600'
                        )}
                      >
                        {duration.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={showAttachmentMenu} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowAttachmentMenu(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeInDown.duration(200)}
              className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')}
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <View className="w-10 h-1 bg-gray-300 rounded-full self-center my-4" />
              <Text className={cn('text-center text-lg font-bold mb-4', isDark ? 'text-white' : 'text-gray-900')}>
                Add to Chat
              </Text>

              {/* Attachment Options Grid */}
              <View className="flex-row flex-wrap justify-center px-6 gap-4 pb-4">
                {/* Photo */}
                <Pressable
                  onPress={() => {
                    setShowAttachmentMenu(false);
                    handlePickImage();
                  }}
                  className="items-center w-20"
                >
                  <View className={cn('w-14 h-14 rounded-full items-center justify-center mb-2', isDark ? 'bg-blue-500/20' : 'bg-blue-100')}>
                    <ImageIcon size={26} color="#3B82F6" />
                  </View>
                  <Text className={cn('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>Photo</Text>
                </Pressable>

                {/* Poll - Only for teachers */}
                {isTeacher && (
                  <Pressable
                    onPress={() => {
                      setShowAttachmentMenu(false);
                      setShowPollCreator(true);
                    }}
                    className="items-center w-20"
                  >
                    <View
                      className="w-14 h-14 rounded-full items-center justify-center mb-2"
                      style={{ backgroundColor: `${theme.primary}20` }}
                    >
                      <BarChart3 size={26} color={theme.primary} />
                    </View>
                    <Text className={cn('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>Poll</Text>
                  </Pressable>
                )}

                {/* File */}
                <Pressable
                  onPress={() => {
                    setShowAttachmentMenu(false);
                    handlePickFile();
                  }}
                  className="items-center w-20"
                >
                  <View className={cn('w-14 h-14 rounded-full items-center justify-center mb-2', isDark ? 'bg-amber-500/20' : 'bg-amber-100')}>
                    <Paperclip size={26} color="#F59E0B" />
                  </View>
                  <Text className={cn('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>File</Text>
                </Pressable>

                {/* Camera */}
                <Pressable
                  onPress={() => {
                    setShowAttachmentMenu(false);
                    handleTakePhoto();
                  }}
                  className="items-center w-20"
                >
                  <View className={cn('w-14 h-14 rounded-full items-center justify-center mb-2', isDark ? 'bg-rose-500/20' : 'bg-rose-100')}>
                    <Camera size={26} color="#F43F5E" />
                  </View>
                  <Text className={cn('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>Camera</Text>
                </Pressable>

                {/* Emoji */}
                <Pressable
                  onPress={() => {
                    setShowAttachmentMenu(false);
                    setShowEmojiPicker(true);
                  }}
                  className="items-center w-20"
                >
                  <View className={cn('w-14 h-14 rounded-full items-center justify-center mb-2', isDark ? 'bg-purple-500/20' : 'bg-purple-100')}>
                    <Smile size={26} color="#8B5CF6" />
                  </View>
                  <Text className={cn('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>Emoji</Text>
                </Pressable>

                {/* Private message */}
                <Pressable
                  onPress={() => {
                    setShowAttachmentMenu(false);
                    setShowPrivateRecipientPicker(true);
                  }}
                  className="items-center w-20"
                >
                  <View className={cn('w-14 h-14 rounded-full items-center justify-center mb-2', isPrivateMode ? '' : isDark ? 'bg-green-500/20' : 'bg-green-100')}
                    style={isPrivateMode ? { backgroundColor: `${theme.primary}30` } : undefined}
                  >
                    <Lock size={26} color={isPrivateMode ? theme.primary : '#10B981'} />
                  </View>
                  <Text className={cn('text-xs font-medium', isDark ? 'text-gray-300' : 'text-gray-700')}>
                    {isPrivateMode ? 'Private On' : 'Private'}
                  </Text>
                </Pressable>
              </View>

              {/* Cancel Button */}
              <Pressable
                onPress={() => setShowAttachmentMenu(false)}
                className="flex-row items-center justify-center py-4 mt-2"
              >
                <Text className={cn('text-base font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Cancel
                </Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Pinned Messages Modal */}
      <Modal visible={showPinnedMessages} transparent animationType="slide">
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowPinnedMessages(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')}
              style={{ paddingBottom: insets.bottom + 16, maxHeight: '70%' }}
            >
              <View className="w-10 h-1 bg-gray-300 rounded-full self-center my-4" />
              <View className="flex-row items-center justify-between px-5 mb-4">
                <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                  Pinned Messages
                </Text>
                <Pressable onPress={() => setShowPinnedMessages(false)}>
                  <X size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </Pressable>
              </View>
              <ScrollView className="px-5">
                {pinnedMessages.length === 0 ? (
                  <View className="items-center py-8">
                    <Pin size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
                    <Text className={cn('mt-4 text-center', isDark ? 'text-gray-400' : 'text-gray-500')}>
                      No pinned messages
                    </Text>
                  </View>
                ) : (
                  pinnedMessages.map((message) => {
                    const sender = getMember(message.senderId);
                    return (
                      <View
                        key={message.id}
                        className={cn('p-4 rounded-xl mb-3', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                      >
                        <View className="flex-row items-center justify-between mb-2">
                          <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                            {sender?.firstName || 'Unknown'} {sender?.lastName || ''}
                          </Text>
                          {isTeacher && (
                            <Pressable
                              onPress={() => handleUnpinMessage(message.id)}
                              className="p-1"
                            >
                              <X size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                            </Pressable>
                          )}
                        </View>
                        <Text className={cn(isDark ? 'text-gray-300' : 'text-gray-700')}>
                          {message.text || (message.attachment ? '📎 Attachment' : message.poll ? '📊 Poll' : '')}
                        </Text>
                        <Text className={cn('text-xs mt-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          {format(parseISO(message.sentAt), 'MMM d, h:mm a')}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Private Message Recipient Picker Modal */}
      <Modal visible={showPrivateRecipientPicker} transparent animationType="slide">
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowPrivateRecipientPicker(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={{ maxHeight: '80%' }}>
            <View
              className={cn('rounded-t-3xl', isDark ? 'bg-gray-900' : 'bg-white')}
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <View className="w-10 h-1 bg-gray-300 rounded-full self-center my-4" />
              <View className="flex-row items-center justify-between px-5 mb-1">
                <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                  {selectedChannel ? 'Send Private Message' : 'New Private Message'}
                </Text>
                <Pressable
                  onPress={() => {
                    if (privateRecipients.length > 0) {
                      if (selectedChannel) {
                        // In a channel - enable private mode for next message
                        setIsPrivateMode(true);
                        setShowPrivateRecipientPicker(false);
                      } else {
                        // On channel list - find or create direct channel (supports multiple recipients)
                        if (currentHalauId) {
                          const allMemberIds = [currentMember?.id || '', ...privateRecipients];

                          // For a single recipient, check for existing direct channel
                          if (privateRecipients.length === 1) {
                            const existingChannel = channels.find(c =>
                              c.type === 'direct' &&
                              c.memberIds.length === 2 &&
                              c.memberIds.includes(privateRecipients[0]) &&
                              c.memberIds.includes(currentMember?.id || '')
                            );
                            if (existingChannel) {
                              setSelectedChannel(existingChannel);
                              setPrivateRecipients([]);
                              setShowPrivateRecipientPicker(false);
                              return;
                            }
                          }

                          // For multiple recipients, check for existing group direct channel with same members
                          if (privateRecipients.length > 1) {
                            const existingChannel = channels.find(c =>
                              c.type === 'direct' &&
                              c.memberIds.length === allMemberIds.length &&
                              allMemberIds.every(id => c.memberIds.includes(id))
                            );
                            if (existingChannel) {
                              setSelectedChannel(existingChannel);
                              setPrivateRecipients([]);
                              setShowPrivateRecipientPicker(false);
                              return;
                            }
                          }

                          // Build a name from recipient first names
                          const recipientNames = privateRecipients
                            .map(id => members.find(m => m.id === id))
                            .filter(Boolean)
                            .map(m => m!.firstName);
                          const channelName = recipientNames.length > 2
                            ? `${recipientNames.slice(0, 2).join(', ')} +${recipientNames.length - 2}`
                            : recipientNames.join(', ');

                          const newChannel = createChannel({
                            halauId: currentHalauId,
                            name: channelName,
                            type: 'direct',
                            memberIds: allMemberIds,
                          });
                          setSelectedChannel(newChannel);
                          setPrivateRecipients([]);
                          setShowPrivateRecipientPicker(false);
                        }
                      }
                    }
                  }}
                >
                  <Text
                    style={{ color: privateRecipients.length > 0 ? theme.primary : isDark ? '#6B7280' : '#9CA3AF' }}
                    className="font-semibold"
                  >
                    {selectedChannel ? 'Done' : 'Start'}
                  </Text>
                </Pressable>
              </View>
              <Text className={cn('px-5 text-sm mb-3', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {selectedChannel
                  ? 'Only you and the selected members will see this message'
                  : privateRecipients.length > 0
                    ? `${privateRecipients.length} selected — tap more to add`
                    : 'Select one or more people to message'}
              </Text>
              <ScrollView className="px-5" style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
                {members
                  .filter((m) => m.id !== currentMember?.id)
                  .map((member) => {
                    const isSelected = privateRecipients.includes(member.id);
                    return (
                      <Pressable
                        key={member.id}
                        onPress={() => {
                          // Always multi-select
                          setPrivateRecipients((prev) =>
                            isSelected
                              ? prev.filter((id) => id !== member.id)
                              : [...prev, member.id]
                          );
                        }}
                        className={cn(
                          'flex-row items-center p-3 rounded-xl mb-2',
                          isSelected ? '' : isDark ? 'bg-gray-800' : 'bg-gray-100'
                        )}
                        style={isSelected ? { backgroundColor: `${theme.primary}20` } : undefined}
                      >
                        <View
                          className={cn(
                            'w-10 h-10 rounded-full items-center justify-center mr-3',
                            member.role === 'teacher' ? 'bg-amber-500' : 'bg-gray-400'
                          )}
                        >
                          <Text className="text-white font-bold">
                            {member.firstName[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className={cn('font-medium', isDark ? 'text-white' : 'text-gray-900')}>
                            {member.firstName} {member.lastName}
                          </Text>
                          <Text className={cn('text-xs capitalize', isDark ? 'text-gray-500' : 'text-gray-400')}>
                            {member.role}
                          </Text>
                        </View>
                        <View
                          className={cn(
                            'w-6 h-6 rounded-full border-2 items-center justify-center',
                            isSelected ? '' : isDark ? 'border-gray-600' : 'border-gray-300'
                          )}
                          style={isSelected ? { backgroundColor: theme.primary, borderColor: theme.primary } : undefined}
                        >
                          {isSelected && <Check size={14} color="white" />}
                        </View>
                      </Pressable>
                    );
                  })}
              </ScrollView>
              <View className="px-5 mt-4">
                <Pressable
                  onPress={() => {
                    setPrivateRecipients([]);
                    setIsPrivateMode(false);
                    setShowPrivateRecipientPicker(false);
                  }}
                  className={cn('py-3 rounded-xl items-center', isDark ? 'bg-gray-800' : 'bg-gray-200')}
                >
                  <Text className={cn('font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Poll Modal */}
      <Modal visible={showPollEditor} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: isDark ? '#000000' : '#FFFFFF' }}
        >
          <View
            className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
            style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
          >
            <Pressable onPress={() => { setShowPollEditor(false); setEditingPollMessage(null); }}>
              <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Edit Poll
            </Text>
            <Pressable
              onPress={handleSaveEditedPoll}
              disabled={!editPollQuestion.trim() || editPollOptions.filter((o) => o.trim()).length < 2}
              className={cn((!editPollQuestion.trim() || editPollOptions.filter((o) => o.trim()).length < 2) && 'opacity-50')}
            >
              <Check size={24} color={theme.primary} />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 py-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
            <View className="gap-4">
              {/* Poll Question */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Question
                </Text>
                <TextInput
                  className={cn(
                    'px-4 py-3 rounded-xl text-base',
                    isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                  )}
                  placeholder="Ask a question..."
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={editPollQuestion}
                  onChangeText={setEditPollQuestion}
                  multiline
                  cursorColor={isDark ? '#FFFFFF' : '#000000'}
                  selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                />
              </View>

              {/* Poll Options */}
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Options
                </Text>
                {editPollOptions.map((option, index) => (
                  <View key={index} className="flex-row items-center mb-2">
                    <TextInput
                      className={cn(
                        'flex-1 px-4 py-3 rounded-xl text-base',
                        isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
                      )}
                      placeholder={`Option ${index + 1}`}
                      placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                      value={option}
                      onChangeText={(text) => {
                        const newOptions = [...editPollOptions];
                        newOptions[index] = text;
                        setEditPollOptions(newOptions);
                      }}
                      cursorColor={isDark ? '#FFFFFF' : '#000000'}
                      selectionColor={isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'}
                    />
                    {editPollOptions.length > 2 && (
                      <Pressable
                        onPress={() => {
                          const newOptions = editPollOptions.filter((_, i) => i !== index);
                          setEditPollOptions(newOptions);
                        }}
                        className="ml-2 w-10 h-10 items-center justify-center"
                      >
                        <X size={20} color="#EF4444" />
                      </Pressable>
                    )}
                  </View>
                ))}
                {editPollOptions.length < 6 && (
                  <Pressable
                    onPress={() => setEditPollOptions([...editPollOptions, ''])}
                    className={cn('flex-row items-center justify-center py-3 rounded-xl mt-2', isDark ? 'bg-gray-800' : 'bg-gray-100')}
                  >
                    <Plus size={20} color={theme.primary} />
                    <Text style={{ color: theme.primary }} className="ml-2 font-medium">Add Option</Text>
                  </Pressable>
                )}
              </View>

              {/* Note about existing votes */}
              <View className={cn('p-3 rounded-xl', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                <Text className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Options that match existing options exactly will keep their votes. Changed or new options will start with 0 votes.
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

export default function ChatScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const currentMember = useDeepMemo(useAppStore((s) => s.currentMember));
  const members = useAppStore((s) => s.members);
  const getKeikiByGuardian = useAppStore((s) => s.getKeikiByGuardian);

  // Determine access: guardians and students without class level get the gate
  const isGuardian = currentMember?.role === 'guardian';
  const isStudent = currentMember?.role === 'student';
  const hasClassLevel = !!(currentMember?.classLevel && currentMember.classLevel !== '');
  const myKeiki = isGuardian && currentMember ? getKeikiByGuardian(currentMember.id) : [];
  const hasKeikiAssigned = myKeiki.some((k) => k.classLevel && k.classLevel !== '' && k.classLevel !== 'minor');
  const isRestricted = (isStudent && !hasClassLevel) || (isGuardian && !hasKeikiAssigned);

  if (isRestricted) {
    return (
      <View
        className={cn('flex-1 items-center justify-center px-8', isDark ? 'bg-black' : 'bg-gray-50')}
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View
          className={cn('w-20 h-20 rounded-full items-center justify-center mb-6', isDark ? 'bg-gray-800' : 'bg-gray-100')}
        >
          <MessageCircle size={36} color={isDark ? '#4B5563' : '#9CA3AF'} />
        </View>
        <Text className={cn('text-xl font-bold text-center mb-3', isDark ? 'text-white' : 'text-gray-900')}>
          Access Required
        </Text>
        <Text className={cn('text-sm text-center leading-6 mb-6', isDark ? 'text-gray-400' : 'text-gray-500')}>
          Access to Chat requires authorization from your admin, owner, or teacher.
        </Text>
        <View className={cn('w-full p-4 rounded-2xl', isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-100')}>
          <Text className={cn('text-xs text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>
            Please contact your admin, owner, or teacher to request access to this section.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ChatContent />
    </ErrorBoundary>
  );
}
