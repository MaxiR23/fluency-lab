import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { isFontLoadSettled } from "@/utils/font-load";
import { fontFamily } from "@/constants/theme";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [fontFamily.regular]: PlusJakartaSans_400Regular,
    [fontFamily.semibold]: PlusJakartaSans_600SemiBold,
  });
  const settled = isFontLoadSettled(loaded, error);

  useEffect(() => {
    if (settled) {
      SplashScreen.hide();
    }
  }, [settled]);

  if (!settled) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
