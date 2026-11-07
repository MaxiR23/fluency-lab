// apps/mobile/test/components/today-practice-card.test.tsx
//
// Tests for TodayPracticeCard.
//
// Tested:
// - It reads today's practice as one button with its title and meta
// - It draws the ring, the eyebrow, the title, the meta, the chips and the action
// - It calls onPress
//
// What is covered:
// - Normal case, no chips, reduce motion
//
// Run with: pnpm exec jest apps/mobile/test/components/today-practice-card.test.tsx
//
// SEE: apps/mobile/src/components/today-practice-card.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { TodayPracticeCard } from "@/components/today-practice-card";
import { homeMotion } from "@/utils/practice-motion";
import type { TodayCard } from "@/utils/today-practice";

const card: TodayCard = {
  answered: 2,
  target: 5,
  fraction: 0.4,
  ringLabel: "2/5",
  title: "From your mistakes",
  meta: "3 left · about 4 min",
  chips: ["Present perfect", "Articles"],
  action: "Keep going",
  open: { kind: "run", runId: "run-1" },
};

describe("TodayPracticeCard", () => {
  it("reads today's practice as one button", async () => {
    await render(<TodayPracticeCard card={card} onPress={jest.fn()} motion={null} />);
    expect(
      screen.getByRole("button", {
        name: "Today's practice, From your mistakes, 3 left · about 4 min",
      }),
    ).toBeTruthy();
  });

  it("draws the ring, the eyebrow, the title, the meta and the action", async () => {
    await render(<TodayPracticeCard card={card} onPress={jest.fn()} motion={null} />);
    expect(screen.getByText("2/5")).toBeTruthy();
    expect(screen.getByText("Today's practice")).toBeTruthy();
    expect(screen.getByText("From your mistakes")).toBeTruthy();
    expect(screen.getByText("3 left · about 4 min")).toBeTruthy();
    expect(screen.getByText("Keep going")).toBeTruthy();
    expect(screen.getByTestId("icon-arrow", { includeHiddenElements: true })).toBeTruthy();
  });

  it("draws the chips", async () => {
    await render(<TodayPracticeCard card={card} onPress={jest.fn()} motion={null} />);
    expect(screen.getByText("Present perfect")).toBeTruthy();
    expect(screen.getByText("Articles")).toBeTruthy();
  });

  it("draws no chip row without chips", async () => {
    await render(
      <TodayPracticeCard card={{ ...card, chips: [] }} onPress={jest.fn()} motion={null} />,
    );
    expect(screen.queryByTestId("today-chips")).toBeNull();
  });

  it("calls onPress", async () => {
    const onPress = jest.fn();
    await render(<TodayPracticeCard card={card} onPress={onPress} motion={null} />);
    await fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("draws the same card when it moves", async () => {
    await render(<TodayPracticeCard card={card} onPress={jest.fn()} motion={homeMotion(false)} />);
    expect(screen.getByText("Keep going")).toBeTruthy();
    expect(screen.getByTestId("today-glow")).toBeTruthy();
  });
});
