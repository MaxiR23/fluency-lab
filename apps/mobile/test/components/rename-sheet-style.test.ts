// apps/mobile/test/components/rename-sheet-style.test.ts
//
// Tests for renameSheetStyle.
//
// Tested:
// - The overlay, scrim, dock, sheet, grabber, field, count and buttons of chat-rename.html
// - The sheet bottom is 36 or the safe inset
//
// What is covered:
// - Normal case, edges (no inset, home indicator)
//
// Run with: pnpm exec jest apps/mobile/test/components/rename-sheet-style.test.ts
//
// SEE: apps/mobile/src/components/rename-sheet-style.ts

import { describe, expect, it } from "@jest/globals";

import { renameSheetStyle } from "@/components/rename-sheet-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

describe("renameSheetStyle", () => {
  it("draws the sheet of chat-rename.html", () => {
    const style = renameSheetStyle(0);
    const fill = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 };
    expect(style.overlay).toEqual(fill);
    expect(style.scrim).toEqual({ ...fill, backgroundColor: colors.scrim });
    expect(style.dock).toEqual({ position: "absolute", left: 0, right: 0, bottom: 0 });
    expect(style.sheet).toEqual({
      gap: spacing.md,
      paddingTop: spacing.cluster,
      paddingHorizontal: spacing.screenSide,
      paddingBottom: 36,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      backgroundColor: colors.surfaceSunken,
      borderTopWidth: borderWidth.thin,
      borderTopColor: colors.border,
    });
    expect(style.grabberRow).toEqual({ alignItems: "center" });
    expect(style.grabber).toEqual({
      width: size.grabberWidth,
      height: size.grabberHeight,
      borderRadius: radius.grabber,
      backgroundColor: colors.borderRaised,
    });
    expect(style.field).toEqual({ gap: spacing.sm });
    expect(style.count).toEqual({ alignSelf: "flex-end" });
    expect(style.buttons).toEqual({ flexDirection: "row", gap: spacing.cluster });
    expect(style.button).toEqual({ flex: 1 });
  });

  it("keeps the sheet bottom at 36 or the safe inset", () => {
    expect(renameSheetStyle(0).sheet.paddingBottom).toBe(36);
    expect(renameSheetStyle(40).sheet.paddingBottom).toBe(40);
  });
});
