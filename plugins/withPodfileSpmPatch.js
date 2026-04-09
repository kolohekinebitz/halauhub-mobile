/**
 * plugins/withPodfileSpmPatch.js
 *
 * Expo config plugin that patches the generated ios/Podfile to guard against
 * the React Native 0.79.x + CocoaPods 1.16.x SPM NilClass bug:
 *   "undefined method `package_product_dependencies' for nil:NilClass"
 *
 * The patch wraps `react_native_post_install(installer)` in a rescue block
 * so that nil-target SPM errors are caught and logged rather than aborting
 * the pod install.
 */

const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const ORIGINAL = "react_native_post_install(installer)";
const PATCHED = `begin
        react_native_post_install(installer)
      rescue NoMethodError => e
        puts "\\u26a0\\ufe0f  Ignored SPM nil-target error: #{e.message}"
      end`;

module.exports = function withPodfileSpmPatch(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn("[withPodfileSpmPatch] Podfile not found — skipping patch");
        return config;
      }

      let contents = fs.readFileSync(podfilePath, "utf8");

      if (contents.includes(PATCHED)) {
        console.log("[withPodfileSpmPatch] Podfile already patched — skipping");
        return config;
      }

      if (!contents.includes(ORIGINAL)) {
        console.warn(
          "[withPodfileSpmPatch] Could not find react_native_post_install — skipping patch"
        );
        return config;
      }

      contents = contents.replace(ORIGINAL, PATCHED);
      fs.writeFileSync(podfilePath, contents, "utf8");
      console.log("[withPodfileSpmPatch] ✅ Podfile patched successfully");
      return config;
    },
  ]);
};
