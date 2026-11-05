import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { SessionProvider, useSession } from "@/hooks/use-session";
import { isFontLoadSettled } from "@/utils/font-load";
import { isAppReady } from "@/utils/session-state";
import { colors, fontFamily } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

function RootNavigator({ fontsSettled }: { fontsSettled: boolean }) {
  const { state, signedIn } = useSession();
  const ready = isAppReady(fontsSettled, state);

  useEffect(() => {
    if (ready) {
      SplashScreen.hide();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  // INFO: sign-in must stay the first screen of the second guard: a signed out
  // user denied Home lands on the first available screen.
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
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
    <SessionProvider>
      <RootNavigator fontsSettled={isFontLoadSettled(loaded, error)} />
    </SessionProvider>
  );
}
