// apps/mobile/test/components/segmented-control-style.test.ts
//
// Tests for segmentedStyle.
//
// Tested:
// - The choice look keeps the values of the control before the tabs look existed
// - The tabs look draws progress-history.html: the selected segment, the labels and the roles
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/segmented-control-style.test.ts
//
// SEE: apps/mobile/src/components/segmented-control-style.ts

import { describe, expect, it } from "@jest/globals";

import { segmentedStyle } from "@/components/segmented-control-style";
import { selectableStyle } from "@/components/selectable-style";
import { borderWidth, colors, radius, size, spacing } from "@/constants/theme";

describe("segmentedStyle", () => {
  it("keeps the choice look unchanged", () => {
    const style = segmentedStyle("choice");
    expect(style.group).toEqual({
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
      borderRadius: radius.control,
      padding: spacing.xs,
      gap: spacing.xs,
    });
    expect(style.segment).toEqual({
      flex: 1,
      minHeight: size.control,
      borderWidth: borderWidth.thin,
      borderColor: colors.surface,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
    });
    expect(style.selected).toEqual(selectableStyle({ selected: true }));
    expect(style.label(true)).toBe("body");
    expect(style.label(false)).toBe("body");
    expect(style.groupRole).toBe("radiogroup");
    expect(style.segmentRole).toBe("radio");
  });

  it("draws the tabs look of progress-history.html", () => {
    const style = segmentedStyle("tabs");
    expect(style.group).toEqual({
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
      borderRadius: radius.control,
      padding: spacing.xs,
      gap: spacing.stack,
    });
    expect(style.segment).toEqual({
      flex: 1,
      minHeight: size.pill,
      borderWidth: borderWidth.thin,
      borderColor: colors.surface,
      borderRadius: radius.note,
      alignItems: "center",
      justifyContent: "center",
    });
    expect(style.selected).toEqual({
      backgroundColor: colors.accentLine,
      borderColor: colors.accentPressed,
    });
    expect(style.label(true)).toBe("action");
    expect(style.label(false)).toBe("actionMuted");
    expect(style.groupRole).toBe("tablist");
    expect(style.segmentRole).toBe("tab");
  });

  it("draws the count look of practice-focus.html: a 22 radius group without gap, 40 high segments", () => {
    const style = segmentedStyle("count");
    expect(style.group).toEqual({
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: borderWidth.thin,
      borderRadius: radius.picker,
      padding: spacing.xs,
      gap: 0,
    });
    expect(style.segment).toEqual({
      flex: 1,
      minHeight: size.pill,
      borderWidth: borderWidth.thin,
      borderColor: colors.surface,
      borderRadius: radius.control,
      alignItems: "center",
      justifyContent: "center",
    });
    expect(style.selected).toEqual({
      backgroundColor: colors.accentLine,
      borderColor: colors.accentPressed,
    });
    expect(style.label(true)).toBe("actionStrong");
    expect(style.label(false)).toBe("actionMuted");
    expect(style.groupRole).toBe("radiogroup");
    expect(style.segmentRole).toBe("radio");
  });
});
