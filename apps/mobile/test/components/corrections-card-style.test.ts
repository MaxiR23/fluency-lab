// apps/mobile/test/components/corrections-card-style.test.ts
//
// Tests for the style functions of the corrections card.
//
// Tested:
// - The card keeps today's padding and takes 6 below with the ask row (correction-thread-entry.html)
// - The ask row, its divider and the withdrawn row hold the design's tokens
// - The ask divider keeps 6 between the line and the button; the withdrawn text can shrink
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/corrections-card-style.test.ts
//
// SEE: apps/mobile/src/components/corrections-card-style.ts

import { describe, expect, it } from "@jest/globals";

import {
  askDividerStyle,
  askLabelStyle,
  askRowStyle,
  correctionsCardStyle,
  withdrawnRowStyle,
  withdrawnTextStyle,
} from "@/components/corrections-card-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

describe("correctionsCardStyle", () => {
  it("keeps the card of the chat: 12 above and below, 14 on the sides", () => {
    expect(correctionsCardStyle({ ask: false })).toEqual({
      gap: spacing.stack,
      paddingTop: spacing.group,
      paddingBottom: spacing.group,
      paddingHorizontal: spacing.card,
      borderRadius: radius.note,
      backgroundColor: colors.surfaceSunken,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
    });
    expect([spacing.group, spacing.card, spacing.stack]).toEqual([12, 14, 6]);
  });

  it("takes 6 below with the ask row", () => {
    expect(correctionsCardStyle({ ask: true })).toEqual({
      ...correctionsCardStyle({ ask: false }),
      paddingBottom: spacing.stack,
    });
  });
});

describe("the ask row styles", () => {
  it("is a 44 high row with an 8 gap, centered", () => {
    expect(askRowStyle()).toEqual({
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: size.touch,
    });
  });

  it("lets the label take the room", () => {
    expect(askLabelStyle()).toEqual({ flex: 1 });
  });

  it("puts 4 above the divider and 6 between the line and the button", () => {
    expect(askDividerStyle()).toEqual({ marginTop: spacing.xs, gap: spacing.stack });
  });
});

describe("withdrawnRowStyle", () => {
  it("is a centered row with an 8 gap", () => {
    expect(withdrawnRowStyle()).toEqual({
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    });
  });
});

describe("withdrawnTextStyle", () => {
  it("lets the text shrink so the badge stays in the card", () => {
    expect(withdrawnTextStyle()).toEqual({ flexShrink: 1 });
  });
});
