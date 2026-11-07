// apps/mobile/test/components/comparison-table-style.test.ts
//
// Tests for the style functions of the comparison table.
//
// Tested:
// - comparisonTableStyle gives the container, the header and the cells of note.html from the tokens
// - cellVariant picks the text of a cell by its column
//
// What is covered:
// - Normal case, one column rows, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/comparison-table-style.test.ts
//
// SEE: apps/mobile/src/components/comparison-table-style.ts

import { describe, expect, it } from "@jest/globals";

import { cellVariant, comparisonTableStyle } from "@/components/comparison-table-style";
import { borderWidth, colors, radius, spacing } from "@/constants/theme";

describe("comparisonTableStyle", () => {
  const style = comparisonTableStyle();

  it("draws the container with a 16 radius, a thin border and clipped corners", () => {
    expect(style.table).toEqual({
      borderRadius: radius.badgeLarge,
      borderWidth: borderWidth.thin,
      borderColor: colors.border,
      overflow: "hidden",
    });
  });

  it("draws the header row on the surface with a line under it", () => {
    expect(style.headerRow).toEqual({
      flexDirection: "row",
      backgroundColor: colors.surface,
      borderBottomWidth: borderWidth.thin,
      borderBottomColor: colors.border,
    });
    expect(style.headerCell).toEqual({
      flex: 1,
      paddingVertical: spacing.cluster,
      paddingHorizontal: spacing.group,
    });
  });

  it("draws the body rows sunken, with a line under all but the last", () => {
    expect(style.row(false)).toEqual({
      flexDirection: "row",
      backgroundColor: colors.surfaceSunken,
      borderBottomWidth: borderWidth.thin,
      borderBottomColor: colors.border,
    });
    expect(style.row(true)).toEqual({
      flexDirection: "row",
      backgroundColor: colors.surfaceSunken,
    });
    expect(style.cell).toEqual({ flex: 1, padding: spacing.group });
  });
});

describe("cellVariant", () => {
  it("draws the first cell as the lead, the second muted and the third plain", () => {
    expect(cellVariant(0, 3)).toBe("noteLead");
    expect(cellVariant(1, 3)).toBe("explanation");
    expect(cellVariant(2, 3)).toBe("cell");
  });

  it("draws a one column row plain", () => {
    expect(cellVariant(0, 1)).toBe("cell");
  });
});
