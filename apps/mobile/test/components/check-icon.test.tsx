// apps/mobile/test/components/check-icon.test.tsx
//
// Tests for CheckIcon.
//
// Tested:
// - The check drawn in the accent color at the icon size
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/check-icon.test.tsx
//
// SEE: apps/mobile/src/components/check-icon.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { processColor } from "react-native";

import { CheckIcon } from "@/components/check-icon";
import { colors, size, strokeWidth } from "@/constants/theme";

describe("CheckIcon", () => {
  it("draws the check in the accent color at the icon size", async () => {
    await render(<CheckIcon />);
    const path = screen.getByTestId("check-icon", { includeHiddenElements: true });
    expect(path.props.d).toBe("M5 12.5l4.5 4.5L19 7.5");
    expect(path.props.stroke.payload).toBe(processColor(colors.accent));
    expect(path.props.strokeWidth).toBe(strokeWidth.icon);
    const drawn = JSON.stringify(screen.toJSON());
    expect(drawn).toContain(`"width":${size.icon}`);
    expect(drawn).toContain(`"height":${size.icon}`);
  });
});
