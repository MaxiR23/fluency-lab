// apps/mobile/test/components/step-screen.test.tsx
//
// Tests for StepScreen.
//
// Tested:
// - The frame of an onboarding step: Back, progress, title, content and footer
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/step-screen.test.tsx
//
// SEE: apps/mobile/src/components/step-screen.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import { StepScreen } from "@/components/step-screen";

describe("StepScreen", () => {
  it("draws the title, the step label and the footer", async () => {
    await render(
      <StepScreen step={3} total={4} title="Topics" footer={<Text>Footer</Text>}>
        <Text>Inside</Text>
      </StepScreen>,
    );
    expect(screen.getByText("Topics")).toBeTruthy();
    expect(screen.getByText("Step 3 of 4")).toBeTruthy();
    expect(screen.getByText("Inside")).toBeTruthy();
    expect(screen.getByText("Footer")).toBeTruthy();
  });

  it("draws Back and calls onBack when given", async () => {
    const onBack = jest.fn();
    await render(<StepScreen step={2} total={4} title="Goal" onBack={onBack} footer={null} />);
    await fireEvent.press(screen.getByRole("link", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("keeps Back drawn but inert when backDisabled", async () => {
    const onBack = jest.fn();
    await render(
      <StepScreen step={2} total={4} title="Goal" onBack={onBack} backDisabled footer={null} />,
    );
    expect(screen.getByText("Back")).toBeTruthy();
    // INFO: fireEvent walks up to the TextLink's own onPress prop, so the check is
    // on the text that reaches the screen: it must hold no handler.
    expect(screen.getByText("Back").props.onPress).toBeUndefined();
    expect(screen.getByText("Back").props.disabled).toBe(true);
    expect(onBack).not.toHaveBeenCalled();
  });

  it("draws no Back when onBack is missing", async () => {
    await render(<StepScreen step={1} total={4} title="Level" footer={null} />);
    expect(screen.queryByText("Back")).toBeNull();
  });

  it("draws no step label when step and total are not given", async () => {
    await render(<StepScreen title="Your AI" footer={null} />);
    expect(screen.getByText("Your AI")).toBeTruthy();
    expect(screen.queryByText(/^Step /)).toBeNull();
  });
});
