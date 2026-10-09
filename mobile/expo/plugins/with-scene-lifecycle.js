const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// The iOS 27 SDK refuses to launch an app that has not adopted the scene life cycle, and the
// SDK 57 prebuild template still starts React Native from the app delegate. Expo ships the scene
// delegate. This hands it the window and the start.
const FACTORY_PROVIDER = 'ExpoReactNativeFactoryProvider';
const SCENE_DELEGATE_CLASS = 'EXExpoAppSceneDelegate';
const SCENE_CONFIGURATION_NAME = 'Default Configuration';
const APP_DELEGATE_CLASS = 'class AppDelegate: ExpoAppDelegate {';
const WINDOW_START =
  /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([^)]*\)\n#endif\n\n?/;
const TEMPLATE_CHANGED = 'The app delegate template changed: the scene life cycle was not applied.';

/** The scene delegate creates the window, so the app delegate only keeps the factory. */
function adoptScenes(contents) {
  if (contents.includes(FACTORY_PROVIDER)) return contents;
  if (!contents.includes(APP_DELEGATE_CLASS) || !WINDOW_START.test(contents)) {
    throw new Error(TEMPLATE_CHANGED);
  }
  return contents
    .replace(APP_DELEGATE_CLASS, `class AppDelegate: ExpoAppDelegate, ${FACTORY_PROVIDER} {`)
    .replace(WINDOW_START, '');
}

function withSceneLifecycle(config) {
  const withDelegate = withAppDelegate(config, (mod) => {
    mod.modResults.contents = adoptScenes(mod.modResults.contents);
    return mod;
  });
  return withInfoPlist(withDelegate, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: SCENE_CONFIGURATION_NAME,
            UISceneDelegateClassName: SCENE_DELEGATE_CLASS,
          },
        ],
      },
    };
    return mod;
  });
}

module.exports = withSceneLifecycle;
module.exports.adoptScenes = adoptScenes;
