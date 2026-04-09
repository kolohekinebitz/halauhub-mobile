/**
 * ChatMessageItem.tsx
 *
 * Memoized wrapper for a single chat message row in the FlatList.
 * Extracted from chat.tsx renderItem so React.memo can bail out
 * when unrelated Zustand state (typing indicators, channel list,
 * input text, etc.) changes — preventing full-list re-renders.
 *
 * Equality: React.memo uses shallow prop comparison. All callbacks
 * must be stable (useCallback) at the call site to get the benefit.
 */

import React from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import {
  format,
  parseISO,
  isToday,
  isYesterday,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  isSameDay,
} from 'date-fns';
import {
  BarChart3,
  Check,
  Clock,
  CornerUpLeft,
  File,
  Lock,
  Pin,
  Smile,
  Trophy,
} from 'lucide-react-native';
import { cn } from '@/lib/cn';
import { s, ms } from '@/lib/scaling';
import type { ChatChannel, ChatMessage, MessageReaction, PollOption } from '@/lib/types';
import type { ThemeColors } from '@/lib/themes';
import type { Member } from '@/lib/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ChatMessageItemProps {
  /** The message to render. */
  message: ChatMessage;
  /** Position inside the FlatList data array. */
  index: number;
  /** Full messages array — needed for date separator and reply-count logic. */
  messages: ChatMessage[];
  /** Dark mode flag. */
  isDark: boolean;
  /** Active halau theme. */
  theme: ThemeColors;
  /** Width in px for inline images (pre-calculated by parent). */
  imageWidth: number;
  /** Currently signed-in member (null when loading). */
  currentMember: Member | null;
  /** The active channel (non-null when this list is visible). */
  selectedChannel: ChatChannel;
  /** Whether the current user has teacher/instructor role. */
  isTeacher: boolean;
  /** Resolve a member by id. Stable reference from store selector. */
  getMember: (id: string) => Member | undefined;

  // ── Callbacks (must be stable useCallback refs at the call site) ──────────
  onVotePoll: (messageId: string, optionId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
  onLongPress: (message: ChatMessage) => void;
  onOpenReactionPicker: (message: ChatMessage) => void;
  onReply: (message: ChatMessage) => void;
  onScrollToIndex: (index: number) => void;
  getPollTimeRemaining: (expiresAt: string) => string;
}

// ─── Pure helpers (module-level — never recreated) ────────────────────────────

function getDateSeparatorText(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d, yyyy');
}

function formatInlineTime(dateStr: string): string {
  return format(parseISO(dateStr), 'h:mm a');
}

function renderMessageText(
  text: string,
  isOwnMessage: boolean,
): React.ReactNode[] {
  const parts = text.split(/(@[\w\s]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <Text
          key={`mention-${i}-${part}`}
          className={cn('font-bold', isOwnMessage ? 'text-white' : '')}
        >
          {part}
        </Text>
      );
    }
    return <Text key={`text-${i}-${part}`}>{part}</Text>;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

function ChatMessageItemInner({
  message,
  index,
  messages,
  isDark,
  theme,
  imageWidth,
  currentMember,
  selectedChannel,
  isTeacher,
  getMember,
  onVotePoll,
  onReact,
  onRemoveReaction,
  onLongPress,
  onOpenReactionPicker,
  onReply,
  onScrollToIndex,
  getPollTimeRemaining,
}: ChatMessageItemProps) {
  const sender = getMember(message.senderId);
  const isOwnMessage = message.senderId === currentMember?.id;
  const isPinned = selectedChannel.pinnedMessageIds?.includes(message.id);

  // Date separator
  const currentDate = parseISO(message.sentAt);
  const prevMessage = index > 0 ? messages[index - 1] : null;
  const showDateSeparator =
    !prevMessage || !isSameDay(currentDate, parseISO(prevMessage.sentAt));

  // Poll helpers
  const isPollExpired = message.poll?.expiresAt
    ? new Date(message.poll.expiresAt) < new Date()
    : false;
  const totalVotes =
    message.poll?.options.reduce(
      (sum: number, opt: PollOption) => sum + opt.votes.length,
      0,
    ) ?? 0;
  const hasVoted =
    message.poll?.options.some((opt: PollOption) =>
      opt.votes.includes(currentMember?.id ?? ''),
    ) ?? false;

  const getVoterNames = (votes: string[]) =>
    votes.map((voterId) => {
      const voter = getMember(voterId);
      return voter ? voter.firstName : 'Unknown';
    });

  // Reply thread
  const replyCount = messages.filter(
    (m) => m.replyToMessageId === message.id,
  ).length;
  const replyToMsg = message.replyToMessageId
    ? messages.find((m) => m.id === message.replyToMessageId)
    : null;

  return (
    <View>
      {/* ── Date Separator ─────────────────────────────────────────────── */}
      {showDateSeparator && (
        <View className="flex-row items-center justify-center my-4">
          <View
            className={cn('flex-1 h-px', isDark ? 'bg-gray-700' : 'bg-gray-200')}
          />
          <View
            className={cn(
              'px-3 py-1 rounded-full mx-3',
              isDark ? 'bg-gray-800' : 'bg-gray-100',
            )}
          >
            <Text
              className={cn(
                'text-xs font-medium',
                isDark ? 'text-gray-400' : 'text-gray-500',
              )}
            >
              {getDateSeparatorText(currentDate)}
            </Text>
          </View>
          <View
            className={cn('flex-1 h-px', isDark ? 'bg-gray-700' : 'bg-gray-200')}
          />
        </View>
      )}

      <View className={cn('mb-2', isOwnMessage ? 'items-end' : 'items-start')}>
        {/* ── Private indicator ──────────────────────────────────────────── */}
        {message.isPrivate && (
          <View className="flex-row items-center mb-1">
            <Lock size={10} color="#7C3AED" />
            <Text
              className="text-[10px] font-medium ml-1"
              style={{ color: '#7C3AED' }}
            >
              Private
            </Text>
          </View>
        )}

        {/* ── Pinned indicator ───────────────────────────────────────────── */}
        {isPinned && (
          <View className="flex-row items-center mb-1">
            <Pin size={10} color={theme.primary} />
            <Text
              className="text-[10px] font-medium ml-1"
              style={{ color: theme.primary }}
            >
              Pinned
            </Text>
          </View>
        )}

        {/* ── Sender name + timestamp ────────────────────────────────────── */}
        {!message.poll && (
          <View
            className={cn(
              'flex-row items-center mb-0.5',
              isOwnMessage ? 'mr-1' : 'ml-9',
            )}
          >
            {selectedChannel.type !== 'direct' && (
              <Text
                className="text-xs font-medium mr-1.5"
                style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
              >
                {sender?.firstName ?? 'Unknown'}
              </Text>
            )}
            {selectedChannel.type === 'direct' && !isOwnMessage && (
              <Text
                className="text-[10px] font-medium mr-1.5"
                style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
              >
                {sender?.firstName ?? 'Unknown'}
              </Text>
            )}
            <Text
              className="text-[10px]"
              style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
            >
              {formatInlineTime(message.sentAt)}
            </Text>
          </View>
        )}

        {/* ── Sender name above poll ─────────────────────────────────────── */}
        {message.poll && selectedChannel.type !== 'direct' && (
          <View className="mb-1">
            <Text
              className="text-xs font-medium"
              style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}
            >
              {sender?.firstName ?? 'Unknown'}
            </Text>
          </View>
        )}

        {/* ════════════════════════════════════════════════════════════════
            POLL BUBBLE
        ════════════════════════════════════════════════════════════════ */}
        {message.poll ? (
          <View style={{ width: '75%' }}>
            <Pressable
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onOpenReactionPicker(message);
              }}
              delayLongPress={300}
            >
              <View
                className={cn(
                  'rounded-xl overflow-hidden p-3',
                  isDark ? 'bg-gray-800' : 'bg-white',
                )}
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isDark ? 0.6 : 0.25,
                  shadowRadius: 8,
                  elevation: isDark ? 8 : 6,
                }}
              >
                {/* Poll header */}
                <View className="flex-row items-center mb-2">
                  {isPollExpired ? (
                    <Trophy size={16} color="#F59E0B" fill="#F59E0B" />
                  ) : (
                    <BarChart3 size={16} color={theme.primary} />
                  )}
                  <Text
                    className={cn(
                      'ml-2 text-xs font-medium',
                      isPollExpired
                        ? 'text-amber-500'
                        : isDark
                        ? 'text-gray-400'
                        : 'text-gray-500',
                    )}
                  >
                    {isPollExpired
                      ? 'Poll Ended'
                      : hasVoted
                      ? 'Poll · Voted'
                      : 'Poll'}
                  </Text>
                  {message.poll.expiresAt && !isPollExpired && (
                    <View className="flex-row items-center ml-auto">
                      <Clock size={10} color="#6B7280" />
                      <Text
                        className={cn(
                          'ml-1 text-[10px]',
                          isDark ? 'text-gray-500' : 'text-gray-400',
                        )}
                      >
                        {getPollTimeRemaining(message.poll.expiresAt)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Poll question */}
                <Text
                  className={cn(
                    'text-sm font-semibold mb-1',
                    isDark ? 'text-white' : 'text-gray-900',
                  )}
                >
                  {message.poll.question}
                </Text>
                {hasVoted && !isPollExpired && (
                  <Text
                    className={cn(
                      'text-[10px] mb-3',
                      isDark ? 'text-gray-500' : 'text-gray-400',
                    )}
                  >
                    Tap an option to change your vote
                  </Text>
                )}
                {!hasVoted && !isPollExpired && <View className="mb-3" />}

                {/* Poll options */}
                {(() => {
                  const maxVotes = Math.max(
                    ...message.poll!.options.map(
                      (o: PollOption) => o.votes.length,
                    ),
                  );
                  const winningOptions =
                    isPollExpired && maxVotes > 0
                      ? message.poll!.options.filter(
                          (o: PollOption) => o.votes.length === maxVotes,
                        )
                      : [];
                  const isTie = winningOptions.length > 1;

                  return message.poll!.options.map((option: PollOption) => {
                    const voteCount = option.votes.length;
                    const percentage =
                      totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                    const hasVotedThis = option.votes.includes(
                      currentMember?.id ?? '',
                    );
                    const voterNames = getVoterNames(option.votes);
                    const canVote = !isPollExpired;
                    const isWinner =
                      isPollExpired &&
                      maxVotes > 0 &&
                      option.votes.length === maxVotes;

                    return (
                      <View key={option.id} className="mb-2">
                        <Pressable
                          onPress={() => {
                            if (canVote) onVotePoll(message.id, option.id);
                          }}
                          className={cn(
                            'rounded-lg overflow-hidden',
                            hasVotedThis
                              ? 'border-2'
                              : isDark
                              ? 'border border-gray-700'
                              : 'border border-gray-200',
                            canVote && 'active:opacity-70',
                          )}
                          style={
                            hasVotedThis
                              ? { borderColor: theme.primary }
                              : undefined
                          }
                        >
                          <View className="relative">
                            {(hasVoted || isPollExpired) && (
                              <View
                                className="absolute inset-0"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: hasVotedThis
                                    ? `${theme.primary}30`
                                    : isDark
                                    ? 'rgba(75, 85, 99, 0.5)'
                                    : 'rgba(243, 244, 246, 1)',
                                }}
                              />
                            )}
                            <View className="flex-row items-center justify-between px-3 py-2">
                              <View className="flex-row items-center flex-1">
                                {isWinner && (
                                  <Text className="mr-1.5 text-base">
                                    {isTie ? '😰' : '🥇'}
                                  </Text>
                                )}
                                <Text
                                  className={cn(
                                    'flex-1 text-sm',
                                    isDark ? 'text-white' : 'text-gray-900',
                                  )}
                                >
                                  {option.text}
                                </Text>
                              </View>
                              <View className="flex-row items-center gap-1.5">
                                {hasVotedThis && !isPollExpired && (
                                  <View
                                    className="w-4 h-4 rounded-full items-center justify-center"
                                    style={{ backgroundColor: theme.primary }}
                                  >
                                    <Check size={10} color="#FFFFFF" />
                                  </View>
                                )}
                                {(hasVoted || isPollExpired) && (
                                  <Text
                                    className={cn(
                                      'text-xs font-medium',
                                      hasVotedThis
                                        ? ''
                                        : isDark
                                        ? 'text-gray-400'
                                        : 'text-gray-500',
                                    )}
                                    style={
                                      hasVotedThis
                                        ? { color: theme.primary }
                                        : undefined
                                    }
                                  >
                                    {Math.round(percentage)}%
                                  </Text>
                                )}
                              </View>
                            </View>
                          </View>
                        </Pressable>

                        {/* Voter names */}
                        {voterNames.length > 0 && (
                          <Pressable
                            onPress={() => {
                              if (voterNames.length > 3) {
                                Alert.alert(
                                  `Voted for "${option.text}"`,
                                  voterNames.join(', '),
                                  [{ text: 'OK' }],
                                );
                              }
                            }}
                            className="flex-row flex-wrap mt-1.5 ml-1 gap-1"
                          >
                            <View className="flex-row items-center mr-1">
                              <Text
                                className={cn(
                                  'text-[10px]',
                                  isDark ? 'text-gray-500' : 'text-gray-400',
                                )}
                              >
                                {voterNames.slice(0, 3).join(', ')}
                                {voterNames.length > 3
                                  ? ` +${voterNames.length - 3}`
                                  : ''}
                              </Text>
                            </View>
                          </Pressable>
                        )}
                      </View>
                    );
                  });
                })()}
              </View>
            </Pressable>
          </View>
        ) : (
          /* ══════════════════════════════════════════════════════════════
             REGULAR MESSAGE BUBBLE
          ══════════════════════════════════════════════════════════════ */
          <View style={{ maxWidth: '75%' }}>
            {/* Reply context */}
            {replyToMsg && (
              <Pressable className={cn('mb-1', isOwnMessage ? 'items-end' : 'items-start ml-9')}>
                <View className="flex-row items-end">
                  {!isOwnMessage && (
                    <View className="mr-1" style={{ width: ms(20), height: ms(30) }}>
                      <View
                        style={{
                          position: 'absolute',
                          left: ms(8),
                          top: 0,
                          width: ms(12),
                          height: ms(24),
                          borderLeftWidth: 2,
                          borderBottomWidth: 2,
                          borderColor: isDark ? '#4B5563' : '#D1D5DB',
                          borderBottomLeftRadius: 10,
                        }}
                      />
                    </View>
                  )}
                  <View
                    className={cn('px-3 py-1.5 rounded-2xl', isDark ? 'bg-gray-700/60' : 'bg-gray-200/80')}
                    style={{ maxWidth: '85%' }}
                  >
                    <Text
                      className={cn('text-[12px]', isDark ? 'text-gray-300' : 'text-gray-600')}
                      numberOfLines={1}
                    >
                      {replyToMsg.text ??
                        (replyToMsg.attachment
                          ? '📎 Attachment'
                          : replyToMsg.poll
                          ? '📊 Poll'
                          : 'Message')}
                    </Text>
                  </View>
                  {isOwnMessage && (
                    <View className="ml-1" style={{ width: ms(20), height: ms(30) }}>
                      <View
                        style={{
                          position: 'absolute',
                          right: ms(8),
                          top: 0,
                          width: ms(12),
                          height: ms(24),
                          borderRightWidth: 2,
                          borderBottomWidth: 2,
                          borderColor: isDark ? '#4B5563' : '#D1D5DB',
                          borderBottomRightRadius: 10,
                        }}
                      />
                    </View>
                  )}
                </View>
              </Pressable>
            )}

            {/* Bubble */}
            <Pressable
              onLongPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onOpenReactionPicker(message);
              }}
              onPress={() => {
                if (isTeacher) onLongPress(message);
              }}
              delayLongPress={300}
            >
              <View
                className={cn(
                  'rounded-2xl overflow-hidden',
                  isOwnMessage ? 'rounded-br-sm' : 'rounded-bl-sm',
                  message.isPrivate && 'border border-purple-500',
                )}
                style={[
                  {
                    backgroundColor: isOwnMessage
                      ? isDark ? '#374151' : '#E5E7EB'
                      : isDark ? '#1F2937' : '#F3F4F6',
                    width: '100%',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: isDark ? 0.6 : 0.3,
                    shadowRadius: 8,
                    elevation: isDark ? 8 : 6,
                  },
                ]}
              >
                {/* Attachment */}
                {message.attachment ? (
                  <View>
                    {message.attachment.type === 'image' ? (
                      <View
                        className="overflow-hidden items-center justify-center"
                        style={{
                          width: imageWidth,
                          height: imageWidth * 0.75,
                          backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                        }}
                      >
                        <Image
                          source={{ uri: message.attachment.uri }}
                          style={{ width: imageWidth, height: imageWidth * 0.75 }}
                          contentFit="cover"
                        />
                      </View>
                    ) : (
                      <View className="flex-row items-center p-3 gap-2">
                        <File size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        <Text
                          className={cn('text-sm flex-1', isDark ? 'text-gray-300' : 'text-gray-700')}
                          numberOfLines={1}
                        >
                          {message.attachment.name ?? 'File'}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : null}

                {/* Text */}
                {message.text ? (
                  <View className={cn('px-3 py-2', message.attachment && 'pt-1')}>
                    <Text
                      className="text-[13px] leading-5"
                      style={{
                        color: isDark ? '#F9FAFB' : '#111827',
                        fontWeight: '400',
                      }}
                    >
                      {renderMessageText(message.text, isOwnMessage)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>

            {/* Quick action buttons */}
            <View className={cn('flex-row mt-1 gap-2', isOwnMessage ? 'justify-end' : 'justify-start')}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onOpenReactionPicker(message);
                }}
                className={cn('flex-row items-center px-2 py-1 rounded-full', isDark ? 'bg-gray-800' : 'bg-gray-100')}
              >
                <Smile size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <Text className={cn('text-xs ml-1', isDark ? 'text-gray-400' : 'text-gray-500')}>React</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onReply(message);
                }}
                className={cn('flex-row items-center px-2 py-1 rounded-full', isDark ? 'bg-gray-800' : 'bg-gray-100')}
              >
                <CornerUpLeft size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <Text className={cn('text-xs ml-1', isDark ? 'text-gray-400' : 'text-gray-500')}>Reply</Text>
              </Pressable>
            </View>

            {/* Reactions — max 3 visible, rest collapsed */}
            {message.reactions && message.reactions.length > 0 && (() => {
              const shownReactions = message.reactions.slice(0, 3);
              const hiddenReactions = message.reactions.slice(3);
              const hiddenCount = hiddenReactions.reduce(
                (sum: number, r: MessageReaction) => sum + r.memberIds.length,
                0,
              );
              return (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  className={cn('flex-row flex-wrap mt-1 gap-1', isOwnMessage ? 'justify-end' : 'justify-start ml-0')}
                >
                  {shownReactions.map((reaction: MessageReaction) => {
                    const hasReacted = reaction.memberIds.includes(currentMember?.id ?? '');
                    return (
                      <Pressable
                        key={reaction.emoji}
                        onPress={() => {
                          if (hasReacted) {
                            onRemoveReaction(message.id, reaction.emoji);
                          } else {
                            onReact(message.id, reaction.emoji);
                          }
                        }}
                        className={cn(
                          'flex-row items-center px-2 py-1 rounded-full',
                          hasReacted ? 'border' : isDark ? 'bg-gray-700' : 'bg-gray-100',
                        )}
                        style={
                          hasReacted
                            ? { backgroundColor: `${theme.primary}30`, borderColor: theme.primary }
                            : undefined
                        }
                      >
                        <Text className="text-sm">{reaction.emoji}</Text>
                        <Text className={cn('text-xs ml-1', hasReacted ? '' : isDark ? 'text-gray-400' : 'text-gray-500')}
                          style={hasReacted ? { color: theme.primary } : undefined}
                        >
                          {reaction.memberIds.length}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {hiddenReactions.length > 0 && (
                    <Pressable
                      onPress={() => onOpenReactionPicker(message)}
                      className={cn('flex-row items-center px-2 py-1 rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-100')}
                    >
                      <Text className={cn('text-xs font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                        +{hiddenCount}
                      </Text>
                    </Pressable>
                  )}
                </Animated.View>
              );
            })()}

            {/* Reply count */}
            {replyCount > 0 && (
              <Pressable
                onPress={() => {
                  const firstReplyIndex = messages.findIndex(
                    (m) => m.replyToMessageId === message.id,
                  );
                  if (firstReplyIndex >= 0) {
                    onScrollToIndex(firstReplyIndex);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                className={cn('mt-1', isOwnMessage ? 'items-end' : 'items-start')}
              >
                <Text style={{ color: theme.primary }} className="text-[12px] font-medium">
                  {replyCount} {replyCount === 1 ? 'Reply' : 'Replies'}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * React.memo-wrapped export.
 * FlatList will skip re-rendering a row unless its specific message data
 * or a directly-passed callback reference has changed.
 */
export const ChatMessageItem = React.memo(ChatMessageItemInner);
