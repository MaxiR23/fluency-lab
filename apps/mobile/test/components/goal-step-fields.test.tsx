// apps/mobile/test/components/goal-step-fields.test.tsx
//
// Tests for GoalStepFields.
//
// Tested:
// - Every goal is drawn as a checkbox, the chosen ones are checked
// - Pressing a goal calls onToggle with it
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/goal-step-fields.test.tsx
//
// SEE: apps/mobile/src/components/goal-step-fields.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { GoalStepFields } from "@/components/goal-step-fields";
import { goalOptions } from "@/utils/onboarding-options";

describe("GoalStepFields", () => {
  it("draws every goal and checks the chosen ones", async () => {
    await render(<GoalStepFields value={["work"]} onToggle={jest.fn()} />);
    for (const option of goalOptions) {
      expect(screen.getByRole("checkbox", { name: option.label })).toBeTruthy();
    }
    const work = goalOptions.find((option) => option.id === "work");
    expect(
      screen.getByRole("checkbox", { name: work?.label }).props.accessibilityState,
    ).toMatchObject({ checked: true });
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(1);
  });

  it("checks none when no goal is chosen", async () => {
    await render(<GoalStepFields value={[]} onToggle={jest.fn()} />);
    expect(screen.queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
  });

  it("calls onToggle with the pressed goal", async () => {
    const onToggle = jest.fn();
    await render(<GoalStepFields value={[]} onToggle={onToggle} />);
    await fireEvent.press(screen.getByRole("checkbox", { name: goalOptions[1].label }));
    expect(onToggle).toHaveBeenCalledWith(goalOptions[1].id);
  });
});
