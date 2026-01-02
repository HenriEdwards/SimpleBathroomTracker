
TECH STACK
<!-- app runtime + tooling baseline (managed workflow, builds, OTA) -->
- Expo (SDK 54, EAS Build)
<!-- core UI/runtime framework -->
- React Native / React 
<!-- primary language for app code -->
- TypeScript (app code) / JavaScript
<!-- routing + navigation stack -->
- Expo Router (navigation) + React Navigation
<!-- localization/i18n framework -->
- i18next + react-i18next (localization)
<!-- native Android layer (widgets, manifests, resources) -->
- Android native: Kotlin/Java, Android AppWidget, XML resources/manifests
<!-- Android build system + JS engine -->
- Gradle / Android build tooling, Hermes JS engine (Android)

COMMANDS

<!-- generate Play Store .aab (cloud, signed, upload to Play Console) -->
eas build -p android --profile production

<!-- clears Metro cache (fix weird/stale JS issues) -->
npx expo start -c

<!-- start Metro for custom Expo Dev Client (native code present) -->
npx expo start --dev-client

<!-- build & install DEBUG app locally on Android emulator/device -->
npx expo run:android

<!-- build & install RELEASE APK locally (release behavior, not Play Store) -->
npx expo run:android --variant release

<!-- manage Android signing keys / keystore / credentials -->
eas credentials -p android

<!-- generate native android/ios folders from Expo config (⚠️ can overwrite native changes like widget fucking destroyal never run) -->
npx expo prebuild

<!-- show build/signing credentials + fingerprints -->
eas credentials -p android

<!-- build a production AAB in cloud (non-interactive) -->
eas build -p android --profile production --non-interactive

<!-- get device logs (debug widget/provider issues) -->
adb logcat

<!-- list installed packages (confirm install) -->
adb shell pm list packages | findstr bathroomcounter