// apps/mobile/test/components/quick-ask-chips.test.tsx
//
// Tests for QuickAskChips.
//
// Tested:
// - The chips as buttons in order, the press reporting its text, the disabled look and the sideways scroll
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/quick-ask-chips.test.tsx
//
// SEE: apps/mobile/src/components/quick-ask-chips.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { QuickAskChips } from "@/components/quick-ask-chips";

const asks = ["Why is it wrong?", "I think I was right", "Other ways"] as const;

describe("QuickAskChips", () => {
  it("draws the texts as buttons in order", async () => {
    await render(<QuickAskChips asks={asks} onAsk={() => {}} disabled={false} />);
    const names = screen.getAllByRole("button").map((b) => b.props.accessibilityLabel);
    expect(names).toEqual([...asks]);
  });

  it("pressing a chip calls onAsk with its text", async () => {
    const onAsk = jest.fn();
    await render(<QuickAskChips asks={asks} onAsk={onAsk} disabled={false} />);
    await fireEvent.press(screen.getByRole("button", { name: "I think I was right" }));
    expect(onAsk).toHaveBeenCalledWith("I think I was right");
    expect(onAsk).toHaveBeenCalledTimes(1);
  });

  it("draws the chips disabled and never calls onAsk", async () => {
    const onAsk = jest.fn();
    await render(<QuickAskChips asks={asks} onAsk={onAsk} disabled />);
    const chip = screen.getByRole("button", { name: "Other ways" });
    expect(chip.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(chip);
    expect(onAsk).not.toHaveBeenCalled();
  });

  it("scrolls sideways without an indicator and keeps taps while the keyboard is open", async () => {
    await render(<QuickAskChips asks={asks} onAsk={() => {}} disabled={false} />);
    const scroll = screen.getByTestId("quick-ask-chips");
    expect(scroll.props.horizontal).toBe(true);
    expect(scroll.props.showsHorizontalScrollIndicator).toBe(false);
    expect(scroll.props.keyboardShouldPersistTaps).toBe("handled");
  });

  it("draws nothing to press for no asks", async () => {
    await render(<QuickAskChips asks={[]} onAsk={() => {}} disabled={false} />);
    expect(screen.queryAllByRole("button")).toEqual([]);
  });
});
