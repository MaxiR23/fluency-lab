// apps/mobile/test/components/arc-spinner.test.tsx
//
// Tests for ArcSpinner, the spinner arc of offline-retrying.html.
//
// Tested:
// - The arc at the spinner size and stroke, hidden from accessibility
// - It turns to 360 degrees in one spin cycle, linear and forever, and stands still with spin null
//
// What is covered:
// - Normal case, reduce motion
//
// Run with: pnpm exec jest apps/mobile/test/components/arc-spinner.test.tsx
//
// SEE: apps/mobile/src/components/arc-spinner.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { processColor, StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";

import { ArcSpinner } from "@/components/arc-spinner";
import { colors, motion, size, strokeWidth } from "@/constants/theme";

// INFO: Reanimated frames do not advance under jest, so the turn is proven by the arguments
// withTiming and withRepeat are called with: both are wrapped to record them and still return the real value.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual<typeof Reanimated>("react-native-reanimated");
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    withTiming: jest.fn(actual.withTiming),
    withRepeat: jest.fn(actual.withRepeat),
  };
});

function spinner() {
  return screen.getByTestId("arc-spinner", { includeHiddenElements: true });
}

describe("ArcSpinner", () => {
  it("draws the arc at the spinner size and stroke in the accent color", async () => {
    await render(<ArcSpinner spin={motion.offline.spinCycle} color={colors.accent} />);
    const icon = screen.getByTestId("icon-arc", { includeHiddenElements: true });
    expect(icon.props.width).toBe(size.iconSpinner);
    expect(icon.props.height).toBe(size.iconSpinner);
    const drawn = JSON.stringify(screen.toJSON());
    expect(drawn).toContain('"d":"M12 3a9 9 0 1 0 9 9"');
    expect(drawn).toContain(`"strokeWidth":${strokeWidth.spinner}`);
    expect(drawn).toContain(`"payload":${String(processColor(colors.accent))}`);
  });

  it("turns to 360 degrees in one spin cycle, linear, forever", async () => {
    const withTiming = jest.mocked(Reanimated.withTiming);
    const withRepeat = jest.mocked(Reanimated.withRepeat);
    withTiming.mockClear();
    withRepeat.mockClear();
    await render(<ArcSpinner spin={900} color={colors.accent} />);
    expect(withTiming).toHaveBeenCalledWith(360, {
      duration: 900,
      easing: Reanimated.Easing.linear,
    });
    expect(withRepeat.mock.calls.map(([, reps]) => reps)).toEqual([-1]);
  });

  it("stands still with reduce motion (spin null)", async () => {
    const withTiming = jest.mocked(Reanimated.withTiming);
    withTiming.mockClear();
    await render(<ArcSpinner spin={null} color={colors.accent} />);
    expect(withTiming).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(spinner().props.style).transform).toEqual([{ rotate: "0deg" }]);
  });

  it("is hidden from accessibility", async () => {
    await render(<ArcSpinner spin={900} color={colors.accent} />);
    expect(spinner().props.accessibilityElementsHidden).toBe(true);
    expect(spinner().props.importantForAccessibility).toBe("no-hide-descendants");
  });
});
