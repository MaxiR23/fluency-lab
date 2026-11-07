// apps/mobile/test/components/week-strip.test.tsx
//
// Tests for WeekStrip.
//
// Tested:
// - The card: title, count, seven days, a check on each practiced day, labels
//
// What is covered:
// - Normal case, empty case
//
// Run with: pnpm exec jest apps/mobile/test/components/week-strip.test.tsx
//
// SEE: apps/mobile/src/components/week-strip.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

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
});
