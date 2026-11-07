// apps/mobile/test/components/week-strip.test.tsx
//
// Tests for WeekStrip.
//
// Tested:
// - The card: title, count, seven days, a check on each practiced day, labels
// - A perfect day draws the flame instead of the circle, pops with it today, and stands on the same baseline
//
// What is covered:
// - Normal case, empty case
//
// Run with: pnpm exec jest apps/mobile/test/components/week-strip.test.tsx
//
// SEE: apps/mobile/src/components/week-strip.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { WeekStrip } from "@/components/week-strip";
import { weekWith } from "../helpers/fake-data";

describe("WeekStrip", () => {
  it("draws seven days, the checks and the count", async () => {
    await render(<WeekStrip week={weekWith(["2026-11-02", "2026-11-04", "2026-11-05"])} />);
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText("3 of 7 days")).toBeTruthy();
    expect(screen.getAllByText(/^[MTWFS]$/)).toHaveLength(7);
    expect(screen.getAllByTestId("icon-check", { includeHiddenElements: true })).toHaveLength(3);
  });

  it("draws 0 of 7 days for an empty week", async () => {
    await render(<WeekStrip week={weekWith([])} />);
    expect(screen.getByText("0 of 7 days")).toBeTruthy();
    expect(screen.queryByTestId("icon-check", { includeHiddenElements: true })).toBeNull();
    expect(screen.getAllByText(/^[MTWFS]$/)).toHaveLength(7);
  });

  it("labels each day", async () => {
    await render(<WeekStrip week={weekWith(["2026-11-02"])} />);
    expect(screen.getByLabelText("Monday, practiced")).toBeTruthy();
    expect(screen.getByLabelText("Tuesday, not practiced")).toBeTruthy();
    expect(screen.getByLabelText("Sunday, not practiced")).toBeTruthy();
  });

  it("draws today's practiced circle with a pop and without one", async () => {
    const week = weekWith(["2026-11-05"]);
    const { rerender } = await render(<WeekStrip week={week} pop={null} />);
    expect(screen.getAllByTestId("icon-check", { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.queryByTestId("week-pop", { includeHiddenElements: true })).toBeNull();
    await rerender(
      <WeekStrip week={week} pop={{ delay: 980, up: 420, settle: 280, scale: 1.2 }} />,
    );
    expect(screen.getByTestId("week-pop", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getAllByTestId("icon-check", { includeHiddenElements: true })).toHaveLength(1);
  });

  it("does not pop a day that is not today", async () => {
    await render(
      <WeekStrip
        week={weekWith(["2026-11-02"])}
        pop={{ delay: 980, up: 420, settle: 280, scale: 1.2 }}
      />,
    );
    expect(screen.queryByTestId("week-pop", { includeHiddenElements: true })).toBeNull();
  });

  it("draws the flame instead of the circle and check on a perfect day", async () => {
    await render(
      <WeekStrip week={weekWith(["2026-11-02", "2026-11-03"], { perfectDays: ["2026-11-03"] })} />,
    );
    expect(screen.getAllByTestId("flame", { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getAllByTestId("icon-check", { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getByText("2 of 7 days · 1 perfect")).toBeTruthy();
    expect(screen.getByLabelText("Tuesday, perfect practice")).toBeTruthy();
    expect(screen.getByLabelText("Monday, practiced")).toBeTruthy();
  });

  it("draws the normal check for a practiced day that is not perfect", async () => {
    await render(<WeekStrip week={weekWith(["2026-11-02"])} />);
    expect(screen.queryByTestId("flame", { includeHiddenElements: true })).toBeNull();
    expect(screen.getAllByTestId("icon-check", { includeHiddenElements: true })).toHaveLength(1);
  });

  it("pops today's perfect day with its flame inside", async () => {
    await render(
      <WeekStrip
        week={weekWith(["2026-11-05"], { perfectDays: ["2026-11-05"] })}
        pop={{ delay: 980, up: 420, settle: 280, scale: 1.2 }}
      />,
    );
    const pop = screen.getByTestId("week-pop", { includeHiddenElements: true });
    expect(within(pop).getByTestId("flame", { includeHiddenElements: true })).toBeTruthy();
  });

  it("keeps every flame still with no flame motion", async () => {
    await render(
      <WeekStrip week={weekWith(["2026-11-03"], { perfectDays: ["2026-11-03"] })} flame={null} />,
    );
    const style = StyleSheet.flatten(
      screen.getByTestId("flame", { includeHiddenElements: true }).props.style,
    );
    expect(style.transform).toEqual([{ scaleX: 1 }, { scaleY: 1 }, { skewX: "0deg" }]);
  });

  it("stands the days on the same baseline", async () => {
    await render(<WeekStrip week={weekWith([])} />);
    const style = StyleSheet.flatten(screen.getByTestId("week-row").props.style);
    expect(style.alignItems).toBe("flex-end");
  });
});
