// apps/mobile/test/components/divider.test.tsx
//
// Tests for the shared Divider component.
//
// Tested:
// - The optional label between the lines
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/divider.test.tsx
//
// SEE: apps/mobile/src/components/divider.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { StyleSheet } from "react-native";

import { Divider } from "@/components/divider";
import { textStyle } from "@/components/text-style";
import { borderWidth, colors, spacing } from "@/constants/theme";

describe("Divider", () => {
  it("draws the label when it gets one", async () => {
    await render(<Divider label="or" />);
    expect(screen.getByText("or")).toBeTruthy();
  });

  it("draws no label when it gets none", async () => {
    await render(<Divider />);
    expect(screen.queryByText(/.*/)).toBeNull();
  });

  it("draws no label when it gets an empty string", async () => {
    await render(<Divider label="" />);
    expect(screen.queryByText(/.*/)).toBeNull();
  });

  it("draws one thin line inside a row when it gets no label", async () => {
    await render(<Divider />);
    const root = screen.toJSON();
    if (root === null || Array.isArray(root)) {
      throw new Error("expected a single root");
    }
    expect(StyleSheet.flatten(root.props.style).flexDirection).toBe("row");
    expect(root.children).toHaveLength(1);
    const line = root.children?.[0];
    if (line === undefined || typeof line === "string") {
      throw new Error("expected a line element");
    }
    const style = StyleSheet.flatten(line.props.style);
    expect(style.height).toBe(borderWidth.thin);
    expect(style.backgroundColor).toBe(colors.border);
  });

  it("draws the label in the caption style with the group margin", async () => {
    await render(<Divider label="or" />);
    const style = StyleSheet.flatten(screen.getByText("or").props.style);
    expect(style).toEqual({ ...textStyle("caption"), marginHorizontal: spacing.group });
  });
});
