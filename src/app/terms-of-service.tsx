import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';
import BackButton from '@/components/BackButton';
import { Mail, Globe } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Linking from 'expo-linking';

export default function TermsOfServiceScreen() {
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
          Terms of Use (EULA)
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
            HalauHub Terms of Use (EULA)
          </Text>
          <Text className={cn(
            'text-xs mb-4',
            isDark ? 'text-gray-500' : 'text-gray-400'
          )}>
            Effective Date: March 18, 2026
          </Text>
          <Text className={cn(
            'text-sm leading-6',
            isDark ? 'text-gray-300' : 'text-gray-600'
          )}>
            Welcome to HalauHub ("App," "Service"). By downloading, installing, or using HalauHub, you agree to be bound by these Terms of Use ("Terms"). If you do not agree, do not use the App.{'\n\n'}These Terms constitute a legal agreement between you and HalauHub. For Apple App Store purchases, additional terms set forth by Apple may also apply.
          </Text>
        </Animated.View>

        <Divider />

        {/* Section 1 */}
        <Section title="1. Acceptance of Terms" delay={100}>
          By creating an account or using HalauHub, you confirm that you are at least 18 years of age, or that you are the parent or legal guardian of a minor using the App under your supervision, and that you have the legal authority to enter into these Terms. If you are using HalauHub on behalf of a halau or organization, you represent that you have authority to bind that organization to these Terms.
        </Section>

        <Divider />

        {/* Section 2 */}
        <Section title="2. Description of Service" delay={150}>
          HalauHub is a mobile platform designed for hula schools (halau) to manage members, events, attendance, finances, waivers, and communication. The App is available to teachers (kumu), administrators, students, and parent/guardian accounts.{'\n\n'}We reserve the right to modify, suspend, or discontinue any feature of the Service at any time with or without notice.
        </Section>

        <Divider />

        {/* Section 3 — Auto-Renewal Required by Apple */}
        <Section title="3. Subscriptions and In-App Purchases" delay={200}>
          HalauHub offers subscription plans that unlock premium features for halau teachers and administrators. The following terms apply to all subscriptions:
        </Section>
        <View className="mb-5">
          <BulletPoint>
            <Text className={cn('text-sm font-semibold', isDark ? 'text-gray-200' : 'text-gray-700')}>Billing: </Text>
            Subscription fees are billed through your Apple ID at the rate shown at the time of purchase. Payment is charged to your Apple ID account upon confirmation of purchase.
          </BulletPoint>
          <BulletPoint>
            <Text className={cn('text-sm font-semibold', isDark ? 'text-gray-200' : 'text-gray-700')}>Auto-Renewal: </Text>
            Subscriptions automatically renew unless auto-renewal is turned off at least 24 hours before the end of the current billing period.
          </BulletPoint>
          <BulletPoint>
            <Text className={cn('text-sm font-semibold', isDark ? 'text-gray-200' : 'text-gray-700')}>Renewal Charge: </Text>
            Your Apple ID account will be charged for renewal within 24 hours prior to the end of the current billing period at the then-current subscription price.
          </BulletPoint>
          <BulletPoint>
            <Text className={cn('text-sm font-semibold', isDark ? 'text-gray-200' : 'text-gray-700')}>Free Trial: </Text>
            If a free trial period is offered, you will not be charged during the trial. Unused portions of a free trial are forfeited when you purchase a subscription.
          </BulletPoint>
          <BulletPoint>
            <Text className={cn('text-sm font-semibold', isDark ? 'text-gray-200' : 'text-gray-700')}>Managing Subscriptions: </Text>
            You can manage or cancel your subscription at any time by going to your Apple ID account settings after purchase. Cancellation takes effect at the end of the current billing period.
          </BulletPoint>
          <BulletPoint>
            <Text className={cn('text-sm font-semibold', isDark ? 'text-gray-200' : 'text-gray-700')}>Refunds: </Text>
            All purchases are final. Refund requests must be submitted directly to Apple in accordance with Apple's refund policies.
          </BulletPoint>
          <BulletPoint>
            <Text className={cn('text-sm font-semibold', isDark ? 'text-gray-200' : 'text-gray-700')}>Price Changes: </Text>
            We may change subscription prices at any time. Price changes will take effect at the start of your next billing period. We will notify you in advance of any price change.
          </BulletPoint>
        </View>

        <Divider />

        {/* Section 4 */}
        <Section title="4. User Accounts" delay={250}>
          You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to:{'\n\n'}• Provide accurate, current, and complete registration information.{'\n'}• Promptly update your information if it changes.{'\n'}• Notify us immediately of any unauthorized use of your account.{'\n\n'}We reserve the right to suspend or terminate accounts that violate these Terms or that we determine, in our sole discretion, present a risk to other users or the Service.
        </Section>

        <Divider />

        {/* Section 5 */}
        <Section title="5. User Content" delay={300}>
          You retain ownership of content you submit through the App (messages, photos, event details, etc.). By submitting content, you grant HalauHub a limited, non-exclusive license to use, store, and display that content solely to operate the Service.{'\n\n'}You are solely responsible for your content and represent that you have all necessary rights to submit it. You agree not to submit content that is unlawful, defamatory, harmful to minors, harassing, or that infringes on any third-party intellectual property rights.
        </Section>

        <Divider />

        {/* Section 6 */}
        <Section title="6. Prohibited Uses" delay={350}>
          You agree not to:
        </Section>
        <View className="mb-5">
          <BulletPoint>Use the App for any unlawful, harmful, or fraudulent purpose.</BulletPoint>
          <BulletPoint>Harass, bully, or intimidate other users, especially minors.</BulletPoint>
          <BulletPoint>Upload or transmit viruses, malicious code, or any content that disrupts the Service.</BulletPoint>
          <BulletPoint>Attempt to gain unauthorized access to other accounts or App systems.</BulletPoint>
          <BulletPoint>Scrape, reverse-engineer, or copy any portion of the App.</BulletPoint>
          <BulletPoint>Impersonate any person or entity, or misrepresent your affiliation with any person or entity.</BulletPoint>
          <BulletPoint>Use the App to collect or harvest information about other users without their consent.</BulletPoint>
        </View>

        <Divider />

        {/* Section 7 */}
        <Section title="7. Intellectual Property" delay={400}>
          All content, design, code, logos, trademarks, and materials comprising HalauHub are the exclusive property of HalauHub or its licensors and are protected by applicable intellectual property laws. You may not copy, modify, distribute, sell, or create derivative works from any part of the App without our express written permission.{'\n\n'}The name "HalauHub," the HalauHub logo, and related marks are trademarks of HalauHub. Unauthorized use of these marks is prohibited.
        </Section>

        <Divider />

        {/* Section 8 */}
        <Section title="8. Privacy" delay={450}>
          Your use of the App is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the App, you consent to the data practices described in our Privacy Policy.
        </Section>

        <Divider />

        {/* Section 9 */}
        <Section title="9. Children's Use" delay={500}>
          The App is not directed to children under 13 acting independently. Children under 13 may only use the App under the direct supervision and account of a parent or legal guardian. If you are a parent or guardian, you accept these Terms on behalf of your child and acknowledge responsibility for their use of the App.{'\n\n'}Teachers and administrators using HalauHub to manage minor students must ensure that appropriate parental consent has been obtained and that student data is handled in compliance with applicable law, including COPPA (Children's Online Privacy Protection Act) and FERPA where applicable.
        </Section>

        <Divider />

        {/* Section 10 */}
        <Section title="10. Disclaimer of Warranties" delay={550}>
          HalauHub is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the App will be uninterrupted, error-free, or free of viruses or other harmful components.{'\n\n'}We are not responsible for any actions taken by users within the App, including communications between teachers, students, and guardians.
        </Section>

        <Divider />

        {/* Section 11 */}
        <Section title="11. Limitation of Liability" delay={600}>
          To the fullest extent permitted by applicable law, HalauHub and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, arising out of or in connection with your use of the App.{'\n\n'}Our total liability to you for any claim arising from these Terms or your use of the App shall not exceed the amount you paid to HalauHub in the 12 months preceding the claim.{'\n\n'}Some jurisdictions do not allow limitations of liability, so the above limitations may not apply to you.
        </Section>

        <Divider />

        {/* Section 12 */}
        <Section title="12. Indemnification" delay={620}>
          You agree to indemnify and hold harmless HalauHub and its officers, directors, employees, and agents from any claims, damages, liabilities, costs, or expenses (including reasonable attorney's fees) arising from: (a) your use of the App; (b) your violation of these Terms; (c) your user content; or (d) your violation of any rights of another party.
        </Section>

        <Divider />

        {/* Section 13 */}
        <Section title="13. Account Termination and Data Deletion" delay={640}>
          You may delete your account at any time by going to More → Delete Account within the App, or by contacting us at support@kolohekinebitz.com. Upon account deletion, your personal data will be removed from our active systems within 30 days.{'\n\n'}We may suspend or terminate your account immediately without notice if you violate these Terms or if we determine that continued access presents a risk to other users. Upon termination, your right to use the App ceases immediately.{'\n\n'}School-level data (event records, attendance logs, financial records) managed by a teacher/owner account may be retained for legal compliance purposes.
        </Section>

        <Divider />

        {/* Section 14 */}
        <Section title="14. Apple-Specific Terms" delay={660}>
          If you download HalauHub from the Apple App Store, the following additional terms apply:{'\n\n'}
          These Terms are between you and HalauHub only, not with Apple Inc. Apple is not responsible for the App or its content. Apple has no obligation whatsoever to provide any maintenance or support services for the App.{'\n\n'}
          In the event of any failure of the App to conform to any applicable warranty, you may notify Apple and Apple will refund the purchase price for the App, if any. To the maximum extent permitted by applicable law, Apple will have no other warranty obligation with respect to the App.{'\n\n'}
          Apple is not responsible for addressing any claims by you or any third party relating to the App or your possession and/or use of the App, including: (i) product liability claims; (ii) any claim that the App fails to conform to any applicable legal or regulatory requirement; or (iii) claims arising under consumer protection or similar legislation.{'\n\n'}
          Apple and Apple's subsidiaries are third-party beneficiaries of these Terms, and upon your acceptance, Apple will have the right to enforce these Terms against you as a third-party beneficiary.
        </Section>

        <Divider />

        {/* Section 15 */}
        <Section title="15. Changes to Terms" delay={680}>
          We may update these Terms from time to time. We will notify you of significant changes by posting a notice within the App or updating the effective date at the top of this page. Continued use of the App after changes are posted constitutes your acceptance of the revised Terms.
        </Section>

        <Divider />

        {/* Section 16 */}
        <Section title="16. Governing Law and Dispute Resolution" delay={700}>
          These Terms are governed by and construed in accordance with the laws of the State of Hawaii, USA, without regard to conflict of law principles.{'\n\n'}Any disputes arising from these Terms or your use of the App shall first be attempted to be resolved through good-faith negotiation. If unresolved, disputes shall be submitted to binding arbitration in Honolulu, Hawaii, in accordance with the rules of the American Arbitration Association, except that either party may seek injunctive relief in court for intellectual property infringement.{'\n\n'}You waive any right to participate in a class action lawsuit or class-wide arbitration against HalauHub.
        </Section>

        <Divider />

        {/* Section 17 */}
        <Section title="17. Contact Us" delay={750}>
          If you have questions about these Terms or need support, please contact us:
        </Section>

        {/* Contact Links */}
        <Animated.View
          entering={FadeInDown.delay(800).duration(400)}
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
        <Animated.View entering={FadeInDown.delay(850).duration(400)}>
          <Text className={cn('text-xs text-center leading-5', isDark ? 'text-gray-600' : 'text-gray-400')}>
            HalauHub is operated from the State of Hawaii, USA.{'\n'}
            © 2026 HalauHub. All rights reserved.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
