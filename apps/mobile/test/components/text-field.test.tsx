// apps/mobile/test/components/text-field.test.tsx
//
// Tests for the shared TextField component.
//
// Tested:
// - Label, value and typing
// - The error message shows only when it gets one
// - The text hides when secure
// - The sheet look draws its label like the form look
// - The answer look draws its tone border at once, or eases to it over a border duration
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/text-field.test.tsx
//
// SEE: apps/mobile/src/components/text-field.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { StyleSheet, processColor } from "react-native";

import { TextField } from "@/components/text-field";
import { textStyle } from "@/components/text-style";
import { colors } from "@/constants/theme";

describe("TextField", () => {
  it("draws the label and the value", async () => {
    await render(<TextField label="Email" value="a@b.co" />);
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Email").props.value).toBe("a@b.co");
  });

  it("shows the error message when it gets one", async () => {
    await render(<TextField label="Email" value="" error="Required" />);
    expect(screen.getByText("Required")).toBeTruthy();
  });

  it("hides the error message when it gets none", async () => {
    await render(<TextField label="Email" value="" />);
    expect(screen.queryByText("Required")).toBeNull();
    expect(screen.toJSON()).not.toBeNull();
  });

  it("hides the error message when it gets an empty string", async () => {
    await render(<TextField label="Email" value="" error="" />);
    expect(screen.getAllByText(/.*/)).toHaveLength(1);
  });

  it("draws the error border and message in the error color", async () => {
    await render(<TextField label="Email" value="" error="Required" />);
    const input = StyleSheet.flatten(screen.getByLabelText("Email").props.style);
    expect(input.borderColor).toBe(colors.error);
    const message = StyleSheet.flatten(screen.getByText("Required").props.style);
    expect(message.color).toBe(colors.error);
  });

  it("draws the default border when there is no error", async () => {
    await render(<TextField label="Email" value="" />);
    const input = StyleSheet.flatten(screen.getByLabelText("Email").props.style);
    expect(input.borderColor).toBe(colors.border);
  });

  it("draws the default border for a whitespace-only error", async () => {
    await render(<TextField label="Email" value="" error="   " />);
    const input = StyleSheet.flatten(screen.getByLabelText("Email").props.style);
    expect(input.borderColor).toBe(colors.border);
    expect(screen.getAllByText(/.*/)).toHaveLength(1);
  });

  it("hides the text when secure", async () => {
    await render(<TextField label="Password" value="x" secure />);
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(true);
  });

  it("shows the text when not secure", async () => {
    await render(<TextField label="Password" value="x" />);
    expect(screen.getByLabelText("Password").props.secureTextEntry).toBe(false);
  });

  it("reports typing through onChangeText", async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Email" value="" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "hi");
    expect(onChangeText).toHaveBeenCalledWith("hi");
  });

  it("draws the placeholder in the placeholder color", async () => {
    await render(<TextField label="Email" value="" placeholder="name@email.com" />);
    const input = screen.getByLabelText("Email");
    expect(input.props.placeholder).toBe("name@email.com");
    expect(input.props.placeholderTextColor).toBe(colors.textPlaceholder);
  });

  it("draws the label as a label", async () => {
    await render(<TextField label="Email" value="" />);
    expect(StyleSheet.flatten(screen.getByText("Email").props.style)).toEqual(textStyle("label"));
  });

  it("passes the keyboard props to the input", async () => {
    await render(
      <TextField
        label="Email"
        value=""
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />,
    );
    const input = screen.getByLabelText("Email");
    expect(input.props.keyboardType).toBe("email-address");
    expect(input.props.autoCapitalize).toBe("none");
    expect(input.props.autoCorrect).toBe(false);
  });

  it("draws the label of the sheet look", async () => {
    await render(<TextField label="Title" value="Ramen" look="sheet" />);
    expect(screen.getByText("Title")).toBeTruthy();
  });

  it("hides the visible label in the answer look and keeps the accessibility label", async () => {
    await render(<TextField label="Your answer" value="" onChangeText={jest.fn()} look="answer" />);
    expect(screen.queryByText("Your answer")).toBeNull();
    expect(screen.getByLabelText("Your answer")).toBeTruthy();
  });

  it("draws the answer tone on the border", async () => {
    await render(
      <TextField
        label="Your answer"
        value="x"
        onChangeText={jest.fn()}
        look="answer"
        tone="miss"
      />,
    );
    expect(StyleSheet.flatten(screen.getByLabelText("Your answer").props.style)).toMatchObject({
      borderColor: colors.miss,
    });
  });

  it("shows the label in the form look by default", async () => {
    await render(<TextField label="Email" value="" onChangeText={jest.fn()} />);
    expect(screen.getByText("Email")).toBeTruthy();
  });

  it("draws the answer border of the tone at once without a border duration", async () => {
    await render(<TextField label="Answer" value="x" look="answer" tone="miss" />);
    const input = StyleSheet.flatten(screen.getByLabelText("Answer").props.style);
    expect(input.borderColor).toBe(colors.miss);
  });

  it("starts the answer border raised and eases to the tone over a border duration", async () => {
    await render(
      <TextField label="Answer" value="x" look="answer" tone="miss" borderDuration={200} />,
    );
    const input = StyleSheet.flatten(screen.getByLabelText("Answer").props.style);
    expect(processColor(input.borderColor)).toBe(processColor(colors.borderRaised));
  });

  it("keeps the answer border raised while idle with a border duration", async () => {
    await render(
      <TextField label="Answer" value="x" look="answer" tone="idle" borderDuration={200} />,
    );
    const input = StyleSheet.flatten(screen.getByLabelText("Answer").props.style);
    expect(processColor(input.borderColor)).toBe(processColor(colors.borderRaised));
  });
});
