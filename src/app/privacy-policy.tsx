import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';
import BackButton from '@/components/BackButton';
import { Mail, Globe } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Linking from 'expo-linking';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const Section = ({
    title,
    children,
    delay = 0
  }: {
    title: string;
    children: React.ReactNode;
    delay?: number;
  }) => (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400)}
      className="mb-4"
    >
      <Text className={cn(
        'text-base font-bold mb-2',
        isDark ? 'text-white' : 'text-gray-900'
      )}>
        {title}
      </Text>
      <Text className={cn(
        'text-sm leading-6',
        isDark ? 'text-gray-300' : 'text-gray-600'
      )}>
        {children}
      </Text>
    </Animated.View>
  );

  const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View className="mb-3">
      <Text className={cn(
        'text-sm font-semibold mb-1',
        isDark ? 'text-gray-200' : 'text-gray-700'
      )}>
        {title}
      </Text>
      <Text className={cn(
        'text-sm leading-6',
        isDark ? 'text-gray-300' : 'text-gray-600'
      )}>
        {children}
      </Text>
    </View>
  );

  const BulletPoint = ({ children }: { children: React.ReactNode }) => (
    <View className="flex-row ml-2 mb-1.5">
      <Text className={cn('mr-2 text-sm', isDark ? 'text-gray-300' : 'text-gray-600')}>•</Text>
      <Text className={cn(
        'flex-1 text-sm leading-6',
        isDark ? 'text-gray-300' : 'text-gray-600'
      )}>
        {children}
      </Text>
    </View>
  );

  const Divider = () => (
    <View className={cn('h-px mx-0 mb-5', isDark ? 'bg-gray-800' : 'bg-gray-100')} />
  );

  return (
    <View className={cn('flex-1', isDark ? 'bg-black' : 'bg-white')}>
      {/* Header */}
      <View
        className={cn(
          'flex-row items-center px-4 pb-4 border-b',
          isDark ? 'border-gray-800' : 'border-gray-200'
        )}
        style={{ paddingTop: insets.top + 8 }}
      >
        <BackButton />
        <Text className={cn(
          'flex-1 text-lg font-bold text-center mr-10',
          isDark ? 'text-white' : 'text-gray-900'
        )}>
          Privacy Policy
        </Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingTop: 24, paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Animated.View entering={FadeInDown.duration(400)} className="mb-6">
          <Text className={cn(
            'text-xl font-bold mb-1',
            isDark ? 'text-white' : 'text-gray-900'
          )}>
            HalauHub Privacy Policy
          </Text>
          <Text className={cn(
            'text-xs mb-4',
            isDark ? 'text-gray-500' : 'text-gray-400'
          )}>
            Last Updated: February 28, 2026
          </Text>
          <Text className={cn(
            'text-sm leading-6',
            isDark ? 'text-gray-300' : 'text-gray-600'
          )}>
            HalauHub ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the HalauHub mobile application ("App"). Please read this policy carefully. If you do not agree with its terms, please discontinue use of the App.
          </Text>
        </Animated.View>

        <Divider />

        {/* Section 1 */}
        <Section title="1. Information We Collect" delay={100}>
          We collect the following categories of information:
        </Section>
        <View className="mb-5">
          <SubSection title="Information You Provide Directly">
            When you create an account or use the App, you may provide: your name, email address, phone number, profile photo, school/halau affiliation, class level, and any other content you submit (messages, event RSVPs, financial records, etc.).
          </SubSection>
          <SubSection title="Information About Minors">
            If you are a parent or legal guardian registering a minor child (under 13), you provide the child's name and school affiliation on their behalf. We do not knowingly allow minors to independently create accounts or submit personal information without parental consent.
          </SubSection>
          <SubSection title="Automatically Collected Data">
            When you use the App, we may automatically collect: device identifiers (IDFA/IDFV), operating system and version, app version, crash and performance data, and general usage analytics. This data is used solely to maintain and improve the App.
          </SubSection>
          <SubSection title="Payment and Subscription Data">
            Subscription purchases are processed through Apple's App Store. We do not collect or store your payment card information. We receive confirmation of subscription status from Apple (via RevenueCat) to unlock premium features.
          </SubSection>
        </View>

        <Divider />

        {/* Section 2 */}
        <Section title="2. How We Use Your Information" delay={150}>
          We use your information to:
        </Section>
        <View className="mb-5">
          <BulletPoint>Create and maintain your account and school membership.</BulletPoint>
          <BulletPoint>Enable communication within your halau (messaging, event coordination).</BulletPoint>
          <BulletPoint>Process and verify subscription status for premium features.</BulletPoint>
          <BulletPoint>Send important notices about the App, your account, or school activities.</BulletPoint>
          <BulletPoint>Analyze usage patterns to improve performance, features, and user experience.</BulletPoint>
          <BulletPoint>Comply with legal obligations and enforce our Terms of Use.</BulletPoint>
          <BulletPoint>Respond to your requests, questions, and support inquiries.</BulletPoint>
        </View>

        <Divider />

        {/* Section 3 */}
        <Section title="3. How We Share Your Information" delay={200}>
          We do not sell your personal information. We may share information in the following limited circumstances:
        </Section>
        <View className="mb-5">
          <SubSection title="Within Your Halau">
            Your name, role, and profile information are visible to other members of your halau (school). Teachers and admins may access member attendance, financial records, and waiver status within their school only.
          </SubSection>
          <SubSection title="Service Providers">
            We use trusted third-party providers to operate the App, including Firebase (Google) for authentication and data storage, RevenueCat for subscription management, and analytics tools. These providers are contractually bound to use your data only to perform services for us.
          </SubSection>
          <SubSection title="Legal Requirements">
            We may disclose your information if required by law, court order, or governmental authority, or to protect the rights, property, or safety of HalauHub, our users, or the public.
          </SubSection>
          <SubSection title="Business Transfers">
            In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity, subject to the same privacy protections.
          </SubSection>
        </View>

        <Divider />

        {/* Section 4 */}
        <Section title="4. Data Retention and Deletion" delay={250}>
          We retain your personal information for as long as your account is active or as needed to provide services. You have the right to request deletion of your account and associated data at any time.{'\n\n'}To delete your account, go to More → Delete Account within the App, or contact us at support@kolohekinebitz.com. Upon deletion, your personal data will be permanently removed from our systems within 30 days, except where retention is required by law.{'\n\n'}Note: Some information (such as financial transaction records) may be retained for legal compliance purposes even after account deletion.
        </Section>

        <Divider />

        {/* Section 5 */}
        <Section title="5. Data Security" delay={300}>
          We implement industry-standard security measures including encryption in transit (TLS/SSL), Firebase security rules for access control, and regular security reviews. However, no method of transmission over the internet or electronic storage is 100% secure. We cannot guarantee absolute security of your data.
        </Section>

        <Divider />

        {/* Section 6 */}
        <Section title="6. Children's Privacy (COPPA)" delay={350}>
          HalauHub serves halau (hula schools) that include minor students. We comply with the Children's Online Privacy Protection Act (COPPA).{'\n\n'}Children under 13 may only use the App under the account of a parent or legal guardian. Parents and guardians who register minors provide consent for the collection and use of the minor's information as described in this policy.{'\n\n'}We do not knowingly collect personal information directly from children under 13 without verifiable parental consent. If you believe a child under 13 has independently provided us with personal information, please contact us immediately at support@kolohekinebitz.com and we will delete such information promptly.
        </Section>

        <Divider />

        {/* Section 7 */}
        <Section title="7. Your Privacy Rights" delay={400}>
          Depending on your location, you may have the following rights:
        </Section>
        <View className="mb-5">
          <SubSection title="All Users">
            Right to access the personal information we hold about you. Right to correct inaccurate information. Right to request deletion of your account and data.
          </SubSection>
          <SubSection title="California Residents (CCPA)">
            Right to know what personal information we collect, use, disclose, and sell (we do not sell personal information). Right to opt-out of sale (not applicable — we do not sell data). Right to non-discrimination for exercising your privacy rights.
          </SubSection>
          <SubSection title="EEA/UK Residents (GDPR)">
            Right to data portability, right to restrict processing, right to object to processing, and right to lodge a complaint with a supervisory authority.
          </SubSection>
          <Text className={cn('text-sm leading-6 mt-2', isDark ? 'text-gray-300' : 'text-gray-600')}>
            To exercise any of these rights, contact us at support@kolohekinebitz.com.
          </Text>
        </View>

        <Divider />

        {/* Section 8 */}
        <Section title="8. Third-Party Services and Links" delay={450}>
          The App may contain links to third-party websites or services (such as Ko-fi for support, or external waiver forms). This Privacy Policy does not apply to those third-party services. We encourage you to review the privacy policies of any third-party services you access.{'\n\n'}Our App uses the following key third-party services:{'\n'}• Google Firebase — authentication and cloud database{'\n'}• RevenueCat — subscription and purchase management (Apple App Store){'\n'}• Expo / React Native — mobile application framework
        </Section>

        <Divider />

        {/* Section 9 */}
        <Section title="9. Apple App Store Disclosures" delay={500}>
          In compliance with Apple App Store requirements, we disclose the following data practices:{'\n\n'}
          <Text className={cn('text-sm font-semibold', isDark ? 'text-gray-200' : 'text-gray-700')}>Data Used to Track You:</Text>
          {'\n'}None. HalauHub does not track users across third-party apps or websites for advertising purposes.{'\n\n'}
          <Text className={cn('text-sm font-semibold', isDark ? 'text-gray-200' : 'text-gray-700')}>Data Linked to You:</Text>
          {'\n'}• Contact info (name, email address){'\n'}• User content (messages, media, RSVPs){'\n'}• Usage data (app interactions, performance data){'\n'}• Identifiers (user ID){'\n\n'}
          <Text className={cn('text-sm font-semibold', isDark ? 'text-gray-200' : 'text-gray-700')}>Data Not Linked to You:</Text>
          {'\n'}• Crash and diagnostic data
        </Section>

        <Divider />

        {/* Section 10 */}
        <Section title="10. Changes to This Policy" delay={550}>
          We may update this Privacy Policy from time to time. When we make changes, we will update the "Last Updated" date at the top of this page. For significant changes, we will provide notice within the App. Continued use of the App after changes are posted constitutes your acceptance of the revised policy.
        </Section>

        <Divider />

        {/* Section 11 */}
        <Section title="11. Contact Us" delay={600}>
          If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us:
        </Section>

        {/* Contact Links */}
        <Animated.View
          entering={FadeInDown.delay(650).duration(400)}
          className="items-center mb-8"
        >
          <Pressable
            onPress={() => Linking.openURL('mailto:support@kolohekinebitz.com')}
            className={cn(
              'flex-row items-center px-5 py-3 rounded-full mb-3 active:opacity-70',
              isDark ? 'bg-gray-900' : 'bg-white'
            )}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.4 : 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Mail size={16} color={isDark ? '#60A5FA' : '#3B82F6'} />
            <Text className={cn(
              'text-sm ml-2',
              isDark ? 'text-blue-400' : 'text-blue-600'
            )}>
              support@kolohekinebitz.com
            </Text>
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL('https://www.kolohekinebitz.com/support')}
            className={cn(
              'flex-row items-center px-5 py-3 rounded-full active:opacity-70',
              isDark ? 'bg-gray-900' : 'bg-white'
            )}
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.4 : 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Globe size={16} color={isDark ? '#60A5FA' : '#3B82F6'} />
            <Text className={cn(
              'text-sm ml-2',
              isDark ? 'text-blue-400' : 'text-blue-600'
            )}>
              www.kolohekinebitz.com/support
            </Text>
          </Pressable>
        </Animated.View>

        {/* Footer note */}
        <Animated.View entering={FadeInDown.delay(700).duration(400)}>
          <Text className={cn('text-xs text-center leading-5', isDark ? 'text-gray-600' : 'text-gray-400')}>
            HalauHub is operated from the State of Hawaii, USA.{'\n'}
            © 2026 HalauHub. All rights reserved.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
