// apps/mobile/test/components/chat-footer.test.tsx
//
// Tests for ChatFooter.
//
// Tested:
// - The footer rides on the keyboard with the layout offset and clears the safe area
//
// What is covered:
// - Normal case, edges (no inset, home indicator, tall navigation bar)
//
// Run with: pnpm exec jest apps/mobile/test/components/chat-footer.test.tsx
//
// SEE: apps/mobile/src/components/chat-footer.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ChatFooter } from "@/components/chat-footer";
import { colors } from "@/constants/theme";
import { chatKeyboardLayout } from "@/utils/chat-keyboard";

function footer(bottom: number) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom },
      }}
    >
      <ChatFooter>
        <Text>Inside</Text>
      </ChatFooter>
    </SafeAreaProvider>
  );
}

describe("ChatFooter", () => {
  it.each([0, 34, 48])(
    "rides on the keyboard with the layout of a %s bottom inset",
    async (bottom) => {
      await render(footer(bottom));
      const host = screen.getByTestId("chat-footer");
      const layout = chatKeyboardLayout(bottom);
      expect(host.props.offset).toEqual({ opened: layout.stickyOffset });
      expect(StyleSheet.flatten(host.props.style)).toMatchObject({
        paddingBottom: layout.composerBottom,
        backgroundColor: colors.background,
      });
    },
  );

  it("draws its children", async () => {
    await render(footer(0));
    expect(screen.getByText("Inside")).toBeTruthy();
  });
});
