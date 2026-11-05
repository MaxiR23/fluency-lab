// apps/mobile/test/components/failure-message.test.tsx
//
// Tests for the shared FailureMessage component.
//
// Tested:
// - The failure message as an alert
// - The cause line under it in development only
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/failure-message.test.tsx
//
// SEE: apps/mobile/src/components/failure-message.tsx

import { afterEach, describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { FailureMessage } from "@/components/failure-message";
import { textStyle } from "@/components/text-style";

const cause = { name: "AuthRetryableFetchError", detail: "offline" };
const savedDev = __DEV__;

// INFO: react-native declares __DEV__ as a constant, so the test redefines the global.
function setDev(value: boolean) {
  Object.defineProperty(globalThis, "__DEV__", { value, writable: true, configurable: true });
}

describe("FailureMessage", () => {
  afterEach(() => {
    setDev(savedDev);
  });

  it("draws the message as an alert in the error style", async () => {
    await render(<FailureMessage message="Could not reach the server." />);
    const node = screen.getByRole("alert");
    expect(screen.getByText("Could not reach the server.")).toBe(node);
    expect(StyleSheet.flatten(node.props.style)).toEqual(textStyle("error"));
  });

  it("draws the cause under the message in the caption style in development", async () => {
    await render(<FailureMessage message="Could not reach the server." cause={cause} />);
    const line = screen.getByText("AuthRetryableFetchError: offline");
    expect(StyleSheet.flatten(line.props.style)).toEqual(textStyle("caption"));
  });

  it("draws only the message when there is no cause", async () => {
    await render(<FailureMessage message="Could not reach the server." />);
    expect(screen.queryByText(/AuthRetryableFetchError/)).toBeNull();
  });

  it("draws only the message outside development", async () => {
    setDev(false);
    await render(<FailureMessage message="Could not reach the server." cause={cause} />);
    expect(screen.getByText("Could not reach the server.")).toBeTruthy();
    expect(screen.queryByText(/AuthRetryableFetchError/)).toBeNull();
  });
});
