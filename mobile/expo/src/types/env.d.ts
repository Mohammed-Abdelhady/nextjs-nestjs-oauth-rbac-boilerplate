declare const process: {
  readonly env: { readonly EXPO_PUBLIC_API_ORIGIN?: string };
};

/** React Native provides it at run time and leaves it out of its global types. */
declare const performance: { now(): number };
