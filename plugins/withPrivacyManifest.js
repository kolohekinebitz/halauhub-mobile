/**
 * withPrivacyManifest.js
 *
 * Expo config plugin that injects a PrivacyInfo.xcprivacy file into the iOS
 * native project. This satisfies Apple App Store requirements (effective
 * Spring 2024+) for declaring API usage reasons.
 *
 * APIs declared here match HalauHub's actual SDK usage:
 *   - Firebase SDK     → UserDefaults, File timestamp APIs
 *   - RevenueCat SDK   → UserDefaults
 *   - Expo / RN core   → Disk space, System boot time
 *
 * Reference: https://developer.apple.com/documentation/bundleresources/privacy_manifest_files
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PRIVACY_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- ─── Data collected by HalauHub ─────────────────────────────────────── -->
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <!-- Email address: used for Firebase Authentication -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeEmailAddress</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <!-- Name: used to display member profiles -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeName</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <!-- Photos/Videos: chosen by user to publish in-app content -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypePhotosorVideos</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <!-- Purchase history: managed by RevenueCat for subscription entitlements -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypePurchaseHistory</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <true/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
    <!-- Other user content: documents and waivers uploaded via DocumentPicker -->
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeOtherUserContent</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
      </array>
    </dict>
  </array>

  <!-- ─── Required Reason APIs used by HalauHub's SDKs ──────────────────── -->
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <!-- UserDefaults — Firebase, RevenueCat, and Expo all read/write preferences -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
    <!-- File timestamp APIs — Firebase SDK reads file modification times -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>C617.1</string>
      </array>
    </dict>
    <!-- Disk space APIs — React Native / Expo checks available storage -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryDiskSpace</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>85F4.1</string>
      </array>
    </dict>
    <!-- System boot time — used for performance timing within Expo modules -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategorySystemBootTime</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>35F9.1</string>
      </array>
    </dict>
  </array>

  <!-- HalauHub does not use any tracking APIs -->
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
</dict>
</plist>
`;

/**
 * Writes PrivacyInfo.xcprivacy into the iOS app target directory so Xcode
 * picks it up automatically during the EAS Build native compilation.
 */
const withPrivacyManifest = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosDir = path.join(projectRoot, 'ios', config.modRequest.projectName);

      // Guard: only write if the ios/<AppName> directory exists (post-prebuild)
      if (!fs.existsSync(iosDir)) {
        console.log('[withPrivacyManifest] iOS directory not found — skipping (run expo prebuild first).');
        return config;
      }

      const manifestPath = path.join(iosDir, 'PrivacyInfo.xcprivacy');
      fs.writeFileSync(manifestPath, PRIVACY_MANIFEST, 'utf8');
      console.log(`[withPrivacyManifest] PrivacyInfo.xcprivacy written to ${manifestPath}`);
      return config;
    },
  ]);
};

module.exports = withPrivacyManifest;
