import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";

import { OnboardingProvider, useOnboarding } from "@/hooks/use-onboarding";
import { SessionProvider, useSession } from "@/hooks/use-session";
import { appEntry } from "@/utils/onboarding-gate";
import { isFontLoadSettled } from "@/utils/font-load";
import { darkNavigationTheme } from "@/utils/navigation-theme";
import { isAppReady } from "@/utils/session-state";
import { colors, fontFamily } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

// INFO: the native stack paints its container with the navigation theme's background
// during transitions, and the root view sits behind it; both default to light.
SystemUI.setBackgroundColorAsync(colors.background);

const navigationTheme = darkNavigationTheme(DarkTheme);

function RootNavigator({ fontsSettled }: { fontsSettled: boolean }) {
  const { state } = useSession();
  const { gate, userId } = useOnboarding();
  const ready = isAppReady(fontsSettled, state);
  const entry = appEntry(userId, gate);

  useEffect(() => {
    if (ready) {
      SplashScreen.hide();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  // INFO: a user denied a screen lands on the first available one. So onboarding
  // sits before the auth group: a signed in user who has not finished it lands
  // there. Sign-in stays the first screen of the last guard, for a signed out user.
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Protected guard={entry === "home"}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="api-key" />
        <Stack.Screen name="suggestions" />
      </Stack.Protected>
      <Stack.Protected guard={entry === "onboarding"}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={entry === "signed_out"}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="create-account" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [fontFamily.regular]: PlusJakartaSans_400Regular,
    [fontFamily.semibold]: PlusJakartaSans_600SemiBold,
    [fontFamily.bold]: PlusJakartaSans_700Bold,
  });

  return (
    <ThemeProvider value={navigationTheme}>
      <SessionProvider>
        <OnboardingProvider>
          <RootNavigator fontsSettled={isFontLoadSettled(loaded, error)} />
        </OnboardingProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
