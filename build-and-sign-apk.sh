#!/bin/bash

# ========= CONFIGURATION =========
APP_NAME="Kiosk E-Permit"
PACKAGE_NAME="com.ldk.kiosk"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
KEYSTORE_PATH="$PROJECT_DIR/android.keystore"
KEYSTORE_ALIAS="android"
KEYSTORE_PASS="developer123"
KEYPASS="developer123"
SDK_VERSION="33.0.2"
ANDROID_SDK_ROOT="$HOME/Android/Sdk"
APP_PATH="android/app/build/outputs/apk/release/app-release.apk"

# ========= PARSE ARGUMENTS =========
SITE_KEY=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --site) SITE_KEY="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ========= COLORS =========
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# ========= HELPER =========
print_step() {
    echo -e "${YELLOW}\n==> $1${NC}\n"
}

# ========= STEP 1 — CHECK DEPENDENCIES =========
print_step "Checking prerequisites..."
for cmd in java node npm npx wget unzip; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}Missing dependency: $cmd${NC}"
        exit 1
    fi
done

# ========= STEP 2 — ENSURE ANDROID SDK =========
print_step "Ensuring Android SDK exists..."
mkdir -p "$ANDROID_SDK_ROOT/cmdline-tools"
cd "$ANDROID_SDK_ROOT/cmdline-tools"

if [ ! -d "latest" ]; then
        print_step "Downloading Android command-line tools..."
        wget -q https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip -O cmdline-tools.zip
        unzip -q cmdline-tools.zip
        rm -f cmdline-tools.zip
        mv cmdline-tools latest
fi

export PATH=$PATH:"$ANDROID_SDK_ROOT/cmdline-tools/latest/bin"
export PATH=$PATH:"$ANDROID_SDK_ROOT/platform-tools"
export PATH=$PATH:"$ANDROID_SDK_ROOT/build-tools/$SDK_VERSION"

# Only install SDK packages if not already present
if [ ! -x "$ANDROID_SDK_ROOT/build-tools/$SDK_VERSION/aapt" ] || [ ! -d "$ANDROID_SDK_ROOT/platforms/android-33" ]; then
    print_step "Installing SDK packages..."
    yes | sdkmanager "platform-tools" "build-tools;$SDK_VERSION" "platforms;android-33"
else
    print_step "SDK packages already installed. Skipping installation."
fi

cd - >/dev/null 2>&1 || true

# ========= STEP 2b — INJECT SITE CONFIG =========
if [ -z "$SITE_KEY" ]; then
  echo -e "${YELLOW}Available sites (from kiosk-configs.json):${NC}"
  node -e "const c=require('$PROJECT_DIR/kiosk-configs.json'); Object.keys(c).forEach(k=>console.log('  '+k+' \u2014 '+c[k].siteName));"
  echo -e "${RED}\nUsage: $0 --site <site-key>${NC}"
  exit 1
fi
# Validate site key
node -e "const c=require('$PROJECT_DIR/kiosk-configs.json'); if(!c['$SITE_KEY']){process.stderr.write('Unknown site: $SITE_KEY\n');process.exit(1);}" || exit 1

print_step "Injecting config for site: $SITE_KEY..."
# Write kiosk.config.json (bundled by Next.js at build time)
node -e "
  const configs = require('$PROJECT_DIR/kiosk-configs.json');
  const cfg = configs['$SITE_KEY'];
  // Include kioskId only if it is non-empty
  const out = {
    siteId:       cfg.siteId,
    siteName:     cfg.siteName,
    kioskName:    cfg.kioskName,
    kioskId:      cfg.kioskId || '',
    appLabel:     cfg.appLabel,
    defaultHours:    cfg.defaultHours,
    expiryMode:      cfg.expiryMode,
        reRegisterCooldownMinutes: cfg.reRegisterCooldownMinutes,
    ...(cfg.durationOptions ? { durationOptions: cfg.durationOptions } : {}),
  };
  require('fs').writeFileSync('$PROJECT_DIR/kiosk.config.json', JSON.stringify(out, null, 2));
"
APP_LABEL=$(node -e "process.stdout.write(require('$PROJECT_DIR/kiosk-configs.json')['$SITE_KEY'].appLabel)")
# Patch Android strings.xml with Android-safe escaping for app labels
STRINGS_XML="$PROJECT_DIR/android/app/src/main/res/values/strings.xml"
PROJECT_DIR="$PROJECT_DIR" STRINGS_XML="$STRINGS_XML" SITE_KEY="$SITE_KEY" node <<'NODE'
const fs = require('fs');

const file = process.env.STRINGS_XML;
const projectDir = process.env.PROJECT_DIR;
const siteKey = process.env.SITE_KEY;
const raw = fs.readFileSync(file, 'utf8');
const label = require(projectDir + '/kiosk-configs.json')[siteKey].appLabel;
const escaped = String(label)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;');
const next = raw
    .replace(/<string name=\"app_name\">[\s\S]*?<\/string>/, '<string name=\"app_name\">' + escaped + '</string>')
    .replace(/<string name=\"title_activity_main\">[\s\S]*?<\/string>/, '<string name=\"title_activity_main\">' + escaped + '</string>');
fs.writeFileSync(file, next);
NODE
echo "  App label set to: $APP_LABEL"
# ========= STEP 3 — BUILD PWA =========
print_step "Building PWA (Next build + export to out/)..."
npm run build:web || { echo "${RED}PWA build/export failed${NC}"; exit 1; }

# ========= STEP 4 — COPY TO ANDROID =========
print_step "Generating native assets and copying to Android..."
npm run native:gen || { echo "${RED}native asset generation failed${NC}"; exit 1; }
npx cap copy android || { echo "${RED}cap copy failed${NC}"; exit 1; }

# ========= STEP 5 — CONFIGURE SIGNING =========
print_step "Injecting signing configuration..."
cd android
SIGNING_FILE="app/build.gradle"

if ! grep -q "signingConfigs" $SIGNING_FILE; then
cat <<EOL >> $SIGNING_FILE

android {
    signingConfigs {
        release {
            storeFile file("$KEYSTORE_PATH")
            storePassword "$KEYSTORE_PASS"
            keyAlias "$KEYSTORE_ALIAS"
            keyPassword "$KEYPASS"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
EOL
fi

# ========= STEP 6 — BUILD SIGNED APK =========
print_step "Cleaning previous Android build outputs..."
# Clean Gradle caches for a fresh build
./gradlew clean -q || { echo "${RED}Gradle clean failed${NC}"; exit 1; }
# Remove any leftover outputs (APKs/AABs) and transient build dirs
rm -rf app/build/outputs/apk/* app/build/outputs/bundle/* app/build/intermediates/* app/build/generated/* app/build/tmp/* || true

print_step "Building signed APK..."
./gradlew assembleRelease || { echo "${RED}Gradle build failed${NC}"; exit 1; }

# Return to project root for all remaining steps
cd "$PROJECT_DIR"

# ========= STEP 7 — VERIFY APK SIGNATURE =========
print_step "Verifying APK signature..."
$ANDROID_SDK_ROOT/build-tools/$SDK_VERSION/apksigner verify --verbose "$APP_PATH"
if [ $? -ne 0 ]; then
    echo -e "${RED}APK signature verification failed!${NC}"
    exit 1
fi

# ========= STEP 8 — INSTALL ON DEVICE =========
print_step "Checking connected devices..."
adb devices

read -p "Do you want to install APK on device? (y/n): " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
    adb install -r "$APP_PATH"
    echo -e "${GREEN}APK installed successfully!${NC}"
else
    echo -e "${YELLOW}Skipped installation.${NC}"
fi

echo -e "${GREEN}✅ Done! Signed APK is at:${NC} $PROJECT_DIR/$APP_PATH"

# ========= STEP 9 — COPY NAMED APK =========
OUTPUT_APK="$PROJECT_DIR/ldk-kiosk-${SITE_KEY}.apk"
cp "$APP_PATH" "$OUTPUT_APK"
echo -e "${GREEN}📦 Site APK saved as:${NC} $OUTPUT_APK"
