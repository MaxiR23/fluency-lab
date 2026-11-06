// apps/mobile/test/components/toggle-switch.test.tsx
//
// Tests for ToggleSwitch.
//
// Tested:
// - It is a switch with its checked state and label
// - Pressing it calls onChange with the opposite value
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/toggle-switch.test.tsx
//
// SEE: apps/mobile/src/components/toggle-switch.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ToggleSwitch } from "@/components/toggle-switch";

describe("ToggleSwitch", () => {
  it("is a switch with its checked state and label", async () => {
    await render(<ToggleSwitch label="Haptics" value onChange={jest.fn()} />);
    const toggle = screen.getByRole("switch", { name: "Haptics" });
    expect(toggle.props.accessibilityState).toMatchObject({ checked: true });
    await render(<ToggleSwitch label="Sounds" value={false} onChange={jest.fn()} />);
    expect(screen.getByRole("switch", { name: "Sounds" }).props.accessibilityState).toMatchObject({
      checked: false,
    });
  });

  it("calls onChange with the opposite value", async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<ToggleSwitch label="Haptics" value onChange={onChange} />);
    await fireEvent.press(screen.getByRole("switch", { name: "Haptics" }));
    expect(onChange).toHaveBeenLastCalledWith(false);
    await rerender(<ToggleSwitch label="Haptics" value={false} onChange={onChange} />);
    await fireEvent.press(screen.getByRole("switch", { name: "Haptics" }));
    expect(onChange).toHaveBeenLastCalledWith(true);
  });
});
