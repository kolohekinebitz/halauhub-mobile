import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/lib/useColorScheme';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { Video as VideoIcon, Plus, X, Check, Play, Search, Folder, Trash2, Calendar, Lock } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { format, parseISO } from 'date-fns';
import type { Video } from '@/lib/types';
import * as Haptics from 'expo-haptics';
import { WebView } from 'react-native-webview';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME, type ThemeColors } from '@/lib/themes';
import { s, ms, screenWidth } from '@/lib/scaling';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const isWeb = Platform.OS === 'web';

const CARD_WIDTH = (screenWidth - s(48)) / 2;

type Category = 'all' | Video['category'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const isYouTubeUrl = (url: string): boolean =>
  url.includes('youtube.com') || url.includes('youtu.be') || url.includes('youtube-nocookie.com');

const getYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  const vMatch = url.match(/\/v\/([a-zA-Z0-9_-]{11})/);
  if (vMatch) return vMatch[1];
  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  return null;
};

const getYouTubeThumbnail = (url: string): string | null => {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
};

// ── Top-level sub-components (stable types — no inner-component re-mounting) ─

const WebYouTubePlayer = ({ videoId }: { videoId: string }) => (
  <View style={{ width: '100%', height: 300, backgroundColor: '#000' }}>
    {/* @ts-ignore — iframe is web-only */}
    <iframe
      src={`https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1&fs=1`}
      style={{ width: '100%', height: '100%', border: 'none' }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
      allowFullScreen
    />
  </View>
);

interface VideoPlayerModalProps {
  video: Video;
  onClose: () => void;
  isTeacher: boolean;
  onDelete: (id: string) => void;
  isDark: boolean;
}

const VideoPlayerModal = ({ video, onClose, isTeacher, onDelete, isDark }: VideoPlayerModalProps) => {
  const insets = useSafeAreaInsets();
  const isYouTube = isYouTubeUrl(video.url);
  const youtubeVideoId = isYouTube ? getYouTubeVideoId(video.url) : null;

  const [nativeStatus, setNativeStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [webViewError, setWebViewError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // useVideoPlayer requires a stable URI or null — pass null for YouTube (WebView handles it)
  const player = useVideoPlayer(isYouTube ? null : (video.url || null), (p) => {
    p.loop = false;
  });

  // Release player resources on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      try { player?.release?.(); } catch { /* no-op */ }
    };
  }, [player]);

  // Track native player status
  useEffect(() => {
    if (isYouTube || !player) return;
    const sub = player.addListener('statusChange', (status) => {
      if (status.status === 'readyToPlay') setNativeStatus('ready');
      else if (status.status === 'error') {
        console.error('[VideoPlayer] native player error:', status.error);
        setNativeStatus('error');
      }
    });
    return () => sub.remove();
  }, [player, isYouTube]);

  const youtubeEmbedUrl = youtubeVideoId
    ? `https://www.youtube-nocookie.com/embed/${youtubeVideoId}?playsinline=1&rel=0&modestbranding=1&fs=1&autoplay=0`
    : '';

  const handleRetry = () => {
    setNativeStatus('loading');
    setWebViewError(false);
    setRetryKey((k) => k + 1);
  };

  return (
    <View className="flex-1 bg-black">
      <View style={{ paddingTop: insets.top }} className="flex-row items-center justify-between px-4 py-2">
        <Pressable onPress={onClose} className="w-10 h-10 items-center justify-center">
          <X size={24} color="white" />
        </Pressable>
        <Text className="text-white font-semibold flex-1 text-center" numberOfLines={1}>
          {video.title}
        </Text>
        {isTeacher ? (
          <Pressable onPress={() => onDelete(video.id)} className="w-10 h-10 items-center justify-center">
            <Trash2 size={22} color="#EF4444" />
          </Pressable>
        ) : (
          <View className="w-10" />
        )}
      </View>

      <View className="flex-1 justify-center">
        {isYouTube && youtubeVideoId ? (
          isWeb ? (
            <WebYouTubePlayer videoId={youtubeVideoId} />
          ) : webViewError ? (
            <View className="items-center justify-center" style={{ height: 300 }}>
              <Text className="text-white/60 text-sm mb-4">Couldn't load video</Text>
              <Pressable onPress={handleRetry} className="px-5 py-2.5 rounded-full bg-white/20">
                <Text className="text-white font-semibold">Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ height: 300 }}>
              <WebView
                key={retryKey}
                source={{ uri: youtubeEmbedUrl }}
                style={{ width: '100%', height: 300, backgroundColor: '#000' }}
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                renderLoading={() => (
                  <View className="absolute inset-0 items-center justify-center bg-black">
                    <ActivityIndicator color="white" />
                  </View>
                )}
                originWhitelist={['https://www.youtube-nocookie.com', 'https://www.youtube.com']}
                mixedContentMode="always"
                allowsLinkPreview={false}
                bounces={false}
                scrollEnabled={false}
                userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
                onError={(e) => {
                  console.error('[VideoPlayer] WebView error:', e.nativeEvent);
                  setWebViewError(true);
                }}
                onHttpError={(e) => {
                  console.error('[VideoPlayer] WebView HTTP error:', e.nativeEvent.statusCode, e.nativeEvent.url);
                  if (e.nativeEvent.statusCode >= 400) setWebViewError(true);
                }}
              />
            </View>
          )
        ) : nativeStatus === 'error' ? (
          <View className="items-center justify-center" style={{ height: 300 }}>
            <Text className="text-white/60 text-sm mb-4">Couldn't load video</Text>
            <Pressable onPress={handleRetry} className="px-5 py-2.5 rounded-full bg-white/20">
              <Text className="text-white font-semibold">Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ height: 300 }}>
            {nativeStatus === 'loading' && (
              <View className="absolute inset-0 items-center justify-center z-10">
                <ActivityIndicator color="white" />
              </View>
            )}
            <VideoView
              key={retryKey}
              player={player}
              style={{ width: '100%', height: 300 }}
              allowsFullscreen
              allowsPictureInPicture
            />
          </View>
        )}
      </View>

      <View style={{ paddingBottom: insets.bottom + 16 }} className="px-4 pb-8">
        <Text className="text-white text-lg font-bold">{video.title}</Text>
        {video.description && (
          <Text className="text-gray-400 mt-2">{video.description}</Text>
        )}
        <Text className="text-gray-500 text-sm mt-2">
          Uploaded {format(parseISO(video.uploadedAt), 'MMMM d, yyyy')}
        </Text>
      </View>
    </View>
  );
};

interface VideoCardProps {
  video: Video;
  index: number;
  isDark: boolean;
  getMember: (id: string) => import('@/lib/types').Member | undefined;
  onPress: () => void;
}

const VideoCard = ({ video, index, isDark, getMember, onPress }: VideoCardProps) => {
  const uploader = getMember(video.uploadedBy);
  const thumbnailUrl = video.thumbnail || getYouTubeThumbnail(video.url);

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(400)} style={{ width: CARD_WIDTH }}>
      <Pressable
        onPress={onPress}
        className={cn('rounded-2xl overflow-hidden mb-4 active:opacity-80', isDark ? 'bg-gray-800' : 'bg-white')}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: isDark ? 0.4 : 0.1,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <View className="aspect-video bg-gray-900 items-center justify-center">
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <VideoIcon size={32} color="#6B7280" />
          )}
          <View className="absolute inset-0 items-center justify-center">
            <View className="w-12 h-12 bg-black/50 rounded-full items-center justify-center">
              <Play size={24} color="white" fill="white" />
            </View>
          </View>
          <View className="absolute top-2 left-2">
            <View
              className={cn(
                'px-2 py-0.5 rounded-full',
                video.category === 'practice' && 'bg-blue-500',
                video.category === 'performance' && 'bg-purple-500',
                video.category === 'technique' && 'bg-green-500',
                video.category === 'other' && 'bg-gray-500'
              )}
            >
              <Text className="text-xs font-medium text-white capitalize">{video.category}</Text>
            </View>
          </View>
        </View>

        <View className="p-3">
          <Text className={cn('font-semibold', isDark ? 'text-white' : 'text-gray-900')} numberOfLines={2}>
            {video.title}
          </Text>
          <Text className={cn('text-xs mt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
            {uploader?.firstName || 'Unknown'} • {format(parseISO(video.uploadedAt), 'MMM d, yyyy')}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

// ── Main screen ───────────────────────────────────────────────────────────────

function VideosScreenInner() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Form state
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoCategory, setVideoCategory] = useState<Video['category']>('practice');
  const [videoDateText, setVideoDateText] = useState('');
  const [accessClassLevels, setAccessClassLevels] = useState<string[]>([]);
  const [isSavingVideo, setIsSavingVideo] = useState(false);

  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const getVideosByHalau = useAppStore((s) => s.getVideosByHalau);
  const addVideo = useAppStore((s) => s.addVideo);
  const deleteVideo = useAppStore((s) => s.deleteVideo);
  const isKumu = useAppStore((s) => s.isKumu);
  const getMember = useAppStore((s) => s.getMember);
  const getHalau = useAppStore((s) => s.getHalau);
  const getClassLevelsForHalau = useAppStore((s) => s.getClassLevelsForHalau);
  const currentMember = useAppStore((s) => s.currentMember);
  const getKeikiByGuardian = useAppStore((s) => s.getKeikiByGuardian);
  const halaus = useAppStore((s) => s.halaus);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;
  const classLevels = currentHalauId ? getClassLevelsForHalau(currentHalauId) : [];

  const theme: ThemeColors = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  const videos = currentHalauId ? getVideosByHalau(currentHalauId) : [];
  const isTeacher = isKumu();

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
        <View className={cn('w-20 h-20 rounded-full items-center justify-center mb-6', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
          <Lock size={36} color={isDark ? '#4B5563' : '#9CA3AF'} />
        </View>
        <Text className={cn('text-xl font-bold text-center mb-3', isDark ? 'text-white' : 'text-gray-900')}>
          Access Required
        </Text>
        <Text className={cn('text-sm text-center leading-6 mb-6', isDark ? 'text-gray-400' : 'text-gray-500')}>
          Access to Videos requires authorization from your admin, owner, or teacher.
        </Text>
        <View className={cn('w-full p-4 rounded-2xl', isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-100')}>
          <Text className={cn('text-xs text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>
            Please contact your admin, owner, or teacher to request access to this section.
          </Text>
        </View>
      </View>
    );
  }

  const filteredVideos = videos.filter((v) => {
    const matchesCategory = selectedCategory === 'all' || v.category === selectedCategory;
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClassLevel =
      !v.accessClassLevels ||
      v.accessClassLevels.length === 0 ||
      isTeacher ||
      (currentMember?.classLevel &&
        v.accessClassLevels.some(
          (id) =>
            id === currentMember.classLevel ||
            classLevels.find((l) => l.id === id)?.value === currentMember.classLevel
        ));
    return matchesCategory && matchesSearch && matchesClassLevel;
  });

  const categories: { key: Category; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'practice', label: 'Practice' },
    { key: 'performance', label: 'Performance' },
    { key: 'technique', label: 'Technique' },
    { key: 'other', label: 'Other' },
  ];

  const handleAddVideo = async () => {
    if (!videoTitle.trim() || !videoUrl.trim() || !currentHalauId) return;

    let parsedVideoDate: string | undefined;
    if (videoDateText.length === 10) {
      const parts = videoDateText.split('/');
      const mm = parts[0];
      const dd = parts[1];
      const yyyy = parts[2];
      if (mm && dd && yyyy && yyyy.length === 4) {
        parsedVideoDate = `${yyyy}-${mm}-${dd}`;
      }
    }

    setIsSavingVideo(true);
    try {
      await addVideo({
        halauId: currentHalauId,
        title: videoTitle.trim(),
        description: videoDescription.trim() || undefined,
        url: videoUrl.trim(),
        category: videoCategory,
        accessRoles: ['teacher', 'student'],
        videoDate: parsedVideoDate,
        accessClassLevels: accessClassLevels.length > 0 ? accessClassLevels : undefined,
      });

      setVideoTitle('');
      setVideoDescription('');
      setVideoUrl('');
      setVideoCategory('practice');
      setVideoDateText('');
      setAccessClassLevels([]);
      setShowAddModal(false);
    } catch (err) {
      Alert.alert(
        'Could not save video',
        err instanceof Error ? err.message : 'Please check your connection and try again.'
      );
    } finally {
      setIsSavingVideo(false);
    }
  };

  const handleDateInput = (text: string) => {
    const digits = text.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length >= 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length >= 4) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
    setVideoDateText(formatted);
  };

  const handleDeleteVideo = (videoId: string) => {
    Alert.alert(
      'Delete Video',
      'Are you sure you want to delete this video? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteVideo(videoId);
            setSelectedVideo(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  return (
    <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-gray-50')}>
      {/* Header */}
      <View
        className={cn('px-5 pb-4', isDark ? 'bg-black' : 'bg-white')}
        style={{ paddingTop: insets.top + 12 }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text className={cn('text-2xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
            Videos
          </Text>
          {isTeacher && (
            <Pressable
              onPress={() => setShowAddModal(true)}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{
                backgroundColor: theme.primary,
                shadowColor: theme.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.6 : 0.35,
                shadowRadius: 16,
                elevation: 12,
              }}
            >
              <Plus size={24} color="white" />
            </Pressable>
          )}
        </View>

        {/* Search */}
        <View
          className={cn('flex-row items-center rounded-xl px-4 py-2.5', isDark ? 'bg-gray-800' : 'bg-gray-100')}
        >
          <Search size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
          <TextInput
            className={cn('flex-1 ml-3 text-base', isDark ? 'text-white' : 'text-gray-900')}
            placeholder="Search videos..."
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <X size={18} color={isDark ? '#6B7280' : '#9CA3AF'} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category Filter */}
      <View className={cn('border-b', isDark ? 'border-gray-800 bg-black' : 'border-gray-100 bg-white')}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
          style={{ flexGrow: 0 }}
        >
          {categories.map((cat) => (
            <Pressable
              key={cat.key}
              onPress={() => setSelectedCategory(cat.key)}
              className={cn(
                'px-4 py-2 rounded-full',
                selectedCategory === cat.key
                  ? ''
                  : isDark
                  ? 'bg-gray-800'
                  : 'bg-gray-100'
              )}
              style={selectedCategory === cat.key ? { backgroundColor: theme.primary } : undefined}
            >
              <Text
                className={cn(
                  'font-medium',
                  selectedCategory === cat.key
                    ? 'text-white'
                    : isDark
                    ? 'text-gray-300'
                    : 'text-gray-600'
                )}
              >
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Video Grid */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, paddingTop: 16 }}>
        {filteredVideos.length > 0 ? (
          <View className="flex-row flex-wrap justify-between">
            {filteredVideos.map((video, index) => (
              <VideoCard
                key={video.id}
                video={video}
                index={index}
                isDark={isDark}
                getMember={getMember}
                onPress={() => setSelectedVideo(video)}
              />
            ))}
          </View>
        ) : (
          <View className={cn('rounded-2xl p-8 items-center mt-4', isDark ? 'bg-gray-800/50' : 'bg-gray-100')}>
            <Folder size={48} color={isDark ? '#4B5563' : '#9CA3AF'} />
            <Text className={cn('mt-4 text-center font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
              {searchQuery ? 'No videos match your search' : 'No videos yet'}
            </Text>
            {isTeacher && !searchQuery && (
              <Pressable
                onPress={() => setShowAddModal(true)}
                className="mt-4 px-6 py-2.5 rounded-full"
                style={{ backgroundColor: theme.primary }}
              >
                <Text className="text-white font-medium">Add Video</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      {/* Video Player Modal */}
      <Modal visible={!!selectedVideo} animationType="slide" presentationStyle="fullScreen">
        {selectedVideo && (
          <VideoPlayerModal
            video={selectedVideo}
            onClose={() => setSelectedVideo(null)}
            isTeacher={isTeacher}
            onDelete={handleDeleteVideo}
            isDark={isDark}
          />
        )}
      </Modal>

      {/* Add Video Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-white')}>
          <View
            className={cn('flex-row items-center justify-between px-5 border-b', isDark ? 'border-gray-800' : 'border-gray-200')}
            style={{ paddingTop: insets.top + 12, paddingBottom: 12 }}
          >
            <Pressable onPress={() => setShowAddModal(false)}>
              <X size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
              Add Video
            </Text>
            <Pressable
              onPress={handleAddVideo}
              disabled={!videoTitle.trim() || !videoUrl.trim() || isSavingVideo}
              className={cn((!videoTitle.trim() || !videoUrl.trim() || isSavingVideo) && 'opacity-50')}
            >
              {isSavingVideo
                ? <ActivityIndicator size="small" color={theme.primary} />
                : <Check size={24} color={theme.primary} />}
            </Pressable>
          </View>

          <ScrollView
            className="flex-1 px-5 py-4"
            contentContainerStyle={{ paddingBottom: 120 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="gap-4">
              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Title *
                </Text>
                <TextInput
                  className={cn('px-4 py-3 rounded-xl text-base', isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900')}
                  placeholder="e.g., Basic Hula Steps"
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={videoTitle}
                  onChangeText={setVideoTitle}
                />
              </View>

              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Video URL *
                </Text>
                <TextInput
                  className={cn('px-4 py-3 rounded-xl text-base', isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900')}
                  placeholder="https://..."
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={videoUrl}
                  onChangeText={setVideoUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                />
                <Text className={cn('text-xs mt-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
                  Paste a YouTube link or direct video URL
                </Text>
              </View>

              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Video Date (optional)
                </Text>
                <View className={cn('flex-row items-center px-4 rounded-xl', isDark ? 'bg-gray-800' : 'bg-gray-100')}>
                  <Calendar size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  <TextInput
                    className={cn('flex-1 ml-3 py-3 text-base', isDark ? 'text-white' : 'text-gray-900')}
                    placeholder="MM/DD/YYYY"
                    placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                    value={videoDateText}
                    onChangeText={handleDateInput}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>

              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Category
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {(['practice', 'performance', 'technique', 'other'] as Video['category'][]).map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setVideoCategory(cat)}
                      className={cn('px-4 py-2 rounded-full', videoCategory === cat ? '' : isDark ? 'bg-gray-800' : 'bg-gray-100')}
                      style={videoCategory === cat ? { backgroundColor: theme.primary } : undefined}
                    >
                      <Text
                        className={cn('font-medium capitalize', videoCategory === cat ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600')}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Visible to Class Levels
                </Text>
                <Text className={cn('text-xs mb-3', isDark ? 'text-gray-500' : 'text-gray-500')}>
                  Leave empty to show to all members, or select specific class levels.
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {classLevels.map((level) => {
                    const isSelected = accessClassLevels.includes(level.id);
                    return (
                      <Pressable
                        key={level.id}
                        onPress={() => {
                          setAccessClassLevels((prev) =>
                            prev.includes(level.id)
                              ? prev.filter((id) => id !== level.id)
                              : [...prev, level.id]
                          );
                        }}
                        className={cn(
                          'flex-row items-center px-4 py-2 rounded-full border',
                          isSelected ? '' : isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-200'
                        )}
                        style={isSelected ? { backgroundColor: theme.primary, borderColor: theme.primary } : undefined}
                      >
                        {isSelected && <Check size={14} color="white" style={{ marginRight: 6 }} />}
                        <Text className={cn('font-medium text-sm', isSelected ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-700')}>
                          {level.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {classLevels.length === 0 && (
                    <Text className={cn('text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
                      No class levels configured
                    </Text>
                  )}
                </View>
              </View>

              <View>
                <Text className={cn('text-sm font-medium mb-2', isDark ? 'text-gray-400' : 'text-gray-600')}>
                  Description
                </Text>
                <TextInput
                  className={cn('px-4 py-3 rounded-xl text-base', isDark ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900')}
                  placeholder="Add details about this video..."
                  placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                  value={videoDescription}
                  onChangeText={setVideoDescription}
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 100, textAlignVertical: 'top' }}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export default function VideosScreen() {
  return (
    <ErrorBoundary>
      <VideosScreenInner />
    </ErrorBoundary>
  );
}
