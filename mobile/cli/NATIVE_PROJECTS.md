# Native project setup

Generate the React Native 0.86.3 projects with the Community CLI 20.1.0. Run
these commands from the repository root with Node 22 active.

```sh
pnpm --filter @app/mobile-cli exec rnc-cli init MobileCli --template @react-native-community/template@0.86.3 --directory /tmp/mobile-cli-native-0.86.3 --skip-install
cp -R /tmp/mobile-cli-native-0.86.3/ios mobile/cli/ios
cp -R /tmp/mobile-cli-native-0.86.3/android mobile/cli/android
```

Keep the generated native project files under `mobile/cli/ios` and
`mobile/cli/android`. Do not copy the generated package manifest or lockfile.

## iOS

In `mobile/cli/ios/MobileCli.xcodeproj/project.pbxproj`, set every
`PRODUCT_BUNDLE_IDENTIFIER` build setting to `com.example.mobilecli`.

In `mobile/cli/ios/MobileCli/Info.plist`, add this URL type under
`CFBundleURLTypes`:

```xml
<dict>
  <key>CFBundleURLSchemes</key>
  <array>
    <string>mobilecli</string>
  </array>
</dict>
```

In the same plist, allow local networking for the development API origin
`http://localhost:5001`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsLocalNetworking</key>
  <true/>
</dict>
```

In `mobile/cli/ios/Podfile`, require Expo's autolinking script before the app
target, then call `use_expo_modules!` inside that target before
`use_react_native!`:

```ruby
require File.join(File.dirname(`node --print "require.resolve('expo/package.json')"`), "scripts/autolinking")
```

Run CocoaPods after the native project is in place:

```sh
cd mobile/cli/ios
pod install
cd ../../..
```

## Android

In `mobile/cli/android/settings.gradle`, add the Expo Gradle plugin build to
`pluginManagement`, apply `expo-autolinking-settings`, and configure Expo
module discovery alongside React Native autolinking:

```groovy
pluginManagement {
  includeBuild("../node_modules/@react-native/gradle-plugin")
  includeBuild("../node_modules/expo-modules-autolinking/android/expo-gradle-plugin")
}
plugins {
  id("com.facebook.react.settings")
  id("expo-autolinking-settings")
}
extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
  ex.autolinkLibrariesFromCommand()
}
extensions.configure(expo.modules.ExpoAutolinkingSettingsExtension) { ex ->
  ex.useExpoModules()
}
```

Merge those entries with the template's existing settings. Keep its existing
`includeBuild` for the React Native Gradle plugin only once.

In `mobile/cli/android/app/build.gradle`, set both `namespace` and
`applicationId` to `com.example.mobilecli`. Move the generated Kotlin source
files into `android/app/src/main/java/com/example/mobilecli/` and change their
package declarations to `com.example.mobilecli`.

In `mobile/cli/android/app/src/main/AndroidManifest.xml`, add this intent filter
to the generated `MainActivity` activity:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="mobilecli" android:host="auth" android:path="/callback" />
</intent-filter>
```

Expo autolinking discovers the installed Expo modules used by this shell:
`expo-secure-store`, `expo-web-browser`, `expo-crypto`, `expo-linking`, and
`expo-file-system`. Do not add manual native package registrations for them.
