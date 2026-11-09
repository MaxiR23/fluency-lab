import type { ExpoConfig } from "expo/config";
import { withEntitlementsPlist, type ConfigPlugin } from "expo/config-plugins";

// INFO: Expo loads this file without tsx, so it cannot import another TS file;
// the variant choice lives here and is exported for its tests.
export function appConfigFor(variant: string | undefined): ExpoConfig {
  const appleSignIn = variant !== "personal";
  return {
    name: "Fluency Lab",
    slug: "fluency-lab",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "fluencylab",
    userInterfaceStyle: "dark",
    backgroundColor: "#000000",
    ios: {
      bundleIdentifier: "com.maxirebolo.fluencylab",
      usesAppleSignIn: appleSignIn,
      icon: "./assets/expo.icon",
    },
    android: {
      package: "com.maxirebolo.fluencylab",
      adaptiveIcon: {
        backgroundColor: "#000000",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "server",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#000000",
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
        },
      ],
      "expo-sqlite",
      ...(appleSignIn ? ["expo-apple-authentication"] : []),
      "expo-secure-store",
      "expo-localization",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: { appleSignIn },
  };
}

const APPLE_SIGN_IN_ENTITLEMENT = "com.apple.developer.applesignin";

// INFO: the Apple plugin writes this key whenever the package is installed, because
// prebuild auto-applies it (withVersionedExpoSDKPlugins), even when it is not listed.
export function withoutAppleSignInEntitlement<V>(
  entitlements: Record<string, V>,
): Record<string, V> {
  return Object.fromEntries(
    Object.entries(entitlements).filter(([key]) => key !== APPLE_SIGN_IN_ENTITLEMENT),
  );
}

// INFO: mods run last-registered first; this one is registered when the config is
// read, before every plugin, so it runs after the auto-applied Apple plugin.
export const withoutAppleSignIn: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (mod) => {
    mod.modResults = withoutAppleSignInEntitlement(mod.modResults);
    return mod;
  });

// INFO: APP_VARIANT is a build-time variable for this file only; it is not
// EXPO_PUBLIC_, so the bundle never sees it. The app reads extra.appleSignIn.
export default function config(): ExpoConfig {
  const base = appConfigFor(process.env.APP_VARIANT);
  return base.ios?.usesAppleSignIn ? base : withoutAppleSignIn(base);
}
