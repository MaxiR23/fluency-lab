// apps/mobile/test/components/flame.test.tsx
//
// Tests for Flame, the perfect day of the week strip.
//
// Tested:
// - The flame's four shapes, its glow and its hidden accessibility
// - The flick loops to the keyframe targets, and stays still with reduce motion (flick null)
//
// What is covered:
// - Normal case, reduce motion
//
// Run with: pnpm exec jest apps/mobile/test/components/flame.test.tsx
//
// SEE: apps/mobile/src/components/flame.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import * as Reanimated from "react-native-reanimated";

import { Flame } from "@/components/flame";
import { shadow } from "@/constants/theme";
import { flickSteps, homeMotion } from "@/utils/practice-motion";

// INFO: Reanimated frames do not advance under jest, so the flick is proven by the targets
// withTiming is called with: it is wrapped to record them and still return the real value.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual<typeof Reanimated>("react-native-reanimated");
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    withTiming: jest.fn(actual.withTiming),
  };
});

const REST = [{ scaleX: 1 }, { scaleY: 1 }, { skewX: "0deg" }];

function flick() {
  const home = homeMotion(false);
  if (home === null) throw new Error("home motion is on without reduce motion");
  return home.flame;
}

describe("Flame", () => {
  it("draws the body, the darker side, the inner flame and the highlight", async () => {
    await render(<Flame flick={null} />);
    for (const id of ["flame-body", "flame-shade", "flame-core", "flame-highlight"]) {
      expect(screen.getByTestId(id, { includeHiddenElements: true })).toBeTruthy();
    }
  });

  it("glows with the shared flame glow", async () => {
    await render(<Flame flick={null} />);
    const style = StyleSheet.flatten(
      screen.getByTestId("flame", { includeHiddenElements: true }).props.style,
    );
    expect(style).toMatchObject(shadow.flameGlow);
  });

  it("starts the flick at rest", async () => {
    await render(<Flame flick={flick()} />);
    const style = StyleSheet.flatten(
      screen.getByTestId("flame", { includeHiddenElements: true }).props.style,
    );
    expect(style.transform).toEqual(REST);
  });

  it("flicks to the design's keyframes", async () => {
    const withTiming = jest.mocked(Reanimated.withTiming);
    withTiming.mockClear();
    const motion = flick();
    await render(<Flame flick={motion} />);
    const steps = flickSteps(motion);
    const targets = [...steps.scaleX, ...steps.scaleY, ...steps.skewX].map((step) => step.to);
    expect(withTiming.mock.calls.map(([target]) => target)).toEqual(targets);
    expect(targets).toHaveLength(12);
  });

  it("stays still with reduce motion", async () => {
    const withTiming = jest.mocked(Reanimated.withTiming);
    withTiming.mockClear();
    await render(<Flame flick={null} />);
    expect(withTiming).not.toHaveBeenCalled();
    const style = StyleSheet.flatten(
      screen.getByTestId("flame", { includeHiddenElements: true }).props.style,
    );
    expect(style.transform).toEqual(REST);
  });
});
