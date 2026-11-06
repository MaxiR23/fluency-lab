// apps/mobile/test/components/icon.test.tsx
//
// Tests for Icon.
//
// Tested:
// - One stroked glyph per name, in the given color, hidden from accessibility
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/icon.test.tsx
//
// SEE: apps/mobile/src/components/icon.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { processColor } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { colors, size, strokeWidth } from "@/constants/theme";

const names: IconName[] = ["chat", "home", "progress", "settings"];

describe("Icon", () => {
  it.each(names)("draws the path for %s in the given color", async (name) => {
    await render(<Icon name={name} color={colors.textMuted} />);
    const path = screen.getByTestId(`icon-${name}`, { includeHiddenElements: true });
    expect(typeof path.props.d).toBe("string");
    expect(path.props.d.length).toBeGreaterThan(0);
    expect(path.props.stroke.payload).toBe(processColor(colors.textMuted));
    expect(path.props.strokeWidth).toBe(strokeWidth.icon);
    const drawn = JSON.stringify(screen.toJSON());
    expect(drawn).toContain(`"width":${size.icon}`);
  });

  it("draws a different path for each name", async () => {
    const paths = new Set<string>();
    const { rerender } = await render(<Icon name="chat" color={colors.accent} />);
    for (const name of names) {
      await rerender(<Icon name={name} color={colors.accent} />);
      paths.add(screen.getByTestId(`icon-${name}`, { includeHiddenElements: true }).props.d);
    }
    expect(paths.size).toBe(names.length);
  });

  it("is hidden from accessibility", async () => {
    await render(<Icon name="home" color={colors.accent} />);
    expect(screen.queryByTestId("icon-home")).toBeNull();
    expect(screen.getByTestId("icon-home", { includeHiddenElements: true })).toBeTruthy();
  });
});
