// apps/mobile/test/components/icon-button-style.test.ts
//
// Tests for iconButtonStyle.
//
// Tested:
// - The touch square, centered
//
// What is covered:
// - Normal case
//
// Run with: pnpm exec jest apps/mobile/test/components/icon-button-style.test.ts
//
// SEE: apps/mobile/src/components/icon-button-style.ts

import { describe, expect, it } from "@jest/globals";

import { iconButtonStyle } from "@/components/icon-button-style";
import { size } from "@/constants/theme";

describe("iconButtonStyle", () => {
  it("is the touch square with its icon centered", () => {
    expect(iconButtonStyle()).toEqual({
      width: size.touch,
      height: size.touch,
      alignItems: "center",
      justifyContent: "center",
    });
  });
});
