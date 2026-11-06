// apps/mobile/test/components/section-header.test.tsx
//
// Tests for SectionHeader.
//
// Tested:
// - The section title and its optional link
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/section-header.test.tsx
//
// SEE: apps/mobile/src/components/section-header.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { SectionHeader } from "@/components/section-header";
import { textStyle } from "@/components/text-style";

describe("SectionHeader", () => {
  it("draws the title", async () => {
    await render(<SectionHeader title="Continue" />);
    const title = screen.getByText("Continue");
    expect(StyleSheet.flatten(title.props.style)).toMatchObject(textStyle("section"));
  });

  it("draws See all as a link that calls onPress when given", async () => {
    const onAction = jest.fn();
    await render(
      <SectionHeader title="Suggested for you" actionLabel="See all" onAction={onAction} />,
    );
    await fireEvent.press(screen.getByRole("link", { name: "See all" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("draws no link without an action", async () => {
    await render(<SectionHeader title="Continue" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
