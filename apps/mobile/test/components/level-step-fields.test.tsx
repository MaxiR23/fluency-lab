// apps/mobile/test/components/level-step-fields.test.tsx
//
// Tests for LevelStepFields.
//
// Tested:
// - Every level is drawn as a radio, the chosen one is selected
// - Pressing a level calls onChange with it
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/level-step-fields.test.tsx
//
// SEE: apps/mobile/src/components/level-step-fields.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { LevelStepFields } from "@/components/level-step-fields";
import { levelOptions } from "@/utils/onboarding-options";

describe("LevelStepFields", () => {
  it("draws every level and marks the chosen one", async () => {
    await render(<LevelStepFields value="intermediate" onChange={jest.fn()} />);
    for (const option of levelOptions) {
      expect(screen.getByRole("radio", { name: option.label })).toBeTruthy();
      expect(screen.getByText(option.description)).toBeTruthy();
    }
    expect(
      screen.getByRole("radio", { name: "Intermediate" }).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(screen.getByRole("radio", { name: "Beginner" }).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it("marks none when there is no level", async () => {
    await render(<LevelStepFields value={null} onChange={jest.fn()} />);
    expect(screen.queryAllByRole("radio", { selected: true })).toHaveLength(0);
  });

  it("calls onChange with the pressed level", async () => {
    const onChange = jest.fn();
    await render(<LevelStepFields value={null} onChange={onChange} />);
    await fireEvent.press(screen.getByRole("radio", { name: "Advanced" }));
    expect(onChange).toHaveBeenCalledWith("advanced");
  });
});
