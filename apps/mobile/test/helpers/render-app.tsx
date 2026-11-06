// Test helper (not a test file): renders the real routes under the real root
// layout with a faked auth port. Call resetFakeAuth() in beforeEach. Each test file mocks "expo-font",
// "expo-splash-screen" and "@/auth" itself, as jest.mock only hoists there.

import { act } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import RootLayout from "@/app/_layout";
import CreateAccount from "@/app/create-account";
import ForgotPassword from "@/app/forgot-password";
import Home from "@/app/index";
import Onboarding from "@/app/onboarding";
import ResetPassword from "@/app/reset-password";
import SignIn from "@/app/sign-in";
import type { AuthSession } from "@/auth/auth-port";
import { emitSession } from "./fake-auth";

export async function renderApp(initialUrl: string, session: AuthSession | null) {
  const result = await renderRouter(
    {
      _layout: RootLayout,
      index: Home,
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
