// apps/mobile/test/components/segmented-control.test.tsx
//
// Tests for SegmentedControl.
//
// Tested:
// - One radio per option, the selected value and the change
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/segmented-control.test.tsx
//
// SEE: apps/mobile/src/components/segmented-control.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { SegmentedControl } from "@/components/segmented-control";

const options = [
  { id: "claude", label: "Claude" },
  { id: "openai", label: "OpenAI" },
] as const;

describe("SegmentedControl", () => {
  it("draws one radio per option with the value selected", async () => {
    await render(
      <SegmentedControl label="Provider" options={options} value="claude" onChange={jest.fn()} />,
    );
    expect(screen.getByLabelText("Provider")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Claude" }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByRole("radio", { name: "OpenAI" }).props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it("calls onChange with the pressed option", async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl label="Provider" options={options} value="claude" onChange={onChange} />,
    );
    await fireEvent.press(screen.getByRole("radio", { name: "OpenAI" }));
    expect(onChange).toHaveBeenCalledWith("openai");
  });

  it("does not call onChange when the selected option is pressed", async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl label="Provider" options={options} value="claude" onChange={onChange} />,
    );
    await fireEvent.press(screen.getByRole("radio", { name: "Claude" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
