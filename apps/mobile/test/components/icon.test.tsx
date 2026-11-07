// apps/mobile/test/components/icon.test.tsx
//
// Tests for Icon.
//
// Tested:
// - One stroked drawing per name, in the given color, size and stroke width
// - Hidden from accessibility
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

const names: IconName[] = [
  "home",
  "progress",
  "settings",
  "chat",
  "check",
  "arrow",
  "person",
  "globe",
  "briefcase",
  "phone",
  "trophy",
  "note",
  "film",
  "fork",
  "gamepad",
  "book",
  "heart",
  "flask",
  "sun",
  "clipboard",
  "back",
  "lock",
  "send",
  "close",
  "trash",
  "chevron",
  "reply",
  "ask",
  "pen",
  "review",
  "words",
  "table",
  "list",
  "trashPlain",
];

type Node = { props?: Record<string, unknown>; children?: unknown };

// Collects the props of every drawn path, in order.
function pathsOf(node: unknown): Record<string, unknown>[] {
  if (node === null || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(pathsOf);
  const { props, children } = node as Node;
  const own = props !== undefined && typeof props.d === "string" ? [props] : [];
  return [...own, ...pathsOf(children)];
}

function drawing(): string {
  return pathsOf(screen.toJSON())
    .map((props) => String(props.d))
    .join("|");
}

describe("Icon", () => {
  it.each(names)("draws %s in the given color with the default stroke and size", async (name) => {
    await render(<Icon name={name} color={colors.textMuted} />);
    const paths = pathsOf(screen.toJSON());
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(typeof path.d).toBe("string");
      expect((path.stroke as { payload: unknown }).payload).toBe(processColor(colors.textMuted));
      expect(path.strokeWidth).toBe(strokeWidth.icon);
    }
    expect(screen.getByTestId(`icon-${name}`, { includeHiddenElements: true })).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).toContain(`"width":${size.icon}`);
  });

  it("draws a different drawing for each name", async () => {
    const drawings = new Set<string>();
    const { rerender } = await render(<Icon name="chat" color={colors.accent} />);
    for (const name of names) {
      await rerender(<Icon name={name} color={colors.accent} />);
      drawings.add(drawing());
    }
    expect(drawings.size).toBe(names.length);
  });

  it("draws the given size and stroke width", async () => {
    await render(
      <Icon
        name="check"
        color={colors.text}
        size={size.iconCheck}
        strokeWidth={strokeWidth.check}
      />,
    );
    for (const path of pathsOf(screen.toJSON())) {
      expect(path.strokeWidth).toBe(strokeWidth.check);
    }
    const drawn = JSON.stringify(screen.toJSON());
    expect(drawn).toContain(`"width":${size.iconCheck}`);
    expect(drawn).toContain(`"height":${size.iconCheck}`);
  });

  it("is hidden from accessibility", async () => {
    await render(<Icon name="home" color={colors.accent} />);
    expect(screen.queryByTestId("icon-home")).toBeNull();
    expect(screen.getByTestId("icon-home", { includeHiddenElements: true })).toBeTruthy();
  });

  it("draws the chevron path of the design", async () => {
    await render(<Icon name="chevron" color={colors.textPlaceholder} />);
    expect(drawing()).toBe("M9 6l6 6-6 6");
  });

  it("draws the ask path of the design", async () => {
    await render(<Icon name="ask" color={colors.accent} />);
    expect(drawing()).toBe("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z");
  });

  it("draws the reply paths of the design", async () => {
    await render(<Icon name="reply" color={colors.accent} />);
    expect(drawing()).toBe("M9 14 4 9l5-5|M4 9h10.5a5.5 5.5 0 0 1 0 11H11");
  });

  it("draws the table icon of the design, its rect written as a path", async () => {
    await render(<Icon name="table" color={colors.accent} />);
    expect(drawing()).toBe(
      "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z|M3 9h18M3 15h18M9 3v18",
    );
  });

  it("draws the list icon of the design", async () => {
    await render(<Icon name="list" color={colors.accent} />);
    expect(drawing()).toBe("M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01");
  });

  it("draws the plain trash of the note screen, apart from the rounded one", async () => {
    await render(<Icon name="trashPlain" color={colors.textMuted} />);
    expect(drawing()).toBe("M3 6h18|M8 6V4h8v2|M19 6l-1 14H6L5 6");
  });
});
