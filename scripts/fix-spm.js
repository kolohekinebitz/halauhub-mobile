#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * scripts/fix-spm.js
 *
 * Patches react-native's spm.rb to guard against ALL nil-target crashes
 * caused by the CocoaPods 1.16.x + RN 0.79.x SPM incompatibility:
 *
 *   spm.rb:34  undefined method `build_configurations' for nil:NilClass
 *   spm.rb:80  undefined method `package_product_dependencies' for nil:NilClass
 *
 * This script is run via the EAS prebuildCommand so it executes on the
 * build server before `pod install`.
 */

const fs = require("fs");
const path = require("path");

const spmPath = path.join(
  __dirname,
  "../node_modules/react-native/scripts/cocoapods/spm.rb"
);

if (!fs.existsSync(spmPath)) {
  console.log("[fix-spm] spm.rb not found, skipping.");
  process.exit(0);
}

let content = fs.readFileSync(spmPath, "utf8");

if (content.includes("Guard: nil target causes NilClass")) {
  console.log("[fix-spm] spm.rb already patched, skipping.");
  process.exit(0);
}

// Patch 1: add nil guard before build_configurations call (line ~33)
const ORIG_LINE33 = `        log " Adding workaround for Swift package not found issue"
        target = project.targets.find { |t| t.name == pod_name}
        target.build_configurations.each do |config|`;

const PATCH_LINE33 = `        log " Adding workaround for Swift package not found issue"
        target = project.targets.find { |t| t.name == pod_name}
        # Guard: nil target causes NilClass crash with CocoaPods 1.16.x (RN 0.79.x bug)
        next if target.nil?
        target.build_configurations.each do |config|`;

// Patch 2: add nil guard at start of add_spm_to_target (line ~68)
const ORIG_LINE68 = `  def add_spm_to_target(project, target, url, requirement, products)
    pkg_class = Xcodeproj::Project::Object::XCRemoteSwiftPackageReference`;

const PATCH_LINE68 = `  def add_spm_to_target(project, target, url, requirement, products)
    # Guard: nil target causes NilClass crash with CocoaPods 1.16.x (RN 0.79.x bug)
    if target.nil?
      log_warning "Skipping SPM products for nil target (url: #{url})"
      return
    end
    pkg_class = Xcodeproj::Project::Object::XCRemoteSwiftPackageReference`;

let patched = false;

if (content.includes(ORIG_LINE33)) {
  content = content.replace(ORIG_LINE33, PATCH_LINE33);
  patched = true;
  console.log("[fix-spm] Applied patch 1: build_configurations nil guard");
} else {
  console.warn("[fix-spm] Patch 1 target not found — may already be patched or format changed");
}

if (content.includes(ORIG_LINE68)) {
  content = content.replace(ORIG_LINE68, PATCH_LINE68);
  patched = true;
  console.log("[fix-spm] Applied patch 2: add_spm_to_target nil guard");
} else {
  console.warn("[fix-spm] Patch 2 target not found — may already be patched or format changed");
}

if (patched) {
  fs.writeFileSync(spmPath, content, "utf8");
  console.log("[fix-spm] ✅ spm.rb patched successfully.");
} else {
  console.log("[fix-spm] No patches applied.");
}
