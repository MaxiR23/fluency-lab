// apps/mobile/test/components/score-ring.test.tsx
//
// Tests for ScoreRing.
//
// Tested:
// - It reads its score and draws its label and caption
// - The offset of the progress circle is final with no motion and starts full when it moves
// - The target of the animation is the offset of the score
// - The sparks and the halo exist only with motion
//
// What is covered:
// - Normal case, reduce motion, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/score-ring.test.tsx
//
// SEE: apps/mobile/src/components/score-ring.tsx

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import * as Reanimated from "react-native-reanimated";

import { ScoreRing } from "@/components/score-ring";
import { motion, size } from "@/constants/theme";
import { resultMotion, ringGeometry } from "@/utils/practice-motion";

// INFO: Reanimated styles do not advance under jest, so the animation is proven by the target
// the ring is animated to: withTiming is wrapped to record it and still return the real value.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual<typeof Reanimated>("react-native-reanimated");
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    withTiming: jest.fn(actual.withTiming),
  };
});

function progressOffset(): number {
  const circle = screen.getByTestId("score-ring-progress", { includeHiddenElements: true });
  return Number(circle.props.strokeDashoffset);
}

describe("ScoreRing", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("draws 4/5 right", async () => {
    await render(
      <ScoreRing size="large" fraction={0.8} label="4/5" caption="right" motion={null} />,
    );
    expect(screen.getByText("4/5")).toBeTruthy();
    expect(screen.getByText("right")).toBeTruthy();
    expect(screen.getByLabelText("4/5 right")).toBeTruthy();
  });

  it("draws the small ring with its count and no caption", async () => {
    await render(<ScoreRing size="small" fraction={0.4} label="2/5" motion={null} />);
    expect(screen.getByText("2/5")).toBeTruthy();
    expect(screen.getByLabelText("2/5")).toBeTruthy();
  });

  it("sets the final offset with no motion", async () => {
    await render(<ScoreRing size="small" fraction={0.4} label="2/5" motion={null} />);
    expect(progressOffset()).toBeCloseTo(ringGeometry(size.ringSmallRadius, 0.4).offset, 5);
    const circle = screen.getByTestId("score-ring-progress", { includeHiddenElements: true });
    const dash: unknown = circle.props.strokeDasharray;
    expect(Number(Array.isArray(dash) ? dash[0] : dash)).toBeCloseTo(
      ringGeometry(size.ringSmallRadius, 0.4).circumference,
      5,
    );
  });

  it("draws an empty ring at 0 and a full ring at 1", async () => {
    const { rerender } = await render(
      <ScoreRing size="small" fraction={0} label="0/5" motion={null} />,
    );
    expect(progressOffset()).toBeCloseTo(ringGeometry(size.ringSmallRadius, 0).circumference, 5);
    await rerender(<ScoreRing size="small" fraction={1} label="5/5" motion={null} />);
    expect(progressOffset()).toBeCloseTo(0, 5);
  });

  it("starts the progress circle full (empty ring) when it moves", async () => {
    await render(
      <ScoreRing
        size="large"
        fraction={0.8}
        label="4/5"
        caption="right"
        motion={resultMotion(false)}
      />,
    );
    expect(progressOffset()).toBeCloseTo(ringGeometry(size.ringLargeRadius, 0).circumference, 3);
  });

  it("calls withTiming with the final offset when moving", async () => {
    const withTiming = jest.mocked(Reanimated.withTiming);
    withTiming.mockClear();
    await render(
      <ScoreRing
        size="small"
        fraction={0.4}
        label="2/5"
        motion={{ ring: { delay: 0, duration: 100, curve: motion.ring } }}
      />,
    );
    const targets = withTiming.mock.calls.map(([target]) => target);
    expect(targets[0]).toBeCloseTo(ringGeometry(size.ringSmallRadius, 0.4).offset, 5);
  });

  it("draws no sparks with no motion", async () => {
    await render(
      <ScoreRing size="large" fraction={0.8} label="4/5" caption="right" motion={null} />,
    );
    expect(screen.queryByTestId("score-ring-spark-0", { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByTestId("score-ring-halo", { includeHiddenElements: true })).toBeNull();
  });

  it("draws three sparks and the halo when the large ring moves", async () => {
    await render(
      <ScoreRing
        size="large"
        fraction={0.8}
        label="4/5"
        caption="right"
        motion={resultMotion(false)}
      />,
    );
    for (const index of [0, 1, 2]) {
      expect(
        screen.getByTestId(`score-ring-spark-${index}`, { includeHiddenElements: true }),
      ).toBeTruthy();
    }
    expect(screen.getByTestId("score-ring-halo", { includeHiddenElements: true })).toBeTruthy();
  });
});
