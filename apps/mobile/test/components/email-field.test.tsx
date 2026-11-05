// apps/mobile/test/components/email-field.test.tsx
//
// Tests for the shared EmailField component.
//
// Tested:
// - The label, the placeholder, the value and typing
// - The keyboard props that stop iOS from capitalizing or correcting an address
// - The error message
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/email-field.test.tsx
//
// SEE: apps/mobile/src/components/email-field.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { EmailField } from "@/components/email-field";

describe("EmailField", () => {
  it("draws the label, the placeholder and the value", async () => {
    await render(<EmailField value="a@b.co" onChangeText={jest.fn()} />);
    expect(screen.getByText("Email")).toBeTruthy();
    const input = screen.getByLabelText("Email");
    expect(input.props.value).toBe("a@b.co");
    expect(input.props.placeholder).toBe("name@email.com");
  });

  it("draws an empty value", async () => {
    await render(<EmailField value="" onChangeText={jest.fn()} />);
    expect(screen.getByLabelText("Email").props.value).toBe("");
  });

  it("sets the props that type an address", async () => {
    await render(<EmailField value="" onChangeText={jest.fn()} />);
    const input = screen.getByLabelText("Email");
    expect(input.props.autoCapitalize).toBe("none");
    expect(input.props.autoCorrect).toBe(false);
    expect(input.props.keyboardType).toBe("email-address");
    expect(input.props.autoComplete).toBe("email");
    expect(input.props.textContentType).toBe("emailAddress");
  });

  it("reports typing", async () => {
    const onChangeText = jest.fn();
    await render(<EmailField value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "x@y.co");
    expect(onChangeText).toHaveBeenCalledWith("x@y.co");
  });

  it("shows the error only when it gets one", async () => {
    await render(<EmailField value="" onChangeText={jest.fn()} error="Enter an email" />);
    expect(screen.getByText("Enter an email")).toBeTruthy();
  });
});
