const assert = require('node:assert/strict');
const { test } = require('node:test');
const { adoptScenes } = require('../plugins/with-scene-lifecycle');

/** The app delegate the SDK 57 template generates, cut to the parts the plugin touches. */
const TEMPLATE = `@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  public override func application() -> Bool {
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

const ADOPTED = `@main
class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {
  var window: UIWindow?

  public override func application() -> Bool {
    reactNativeFactory = factory

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

test('hands the window and the React Native start to the scene delegate', () => {
  assert.equal(adoptScenes(TEMPLATE), ADOPTED);
});

test('leaves an app delegate that already adopted scenes as it is', () => {
  assert.equal(adoptScenes(ADOPTED), ADOPTED);
});

test('stops prebuild when the template no longer has the window start', () => {
  const changed = TEMPLATE.replace('window = UIWindow(frame: UIScreen.main.bounds)', '');

  assert.throws(() => adoptScenes(changed), {
    message: 'The app delegate template changed: the scene life cycle was not applied.',
  });
});

test('stops prebuild when the app delegate has another base class', () => {
  const changed = TEMPLATE.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate {');

  assert.throws(() => adoptScenes(changed), {
    message: 'The app delegate template changed: the scene life cycle was not applied.',
  });
});
