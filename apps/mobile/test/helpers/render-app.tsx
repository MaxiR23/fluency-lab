// Test helper (not a test file): renders the real routes under the real root
// layout with a faked auth port. Call resetFakeAuth() in beforeEach. Each test file mocks "expo-font",
// "expo-splash-screen" and "@/auth" itself, as jest.mock only hoists there.

import { act } from "@testing-library/react-native";
import { type Href, router } from "expo-router";
import { renderRouter } from "expo-router/testing-library";

import RootLayout from "@/app/_layout";
import ApiKey from "@/app/api-key";
import Chat from "@/app/chat";
import Chats from "@/app/chats";
import CreateAccount from "@/app/create-account";
import ForgotPassword from "@/app/forgot-password";
import Home from "@/app/(tabs)/index";
import Progress from "@/app/(tabs)/progress";
import Settings from "@/app/(tabs)/settings";
import TabsLayout from "@/app/(tabs)/_layout";
import EditProfile from "@/app/edit-profile";
import Onboarding from "@/app/onboarding";
import Profile from "@/app/profile";
import ResetPassword from "@/app/reset-password";
import SignIn from "@/app/sign-in";
import Suggestions from "@/app/suggestions";
import type { AuthSession } from "@/auth/auth-port";
import { emitSession } from "./fake-auth";

export async function renderApp(initialUrl: string, session: AuthSession | null) {
  const result = await renderRouter(
    {
      _layout: RootLayout,
      "(tabs)/_layout": TabsLayout,
      "(tabs)/index": Home,
      "(tabs)/progress": Progress,
      "(tabs)/settings": Settings,
      chat: Chat,
      chats: Chats,
      profile: Profile,
      "edit-profile": EditProfile,
      suggestions: Suggestions,
      "api-key": ApiKey,
      onboarding: Onboarding,
      "sign-in": SignIn,
      "create-account": CreateAccount,
      "forgot-password": ForgotPassword,
      "reset-password": ResetPassword,
    },
    { initialUrl },
  );
  await act(async () => emitSession(session));
  return result;
}

// INFO: the session arrives after the first render, and a route behind a guard is
// denied until it does. So a signed in test lands on Home first, then goes to the path.
export async function renderAppAt(path: Href, session: AuthSession) {
  const result = await renderApp("/", session);
  await act(async () => router.push(path));
  return result;
}
