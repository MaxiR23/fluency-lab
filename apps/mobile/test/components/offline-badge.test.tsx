// apps/mobile/test/components/offline-badge.test.tsx
//
// Tests for OfflineBadge, the crossed cloud of the can't-connect screens.
//
// Tested:
// - The cloud in the accent color and its hidden accessibility
// - The two rings of the large badge: their loops, and no rings on the small badge or without motion
//
// What is covered:
// - Normal case, reduce motion, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/offline-badge.test.tsx
//
// SEE: apps/mobile/src/components/offline-badge.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { processColor, StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";

import { OfflineBadge } from "@/components/offline-badge";
import { colors } from "@/constants/theme";
import { offlineMotion } from "@/utils/offline-motion";

// INFO: Reanimated frames do not advance under jest, so the loops are proven by the arguments
// withTiming, withRepeat and withDelay are called with: they are wrapped to record them and still
// return the real value.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual<typeof Reanimated>("react-native-reanimated");
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    withTiming: jest.fn(actual.withTiming),
    withRepeat: jest.fn(actual.withRepeat),
    withDelay: jest.fn(actual.withDelay),
  };
});

function motion() {
  const built = offlineMotion(false);
  if (built === null) throw new Error("offline motion is off without reduce motion");
  return built;
}

function rings() {
  return screen.queryAllByTestId("offline-ring", { includeHiddenElements: true });
}

describe("OfflineBadge", () => {
  it("draws the crossed cloud in the accent color", async () => {
    await render(<OfflineBadge look="large" motion={null} />);
    expect(screen.getByTestId("icon-cloudOff", { includeHiddenElements: true })).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain(
      `"payload":${String(processColor(colors.accent))}`,
    );
  });

  it("draws two rings around the large badge with motion", async () => {
    await render(<OfflineBadge look="large" motion={motion()} />);
    expect(rings()).toHaveLength(2);
    const style = StyleSheet.flatten(rings()[0]?.props.style);
    expect(style.transform).toEqual([{ scale: 0.8 }]);
    expect(style.opacity).toBe(0.6);
  });

  it("loops each ring from .8 to 1.6 and from .6 to 0 in 2400 ms on ease-out, the second after 1200 ms", async () => {
    const withTiming = jest.mocked(Reanimated.withTiming);
    const withRepeat = jest.mocked(Reanimated.withRepeat);
    const withDelay = jest.mocked(Reanimated.withDelay);
    withTiming.mockClear();
    withRepeat.mockClear();
    withDelay.mockClear();
    await render(<OfflineBadge look="large" motion={motion()} />);
    const timing = { duration: 2400, easing: expect.objectContaining({ bezier: [0, 0, 0.58, 1] }) };
    expect(withTiming.mock.calls).toEqual([
      [1.6, timing],
      [0, timing],
      [1.6, timing],
      [0, timing],
    ]);
    expect(withRepeat.mock.calls.map(([, reps]) => reps)).toEqual([-1, -1, -1, -1]);
    expect(withDelay.mock.calls.map(([delay]) => delay)).toEqual([0, 0, 1200, 1200]);
  });

  it("draws no rings with reduce motion (motion null)", async () => {
    const withTiming = jest.mocked(Reanimated.withTiming);
    withTiming.mockClear();
    await render(<OfflineBadge look="large" motion={null} />);
    expect(rings()).toHaveLength(0);
    expect(withTiming).not.toHaveBeenCalled();
  });

  it("draws no rings on the small badge", async () => {
    await render(<OfflineBadge look="small" motion={motion()} />);
    expect(rings()).toHaveLength(0);
    expect(screen.getByTestId("icon-cloudOff", { includeHiddenElements: true })).toBeTruthy();
  });

  it("hides the badge from accessibility", async () => {
    await render(<OfflineBadge look="large" motion={motion()} />);
    const badge = screen.getByTestId("offline-badge", { includeHiddenElements: true });
    expect(badge.props.accessibilityElementsHidden).toBe(true);
    expect(badge.props.importantForAccessibility).toBe("no-hide-descendants");
  });
});
