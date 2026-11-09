// apps/mobile/test/components/offline-badge-style.test.ts
//
// Tests for offlineBadgeStyle, the badge of the can't-connect screens.
//
// Tested:
// - The large badge of offline.html and the small one of offline-inline.html
// - The rings and the cloud icon
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/offline-badge-style.test.ts
//
// SEE: apps/mobile/src/components/offline-badge-style.ts

import { describe, expect, it } from "@jest/globals";

import { offlineBadgeStyle } from "@/components/offline-badge-style";
import { borderWidth, colors, radius, shadow, size, strokeWidth } from "@/constants/theme";

describe("offlineBadgeStyle", () => {
  it("draws the large badge of offline.html: an 80 circle in the deep fill with its line and glow, inside a 96 box", () => {
    const style = offlineBadgeStyle("large");
    expect(style.box).toEqual({
      width: size.cloudRing,
      height: size.cloudRing,
      alignItems: "center",
      justifyContent: "center",
    });
    expect(style.badge).toEqual({
      width: size.cloudBadge,
      height: size.cloudBadge,
      borderRadius: radius.pill,
      backgroundColor: colors.accentDeep,
      borderColor: colors.accentLine,
      borderWidth: borderWidth.thin,
      alignItems: "center",
      justifyContent: "center",
      ...shadow.cloudGlow,
    });
  });

  it("draws each ring as a 96 circle with the pressed accent border", () => {
    expect(offlineBadgeStyle("large").ring).toEqual({
      position: "absolute",
      width: size.cloudRing,
      height: size.cloudRing,
      borderRadius: radius.pill,
      borderWidth: borderWidth.thin,
      borderColor: colors.accentPressed,
    });
  });

  it("draws the small badge of offline-inline.html: a 56 circle with no glow", () => {
    const style = offlineBadgeStyle("small");
    expect(style.box).toBeNull();
    expect(style.badge).toEqual({
      width: size.cloudBadgeSmall,
      height: size.cloudBadgeSmall,
      borderRadius: radius.pill,
      backgroundColor: colors.accentDeep,
      borderColor: colors.accentLine,
      borderWidth: borderWidth.thin,
      alignItems: "center",
      justifyContent: "center",
    });
    expect(style.badge).not.toHaveProperty("shadowColor");
  });

  it("sizes the cloud 34 in the large badge and 26 in the small one, stroke 1.7", () => {
    expect(offlineBadgeStyle("large").icon).toEqual({
      size: size.iconCloud,
      strokeWidth: strokeWidth.cloud,
    });
    expect(offlineBadgeStyle("small").icon).toEqual({
      size: size.iconCloudSmall,
      strokeWidth: strokeWidth.cloud,
    });
  });
});
