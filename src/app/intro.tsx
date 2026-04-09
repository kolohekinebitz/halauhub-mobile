import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  ZoomIn,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import {
  LayoutDashboard,
  Users,
  Calendar,
  MessageCircle,
  FileCheck,
  CreditCard,
  Baby,
  Clock,
  GraduationCap,
  Video,
  ArrowRight,
  CheckCircle2,
  Leaf,
  Bell,
  Shield,
  Heart,
  Star,
  Zap,
  Target,
  TrendingUp,
  Music,
  Activity,
} from 'lucide-react-native';
import { useAppStore } from '@/lib/store';
import { DEFAULT_THEME } from '@/lib/themes';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Text shadow style for better visibility on bright backgrounds
const textShadowStyle = {
  textShadowColor: 'rgba(0, 0, 0, 0.3)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
};

const textShadowStyleStrong = {
  textShadowColor: 'rgba(0, 0, 0, 0.4)',
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 4,
};

// All intro steps use the same dark-to-Ocean-Mist gradient
// This creates a cohesive visual experience across all welcome pages
interface StepColors {
  gradientColors: readonly [string, string, string, string];
  buttonColor: string;
}

// Single consistent gradient for all steps: dark above black → Ocean Mist
const UNIFIED_COLORS: StepColors = {
  gradientColors: ['#5A9EAD', '#3A6A75', '#1A2A2F', '#0D1517'] as const,
  buttonColor: '#3A7A87', // Ocean Mist accent for buttons
};

type IntroStep =
  | 'welcome'
  | 'features1'
  | 'features2'
  | 'features3'
  | 'personalize_role'
  | 'personalize_frequency'
  | 'personalize_priority'
  | 'ready';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay?: number;
  highlight?: boolean;
}

const FeatureCard = ({ icon, title, description, delay = 0, highlight = false }: FeatureCardProps) => (
  <Animated.View
    entering={FadeInDown.delay(delay).duration(400).springify()}
    className={`flex-row items-center rounded-2xl p-4 mb-3 ${
      highlight ? 'bg-white/25 border border-white/40' : 'bg-white/15'
    }`}
  >
    <View className={`w-12 h-12 rounded-xl items-center justify-center mr-4 ${
      highlight ? 'bg-white/35' : 'bg-white/25'
    }`}>
      {icon}
    </View>
    <View className="flex-1">
      <Text className="text-white font-semibold text-base" style={textShadowStyle}>{title}</Text>
      <Text className="text-white/90 text-sm mt-0.5" style={textShadowStyle}>{description}</Text>
    </View>
  </Animated.View>
);

interface OptionButtonProps {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  selected: boolean;
  onPress: () => void;
  delay?: number;
  buttonColor: string;
}

const OptionButton = ({ label, description, icon, selected, onPress, delay = 0, buttonColor }: OptionButtonProps) => (
  <Animated.View entering={FadeInDown.delay(delay).duration(400).springify()}>
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      className={`flex-row items-center p-4 rounded-2xl mb-3 ${
        selected ? 'bg-white' : 'bg-white/15 border border-white/30'
      }`}
    >
      {icon && (
        <View
          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: selected ? `${buttonColor}25` : 'rgba(255,255,255,0.25)' }}
        >
          {icon}
        </View>
      )}
      <View className="flex-1">
        <Text
          className="font-semibold text-base"
          style={{ color: selected ? buttonColor : 'white' }}
        >
          {label}
        </Text>
        {description && (
          <Text
            className="text-sm mt-0.5"
            style={{ color: selected ? `${buttonColor}99` : 'rgba(255,255,255,0.7)' }}
          >
            {description}
          </Text>
        )}
      </View>
      {selected && <CheckCircle2 size={24} color={buttonColor} />}
    </Pressable>
  </Animated.View>
);

// Mock Phone Screen Component
const MockPhoneScreen = ({ children, label, delay = 0 }: { children: React.ReactNode; label: string; delay?: number }) => (
  <Animated.View
    entering={ZoomIn.delay(delay).duration(500).springify()}
    className="items-center"
  >
    <View className="w-20 h-36 bg-gray-900 rounded-xl overflow-hidden border-2 border-gray-700">
      <View className="h-2 bg-gray-800 items-center justify-center">
        <View className="w-6 h-1 bg-gray-700 rounded-full" />
      </View>
      <View className="flex-1 bg-gray-800 p-1">
        {children}
      </View>
    </View>
    <Text className="text-white/70 text-xs mt-2" style={textShadowStyle}>{label}</Text>
  </Animated.View>
);

// Floating Animation Component
const FloatingElement = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

// Pulsing Ring Component
const PulsingRing = ({ size = 120, delay = 0 }: { size?: number; delay?: number }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(1.3, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: 'rgba(255,255,255,0.3)',
        },
        animatedStyle,
      ]}
    />
  );
};

export default function IntroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<IntroStep>('welcome');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Personalization state
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedFrequency, setSelectedFrequency] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);

  // Animated gradient transition
  const gradientProgress = useSharedValue(0);

  const markIntroSeen = useAppStore((s) => s.markIntroSeen);

  // Use unified colors for all steps - consistent dark-to-Ocean-Mist gradient
  const currentColors = UNIFIED_COLORS;

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const steps: IntroStep[] = [
      'welcome',
      'features1',
      'features2',
      'features3',
      'personalize_role',
      'personalize_frequency',
      'personalize_priority',
      'ready',
    ];

    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const navigateToAuth = () => {
    markIntroSeen();
    router.replace('/auth');
  };

  const handleGetStarted = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsTransitioning(true);
    // Animate gradient transition to app theme colors
    gradientProgress.value = withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }, () => {
      runOnJS(navigateToAuth)();
    });
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsTransitioning(true);
    // Quick transition for skip
    gradientProgress.value = withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }, () => {
      runOnJS(navigateToAuth)();
    });
  };

  const renderProgressDots = () => {
    const steps: IntroStep[] = [
      'welcome',
      'features1',
      'features2',
      'features3',
      'personalize_role',
      'personalize_frequency',
      'personalize_priority',
      'ready',
    ];
    const currentIndex = steps.indexOf(step);

    return (
      <View className="flex-row justify-center mb-6">
        {steps.map((_, index) => (
          <Animated.View
            key={index}
            entering={FadeIn.delay(index * 50)}
            className={`h-2 rounded-full mx-1 ${
              index === currentIndex ? 'bg-white w-6' : 'bg-white/30 w-2'
            }`}
          />
        ))}
      </View>
    );
  };

  // Screen 1: Welcome
  const renderWelcome = () => (
    <Animated.View entering={FadeIn.duration(600)} className="flex-1 justify-center px-6">
      {/* Logo Area with Pulsing Rings */}
      <Animated.View entering={FadeInDown.delay(100).duration(600)} className="items-center mb-8">
        <View className="items-center justify-center" style={{ width: 140, height: 140 }}>
          <PulsingRing size={140} delay={0} />
          <PulsingRing size={140} delay={700} />
          <FloatingElement>
            <View className="w-24 h-24 bg-white/20 rounded-3xl items-center justify-center">
              <Image
                source={require('../../public/icon-only-black.png')}
                style={{ width: 56, height: 56 }}
                resizeMode="contain"
              />
            </View>
          </FloatingElement>
        </View>
        <Animated.Text
          entering={FadeInDown.delay(300).duration(600)}
          className="text-white text-xl font-bold tracking-widest mt-6"
          style={textShadowStyleStrong}
        >
          HalauHub
        </Animated.Text>
      </Animated.View>

      {/* Main Quote */}
      <Animated.Text
        entering={FadeInDown.delay(400).duration(600)}
        className="text-white text-3xl font-bold text-center leading-tight mb-6"
        style={textShadowStyleStrong}
      >
        Where every step has purpose, and every team moves in sync.
      </Animated.Text>

      {/* Subtext */}
      <Animated.Text
        entering={FadeInDown.delay(500).duration(600)}
        className="text-white/90 text-center text-base leading-relaxed mb-8"
        style={textShadowStyle}
      >
        Welcome to HalauHub — your all-in-one dance school management platform. Built for teachers, students, and administrators to keep everything organized, connected, and efficient.
      </Animated.Text>

      {/* Tagline Box */}
      <Animated.View
        entering={FadeInDown.delay(600).duration(600)}
        className="bg-white/15 rounded-2xl p-5 mb-8 border border-white/25"
      >
        <View className="flex-row items-center justify-center mb-2">
          <Star size={16} color="#FEF3C7" />
          <Star size={16} color="#FEF3C7" style={{ marginHorizontal: 4 }} />
          <Star size={16} color="#FEF3C7" />
          <Star size={16} color="#FEF3C7" style={{ marginHorizontal: 4 }} />
          <Star size={16} color="#FEF3C7" />
        </View>
        <Text className="text-white text-center italic text-base" style={textShadowStyle}>
          "Simplify your day. Strengthen your community.{'\n'}Focus on what matters — the dance."
        </Text>
      </Animated.View>

      {/* CTA */}
      <Animated.View entering={FadeInUp.delay(700).duration(600)}>
        <Pressable
          onPress={handleContinue}
          className="bg-white rounded-2xl py-4 flex-row items-center justify-center active:opacity-80"
        >
          <Text style={{ color: currentColors.buttonColor }} className="font-bold text-lg mr-2">Get Started</Text>
          <ArrowRight size={20} color={currentColors.buttonColor} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );

  // Screen 2: Your Studio, Streamlined
  const renderFeatures1 = () => (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} className="flex-1 px-6">
      <Animated.View entering={FadeInDown.delay(50).duration(500)} className="items-center mb-2">
        <View className="bg-white/25 px-4 py-1.5 rounded-full">
          <Text className="text-white text-xs font-medium tracking-wider" style={textShadowStyle}>STUDIO MANAGEMENT</Text>
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(100).duration(500)}
        className="text-white text-2xl font-bold text-center mb-2 mt-2"
        style={textShadowStyleStrong}
      >
        Save time managing,{'\n'}spend more time teaching.
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(150).duration(500)}
        className="text-white/90 text-center mb-5"
        style={textShadowStyle}
      >
        Your entire studio, streamlined in one place.
      </Animated.Text>

      {/* Mock App Screenshots */}
      <Animated.View
        entering={FadeInDown.delay(200).duration(500)}
        className="flex-row justify-center gap-3 mb-5"
      >
        <MockPhoneScreen label="Dashboard" delay={250}>
          <View className="flex-1 p-1">
            <View className="h-3 w-12 bg-amber-300/50 rounded mb-1" />
            <View className="flex-row gap-1 mb-1">
              <View className="flex-1 h-6 bg-amber-300/30 rounded" />
              <View className="flex-1 h-6 bg-yellow-300/30 rounded" />
            </View>
            <View className="h-4 bg-white/10 rounded mb-1" />
            <View className="h-4 bg-white/10 rounded mb-1" />
            <View className="h-4 bg-white/10 rounded" />
          </View>
        </MockPhoneScreen>

        <MockPhoneScreen label="Members" delay={350}>
          <View className="flex-1 p-1">
            <View className="h-2 w-10 bg-white/30 rounded mb-1" />
            {[1, 2, 3, 4].map((i) => (
              <View key={i} className="flex-row items-center mb-1">
                <View className="w-3 h-3 bg-amber-300/50 rounded-full mr-1" />
                <View className="flex-1 h-2 bg-white/20 rounded" />
              </View>
            ))}
          </View>
        </MockPhoneScreen>

        <MockPhoneScreen label="Events" delay={450}>
          <View className="flex-1 p-1">
            <View className="h-2 w-8 bg-white/30 rounded mb-1" />
            <View className="flex-row flex-wrap gap-0.5 mb-1">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <View key={i} className={`w-2 h-2 rounded-sm ${i === 3 ? 'bg-amber-400' : 'bg-white/20'}`} />
              ))}
            </View>
            <View className="h-3 bg-amber-300/30 rounded mb-1" />
            <View className="h-3 bg-yellow-500/30 rounded" />
          </View>
        </MockPhoneScreen>
      </Animated.View>

      {/* Feature Cards */}
      <FeatureCard
        icon={<LayoutDashboard size={24} color="white" />}
        title="Powerful Dashboard"
        description="See members, events, payments & quick actions at a glance"
        delay={300}
        highlight
      />
      <FeatureCard
        icon={<Users size={24} color="white" />}
        title="Smart Member Management"
        description="Automated class assignments, approvals & role management"
        delay={400}
      />
      <FeatureCard
        icon={<Calendar size={24} color="white" />}
        title="Flexible Event Scheduler"
        description="Recurring events, RSVPs & performance planning made easy"
        delay={500}
      />

      {/* Highlight */}
      <Animated.View entering={FadeInDown.delay(600).duration(500)} className="mt-3 mb-5">
        <View className="bg-white/5 rounded-xl p-3 border border-white/10">
          <Text className="text-white/90 text-center italic text-sm" style={textShadowStyle}>
            "Make organization effortless. Run your studio smoothly and confidently."
          </Text>
        </View>
      </Animated.View>

      <Pressable
        onPress={handleContinue}
        className="bg-white rounded-2xl py-4 flex-row items-center justify-center active:opacity-80"
      >
        <Text style={{ color: currentColors.buttonColor }} className="font-bold text-lg mr-2">Next</Text>
        <ArrowRight size={20} color={currentColors.buttonColor} />
      </Pressable>
    </Animated.View>
  );

  // Screen 3: Stay Connected
  const renderFeatures2 = () => (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} className="flex-1 px-6">
      <Animated.View entering={FadeInDown.delay(50).duration(500)} className="items-center mb-2">
        <View className="bg-white/25 px-4 py-1.5 rounded-full">
          <Text className="text-white text-xs font-medium tracking-wider" style={textShadowStyle}>COMMUNICATION</Text>
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(100).duration(500)}
        className="text-white text-2xl font-bold text-center mb-2 mt-2"
        style={textShadowStyleStrong}
      >
        Strong communication builds stronger teams.
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(150).duration(500)}
        className="text-white/90 text-center mb-5"
        style={textShadowStyle}
      >
        Keep your entire community connected and informed.
      </Animated.Text>

      {/* Communication Visual */}
      <Animated.View
        entering={ZoomIn.delay(200).duration(500)}
        className="bg-white/15 rounded-3xl p-4 mb-5 border border-white/25"
      >
        <View className="flex-row items-center justify-around">
          <View className="items-center">
            <View className="w-12 h-12 bg-blue-500/30 rounded-full items-center justify-center mb-2">
              <MessageCircle size={24} color="#60A5FA" />
            </View>
            <Text className="text-white/80 text-xs" style={textShadowStyle}>Chat</Text>
          </View>
          <View className="h-8 w-px bg-white/20" />
          <View className="items-center">
            <View className="w-12 h-12 bg-green-500/30 rounded-full items-center justify-center mb-2">
              <Bell size={24} color="#4ADE80" />
            </View>
            <Text className="text-white/80 text-xs" style={textShadowStyle}>Notify</Text>
          </View>
          <View className="h-8 w-px bg-white/20" />
          <View className="items-center">
            <View className="w-12 h-12 bg-purple-500/30 rounded-full items-center justify-center mb-2">
              <FileCheck size={24} color="#A78BFA" />
            </View>
            <Text className="text-white/80 text-xs" style={textShadowStyle}>Sign</Text>
          </View>
          <View className="h-8 w-px bg-white/20" />
          <View className="items-center">
            <View className="w-12 h-12 bg-teal-500/30 rounded-full items-center justify-center mb-2">
              <CreditCard size={24} color="#5EEAD4" />
            </View>
            <Text className="text-white/80 text-xs" style={textShadowStyle}>Pay</Text>
          </View>
        </View>
      </Animated.View>

      {/* Feature Cards */}
      <FeatureCard
        icon={<MessageCircle size={24} color="white" />}
        title="Real-Time Team Chat"
        description="Channels, @mentions, polls, reactions & file sharing"
        delay={250}
        highlight
      />
      <FeatureCard
        icon={<FileCheck size={24} color="white" />}
        title="Digital Waivers"
        description="Create, sign & store documents securely with tracking"
        delay={350}
      />
      <FeatureCard
        icon={<CreditCard size={24} color="white" />}
        title="Payment Tracking"
        description="Venmo, Zelle, Cash, Check — all transactions organized"
        delay={450}
      />
      <FeatureCard
        icon={<Baby size={24} color="white" />}
        title="Family Management"
        description="Link parents & children (keiki) seamlessly"
        delay={550}
      />

      {/* Highlight */}
      <Animated.View entering={FadeInDown.delay(650).duration(500)} className="mt-3 mb-5">
        <View className="bg-white/5 rounded-xl p-3 border border-white/10">
          <Text className="text-white/90 text-center italic text-sm" style={textShadowStyle}>
            "Everything your studio needs — right where you need it."
          </Text>
        </View>
      </Animated.View>

      <Pressable
        onPress={handleContinue}
        className="bg-white rounded-2xl py-4 flex-row items-center justify-center active:opacity-80"
      >
        <Text style={{ color: currentColors.buttonColor }} className="font-bold text-lg mr-2">Continue</Text>
        <ArrowRight size={20} color={currentColors.buttonColor} />
      </Pressable>
    </Animated.View>
  );

  // Screen 4: Designed for Efficiency
  const renderFeatures3 = () => (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} className="flex-1 px-6">
      <Animated.View entering={FadeInDown.delay(50).duration(500)} className="items-center mb-2">
        <View className="bg-white/25 px-4 py-1.5 rounded-full">
          <Text className="text-white text-xs font-medium tracking-wider" style={textShadowStyle}>EFFICIENCY TOOLS</Text>
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(100).duration(500)}
        className="text-white text-2xl font-bold text-center mb-2 mt-2"
        style={textShadowStyleStrong}
      >
        Less stress. More structure.{'\n'}Better flow.
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(150).duration(500)}
        className="text-white/90 text-center mb-5"
        style={textShadowStyle}
      >
        Powerful tools designed for maximum efficiency.
      </Animated.Text>

      {/* Stats Visual */}
      <Animated.View
        entering={ZoomIn.delay(200).duration(500)}
        className="flex-row justify-around mb-5"
      >
        <View className="items-center bg-white/15 rounded-2xl px-4 py-3">
          <Text className="text-white text-2xl font-bold" style={textShadowStyleStrong}>4+</Text>
          <Text className="text-white/80 text-xs" style={textShadowStyle}>Class Levels</Text>
        </View>
        <View className="items-center bg-white/15 rounded-2xl px-4 py-3">
          <Text className="text-white text-2xl font-bold" style={textShadowStyleStrong}>∞</Text>
          <Text className="text-white/80 text-xs" style={textShadowStyle}>Custom Roles</Text>
        </View>
        <View className="items-center bg-white/15 rounded-2xl px-4 py-3">
          <Text className="text-white text-2xl font-bold" style={textShadowStyleStrong}>24/7</Text>
          <Text className="text-white/80 text-xs" style={textShadowStyle}>Access</Text>
        </View>
      </Animated.View>

      {/* Feature Cards */}
      <FeatureCard
        icon={<GraduationCap size={24} color="white" />}
        title="Class Levels & Notifications"
        description="Minors, Beginner, Intermediate, Advanced + custom levels"
        delay={250}
        highlight
      />
      <FeatureCard
        icon={<Clock size={24} color="white" />}
        title="RSVPs & Attendance"
        description="Track who's coming, mark attendance, view history"
        delay={350}
      />
      <FeatureCard
        icon={<Video size={24} color="white" />}
        title="Video Library"
        description="Organize practice & performance videos by category"
        delay={450}
      />
      <FeatureCard
        icon={<Shield size={24} color="white" />}
        title="Custom Roles & Permissions"
        description="Rename titles, protect owner rights, manage access"
        delay={550}
      />

      {/* Highlight */}
      <Animated.View entering={FadeInDown.delay(650).duration(500)} className="mt-3 mb-5">
        <View className="bg-white/5 rounded-xl p-3 border border-white/10">
          <Text className="text-white/90 text-center italic text-sm" style={textShadowStyle}>
            "Transform chaos into clarity. Manage everything in one hub."
          </Text>
        </View>
      </Animated.View>

      <Pressable
        onPress={handleContinue}
        className="bg-white rounded-2xl py-4 flex-row items-center justify-center active:opacity-80"
      >
        <Text style={{ color: currentColors.buttonColor }} className="font-bold text-lg mr-2">Let's Personalize</Text>
        <ArrowRight size={20} color={currentColors.buttonColor} />
      </Pressable>
    </Animated.View>
  );

  // Screen 5A: Select Your Role
  const renderPersonalizeRole = () => (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} className="flex-1 px-6">
      <Animated.View entering={FadeInDown.delay(50).duration(500)} className="items-center mb-2">
        <View className="bg-white/25 px-4 py-1.5 rounded-full flex-row items-center">
          <Text className="text-white text-xs font-medium tracking-wider" style={textShadowStyle}>STEP 1 OF 3</Text>
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(100).duration(500)}
        className="text-white text-2xl font-bold text-center mb-2 mt-2"
        style={textShadowStyleStrong}
      >
        Let's customize your experience
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(150).duration(500)}
        className="text-white/90 text-center mb-6"
        style={textShadowStyle}
      >
        What best describes your role?
      </Animated.Text>

      <OptionButton
        label="Teacher / Instructor"
        description="Create and manage your school"
        icon={<Music size={20} color={selectedRole === 'teacher' ? currentColors.buttonColor : 'white'} />}
        selected={selectedRole === 'teacher'}
        onPress={() => setSelectedRole('teacher')}
        delay={200}
        buttonColor={currentColors.buttonColor}
      />
      <OptionButton
        label="Student / Dancer"
        description="Join a school and participate"
        icon={<Heart size={20} color={selectedRole === 'student' ? currentColors.buttonColor : 'white'} />}
        selected={selectedRole === 'student'}
        onPress={() => setSelectedRole('student')}
        delay={300}
        buttonColor={currentColors.buttonColor}
      />
      <OptionButton
        label="Administrator"
        description="Help manage school operations"
        icon={<Shield size={20} color={selectedRole === 'admin' ? currentColors.buttonColor : 'white'} />}
        selected={selectedRole === 'admin'}
        onPress={() => setSelectedRole('admin')}
        delay={400}
        buttonColor={currentColors.buttonColor}
      />
      <OptionButton
        label="Parent / Guardian"
        description="Manage your children's participation"
        icon={<Baby size={20} color={selectedRole === 'parent' ? currentColors.buttonColor : 'white'} />}
        selected={selectedRole === 'parent'}
        onPress={() => setSelectedRole('parent')}
        delay={500}
        buttonColor={currentColors.buttonColor}
      />

      <View className="flex-1" />

      <Pressable
        onPress={handleContinue}
        disabled={!selectedRole}
        className={`rounded-2xl py-4 flex-row items-center justify-center mb-4 ${
          selectedRole ? 'bg-white active:opacity-80' : 'bg-white/30'
        }`}
      >
        <Text
          className="font-bold text-lg mr-2"
          style={{ color: selectedRole ? currentColors.buttonColor : 'rgba(255,255,255,0.5)' }}
        >
          Continue
        </Text>
        <ArrowRight size={20} color={selectedRole ? currentColors.buttonColor : 'rgba(255,255,255,0.5)'} />
      </Pressable>
    </Animated.View>
  );

  // Screen 5B: Event Frequency
  const renderPersonalizeFrequency = () => (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} className="flex-1 px-6">
      <Animated.View entering={FadeInDown.delay(50).duration(500)} className="items-center mb-2">
        <View className="bg-white/25 px-4 py-1.5 rounded-full flex-row items-center">
          <Text className="text-white text-xs font-medium tracking-wider" style={textShadowStyle}>STEP 2 OF 3</Text>
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(100).duration(500)}
        className="text-white text-2xl font-bold text-center mb-2 mt-2"
        style={textShadowStyleStrong}
      >
        How often do you practice or meet?
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(150).duration(500)}
        className="text-white/90 text-center mb-6"
        style={textShadowStyle}
      >
        This helps us optimize your calendar and notifications.
      </Animated.Text>

      <OptionButton
        label="Daily"
        description="Practice every day or almost every day"
        icon={<Zap size={20} color={selectedFrequency === 'daily' ? currentColors.buttonColor : 'white'} />}
        selected={selectedFrequency === 'daily'}
        onPress={() => setSelectedFrequency('daily')}
        delay={200}
        buttonColor={currentColors.buttonColor}
      />
      <OptionButton
        label="Weekly"
        description="Once or twice a week"
        icon={<Calendar size={20} color={selectedFrequency === 'weekly' ? currentColors.buttonColor : 'white'} />}
        selected={selectedFrequency === 'weekly'}
        onPress={() => setSelectedFrequency('weekly')}
        delay={300}
        buttonColor={currentColors.buttonColor}
      />
      <OptionButton
        label="Biweekly"
        description="Every other week"
        icon={<Clock size={20} color={selectedFrequency === 'biweekly' ? currentColors.buttonColor : 'white'} />}
        selected={selectedFrequency === 'biweekly'}
        onPress={() => setSelectedFrequency('biweekly')}
        delay={400}
        buttonColor={currentColors.buttonColor}
      />
      <OptionButton
        label="Monthly"
        description="A few times per month or less"
        icon={<Activity size={20} color={selectedFrequency === 'monthly' ? currentColors.buttonColor : 'white'} />}
        selected={selectedFrequency === 'monthly'}
        onPress={() => setSelectedFrequency('monthly')}
        delay={500}
        buttonColor={currentColors.buttonColor}
      />

      <View className="flex-1" />

      <Pressable
        onPress={handleContinue}
        disabled={!selectedFrequency}
        className={`rounded-2xl py-4 flex-row items-center justify-center mb-4 ${
          selectedFrequency ? 'bg-white active:opacity-80' : 'bg-white/30'
        }`}
      >
        <Text
          className="font-bold text-lg mr-2"
          style={{ color: selectedFrequency ? currentColors.buttonColor : 'rgba(255,255,255,0.5)' }}
        >
          Continue
        </Text>
        <ArrowRight size={20} color={selectedFrequency ? currentColors.buttonColor : 'rgba(255,255,255,0.5)'} />
      </Pressable>
    </Animated.View>
  );

  // Screen 5C: Your Priorities
  const renderPersonalizePriority = () => (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} className="flex-1 px-6">
      <Animated.View entering={FadeInDown.delay(50).duration(500)} className="items-center mb-2">
        <View className="bg-white/25 px-4 py-1.5 rounded-full flex-row items-center">
          <Text className="text-white text-xs font-medium tracking-wider" style={textShadowStyle}>STEP 3 OF 3</Text>
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(100).duration(500)}
        className="text-white text-2xl font-bold text-center mb-2 mt-2"
        style={textShadowStyleStrong}
      >
        What matters most to you?
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(150).duration(500)}
        className="text-white/90 text-center mb-6"
        style={textShadowStyle}
      >
        We'll highlight features that align with your goals.
      </Animated.Text>

      <OptionButton
        label="Time Management"
        description="Scheduling, reminders, and efficiency"
        icon={<Clock size={20} color={selectedPriority === 'time' ? currentColors.buttonColor : 'white'} />}
        selected={selectedPriority === 'time'}
        onPress={() => setSelectedPriority('time')}
        delay={200}
        buttonColor={currentColors.buttonColor}
      />
      <OptionButton
        label="Communication"
        description="Team chat, updates, and coordination"
        icon={<MessageCircle size={20} color={selectedPriority === 'communication' ? currentColors.buttonColor : 'white'} />}
        selected={selectedPriority === 'communication'}
        onPress={() => setSelectedPriority('communication')}
        delay={300}
        buttonColor={currentColors.buttonColor}
      />
      <OptionButton
        label="Student Growth"
        description="Progress tracking and development"
        icon={<TrendingUp size={20} color={selectedPriority === 'growth' ? currentColors.buttonColor : 'white'} />}
        selected={selectedPriority === 'growth'}
        onPress={() => setSelectedPriority('growth')}
        delay={400}
        buttonColor={currentColors.buttonColor}
      />
      <OptionButton
        label="Organization"
        description="Payments, waivers, and records"
        icon={<Target size={20} color={selectedPriority === 'organization' ? currentColors.buttonColor : 'white'} />}
        selected={selectedPriority === 'organization'}
        onPress={() => setSelectedPriority('organization')}
        delay={500}
        buttonColor={currentColors.buttonColor}
      />

      <View className="flex-1" />

      <Pressable
        onPress={handleContinue}
        disabled={!selectedPriority}
        className={`rounded-2xl py-4 flex-row items-center justify-center mb-4 ${
          selectedPriority ? 'bg-white active:opacity-80' : 'bg-white/30'
        }`}
      >
        <Text
          className="font-bold text-lg mr-2"
          style={{ color: selectedPriority ? currentColors.buttonColor : 'rgba(255,255,255,0.5)' }}
        >
          Complete Setup
        </Text>
        <ArrowRight size={20} color={selectedPriority ? currentColors.buttonColor : 'rgba(255,255,255,0.5)'} />
      </Pressable>
    </Animated.View>
  );

  // Screen 6: Ready - Transition Scene
  const renderReady = () => (
    <Animated.View entering={FadeIn.duration(800)} className="flex-1 justify-center px-6">
      {/* Animated Logo with Multiple Rings */}
      <Animated.View entering={ZoomIn.delay(100).duration(800)} className="items-center mb-10">
        <View className="items-center justify-center" style={{ width: 160, height: 160 }}>
          <PulsingRing size={160} delay={0} />
          <PulsingRing size={160} delay={500} />
          <PulsingRing size={160} delay={1000} />
          <FloatingElement>
            <View className="w-28 h-28 bg-white/20 rounded-full items-center justify-center">
              <Image
                source={require('../../public/icon-only-black.png')}
                style={{ width: 64, height: 64 }}
                resizeMode="contain"
              />
            </View>
          </FloatingElement>
        </View>
      </Animated.View>

      {/* Main Text */}
      <Animated.Text
        entering={FadeInDown.delay(300).duration(600)}
        className="text-white text-3xl font-bold text-center leading-tight mb-4"
        style={textShadowStyleStrong}
      >
        Your world, your team, your rhythm — all in one hub.
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(400).duration(600)}
        className="text-white/90 text-center text-base leading-relaxed mb-4"
        style={textShadowStyle}
      >
        Welcome to HalauHub — the all-in-one platform for managing dance schools with ease and clarity.
      </Animated.Text>

      {/* Quick Summary */}
      <Animated.View
        entering={FadeInDown.delay(500).duration(600)}
        className="bg-white/15 rounded-2xl p-4 mb-8 border border-white/25"
      >
        <Text className="text-white/80 text-xs text-center mb-3 uppercase tracking-wider" style={textShadowStyle}>Your Preferences</Text>
        <View className="flex-row justify-around">
          <View className="items-center">
            <Text className="text-white text-sm font-medium capitalize" style={textShadowStyle}>{selectedRole || 'Any'}</Text>
            <Text className="text-white/70 text-xs" style={textShadowStyle}>Role</Text>
          </View>
          <View className="w-px h-8 bg-white/25" />
          <View className="items-center">
            <Text className="text-white text-sm font-medium capitalize" style={textShadowStyle}>{selectedFrequency || 'Any'}</Text>
            <Text className="text-white/70 text-xs" style={textShadowStyle}>Frequency</Text>
          </View>
          <View className="w-px h-8 bg-white/25" />
          <View className="items-center">
            <Text className="text-white text-sm font-medium capitalize" style={textShadowStyle}>{selectedPriority || 'Any'}</Text>
            <Text className="text-white/70 text-xs" style={textShadowStyle}>Focus</Text>
          </View>
        </View>
      </Animated.View>

      {/* Buttons - use app theme colors for smooth transition */}
      <Animated.View entering={FadeInUp.delay(600).duration(600)}>
        <Pressable
          onPress={handleGetStarted}
          disabled={isTransitioning}
          className="bg-white rounded-2xl py-4 items-center mb-4 active:opacity-80"
        >
          <Text style={{ color: DEFAULT_THEME.primary }} className="font-bold text-lg">Sign Up & Begin</Text>
        </Pressable>

        <Pressable
          onPress={handleGetStarted}
          disabled={isTransitioning}
          className="bg-white/15 border border-white/30 rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-white font-semibold text-lg">I Already Have an Account</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );

  const renderContent = () => {
    switch (step) {
      case 'welcome':
        return renderWelcome();
      case 'features1':
        return renderFeatures1();
      case 'features2':
        return renderFeatures2();
      case 'features3':
        return renderFeatures3();
      case 'personalize_role':
        return renderPersonalizeRole();
      case 'personalize_frequency':
        return renderPersonalizeFrequency();
      case 'personalize_priority':
        return renderPersonalizePriority();
      case 'ready':
        return renderReady();
      default:
        return renderWelcome();
    }
  };

  // Animated style for content fade during transition
  const contentOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(gradientProgress.value, [0, 0.5], [1, 0]),
  }));

  return (
    <View className="flex-1">
      {/* Unified dark-to-Ocean-Mist gradient for all intro steps */}
      <LinearGradient
        colors={currentColors.gradientColors}
        locations={[0, 0.35, 0.7, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />

      {/* App theme gradient (transition layer for final step) */}
      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
          useAnimatedStyle(() => ({
            opacity: gradientProgress.value,
          }))
        ]}
      >
        <LinearGradient
          colors={currentColors.gradientColors}
          locations={[0, 0.35, 0.7, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
      </Animated.View>

      <Animated.View style={[{ flex: 1 }, contentOpacityStyle]}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!isTransitioning}
        >
          {/* Progress Dots */}
          {step !== 'welcome' && step !== 'ready' && renderProgressDots()}

          {/* Skip Button */}
          {step !== 'ready' && !isTransitioning && (
            <View className="absolute top-0 right-0 px-6 z-10" style={{ paddingTop: insets.top + 10 }}>
              <Pressable onPress={handleSkip} className="bg-white/15 px-4 py-2 rounded-full border border-white/20">
                <Text className="text-white/90 text-sm font-medium">Skip</Text>
              </Pressable>
            </View>
          )}

          {renderContent()}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
