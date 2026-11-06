// apps/mobile/test/components/tab-bar.test.tsx
//
// Tests for TabBar.
//
// Tested:
// - Every tab with its icon and label
// - The current tab is selected and not pressable
// - Another tab navigates after tabPress, unless it was prevented
// - Active icon and label in the text color, inactive muted
// - The pill sits under the current tab and springs to a new one
// - A first measure places the pill in place, with no spring from the start
// - With reduce motion the pill jumps to the new tab with no spring
// - The pill is hidden from accessibility
// - The bar floats from tokens above the bottom inset
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/tab-bar.test.tsx
//
// SEE: apps/mobile/src/components/tab-bar.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { type ColorValue, processColor, StyleSheet } from "react-native";
import * as Reanimated from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { TabBar } from "@/components/tab-bar";
import { tabBarStyle } from "@/components/tab-bar-style";
import { colors, size } from "@/constants/theme";
import { type PillMotion, tabPillMotion } from "@/utils/tab-bar";

// INFO: Reanimated styles do not advance under jest, so the slide is proven by the target the
// pill springs to: withSpring is wrapped to record it and still return the real value.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual<typeof Reanimated>("react-native-reanimated");
  return {
    ...actual,
    __esModule: true,
    default: actual.default,
    withSpring: jest.fn(actual.withSpring),
    useSharedValue: jest.fn(actual.useSharedValue),
  };
});

type Node = { props?: Record<string, unknown>; children?: unknown };

// Collects the props of every drawn path, in order.
function pathsOf(node: unknown): Record<string, unknown>[] {
  if (node === null || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(pathsOf);
  const { props, children } = node as Node;
  const own = props !== undefined && typeof props.d === "string" ? [props] : [];
  return [...own, ...pathsOf(children)];
}

const names = ["home", "progress", "settings"] as const;
const titles = { home: "Home", progress: "Progress", settings: "Settings" };

const emit = jest.fn((_event: { type: "tabPress"; target: string; canPreventDefault: true }) => ({
  defaultPrevented: false,
}));
const navigateToTab = jest.fn((_key: string) => undefined);

function bar(index = 0, pill: PillMotion | null = tabPillMotion(false)) {
  return (
    <TabBar
      state={{ index, routes: names.map((name) => ({ key: `${name}-key`, name })) }}
      descriptors={Object.fromEntries(
        names.map((name) => [
          `${name}-key`,
          {
            options: {
              title: titles[name],
              tabBarButtonTestID: `tab-${name}`,
              tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
                <Icon name={name} color={color} size={size} />
              ),
            },
          },
        ]),
      )}
      emitter={{ emit }}
      navigateToTab={navigateToTab}
      insets={{ bottom: 34 }}
      pill={pill}
    />
  );
}

async function layout(width: number) {
  await fireEvent(screen.getByTestId("tab-bar-row", { includeHiddenElements: true }), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 52 } },
  });
}

function pillStyle() {
  return StyleSheet.flatten(
    screen.getByTestId("tab-pill", { includeHiddenElements: true }).props.style,
  );
}

describe("TabBar", () => {
  beforeEach(() => {
    jest.mocked(Reanimated.withSpring).mockClear();
    emit.mockClear();
    navigateToTab.mockClear();
    emit.mockReturnValue({ defaultPrevented: false });
  });

  it("draws every tab with its icon and label", async () => {
    await render(bar());
    for (const name of names) {
      expect(screen.getByText(titles[name])).toBeTruthy();
      expect(screen.getByTestId(`icon-${name}`, { includeHiddenElements: true })).toBeTruthy();
    }
  });

  it("marks the current tab selected and does not make it pressable", async () => {
    await render(bar(0));
    const home = screen.getByTestId("tab-home");
    expect(home.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    await fireEvent.press(home);
    expect(emit).not.toHaveBeenCalled();
    expect(navigateToTab).not.toHaveBeenCalled();
    expect(screen.getByTestId("tab-progress").props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it("navigates to another tab after emitting tabPress", async () => {
    await render(bar(0));
    await fireEvent.press(screen.getByTestId("tab-progress"));
    expect(emit).toHaveBeenCalledWith({
      type: "tabPress",
      target: "progress-key",
      canPreventDefault: true,
    });
    expect(navigateToTab).toHaveBeenCalledWith("progress-key");
  });

  it("does not navigate when tabPress is prevented", async () => {
    emit.mockReturnValue({ defaultPrevented: true });
    await render(bar(0));
    await fireEvent.press(screen.getByTestId("tab-settings"));
    expect(emit).toHaveBeenCalledTimes(1);
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it("draws the current tab's label in the text color and the others muted", async () => {
    await render(bar(0));
    expect(StyleSheet.flatten(screen.getByText("Home").props.style).color).toBe(colors.text);
    expect(StyleSheet.flatten(screen.getByText("Progress").props.style).color).toBe(
      colors.textMuted,
    );
    expect(StyleSheet.flatten(screen.getByText("Settings").props.style).color).toBe(
      colors.textMuted,
    );
  });

  it("draws the current tab's icon in the text color and the others muted at the design's 22", async () => {
    await render(bar(0));
    const strokes = (name: string) =>
      pathsOf(screen.getByTestId(`icon-${name}`, { includeHiddenElements: true }).parent).map(
        (path) => (path.stroke as { payload: unknown }).payload,
      );
    expect(strokes("home")).toEqual(strokes("home").map(() => processColor(colors.text)));
    expect(strokes("progress")).toEqual(
      strokes("progress").map(() => processColor(colors.textMuted)),
    );
    expect(strokes("settings")).toEqual(
      strokes("settings").map(() => processColor(colors.textMuted)),
    );
    expect(strokes("home").length).toBeGreaterThan(0);
    expect(JSON.stringify(screen.toJSON())).toContain(`"width":${size.icon}`);
  });

  it("floats the bar from tokens above the bottom inset", async () => {
    await render(bar());
    const root = screen.getByTestId("tab-bar-row", { includeHiddenElements: true }).parent;
    expect(StyleSheet.flatten(root?.props.style)).toEqual(tabBarStyle(34));
  });

  it("starts the pill under the current tab once the row is measured", async () => {
    await render(bar(2));
    await layout(300);
    expect(pillStyle()).toMatchObject({ width: 100 });
    // INFO: the animated starting style does not advance under jest; the target is the spring's.
    const calls = jest.mocked(Reanimated.withSpring).mock.calls;
    expect(calls[calls.length - 1]).toEqual([200, tabPillMotion(false)]);
  });

  it("places the pill directly under a tab other than the first when the row is measured", async () => {
    const sets: unknown[] = [];
    jest.mocked(Reanimated.useSharedValue).mockImplementationOnce(((init: number) => {
      const shared = jest
        .requireActual<typeof Reanimated>("react-native-reanimated")
        .useSharedValue(init);
      return {
        get: () => shared.get(),
        set: (value: unknown) => {
          sets.push(value);
          shared.set(value as number);
        },
      } as typeof shared;
    }) as typeof Reanimated.useSharedValue);
    await render(bar(2));
    await layout(300);
    // INFO: a plain number is the direct placement; a spring would be an animation, not a number.
    expect(sets.filter((value) => typeof value === "number")).toEqual([200]);
  });

  it("springs the pill to the tab that becomes current", async () => {
    const { rerender } = await render(bar(0));
    await layout(300);
    jest.mocked(Reanimated.withSpring).mockClear();
    await rerender(bar(1));
    const calls = jest.mocked(Reanimated.withSpring).mock.calls;
    expect(calls[calls.length - 1]).toEqual([100, tabPillMotion(false)]);
  });

  it("jumps the pill to the new tab with no spring when reduce motion is on", async () => {
    const { rerender } = await render(bar(0, null));
    await layout(300);
    jest.mocked(Reanimated.withSpring).mockClear();
    await rerender(bar(2, null));
    expect(Reanimated.withSpring).not.toHaveBeenCalled();
    expect(pillStyle().transform).toEqual([{ translateX: 200 }]);
  });

  it("hides the pill from accessibility", async () => {
    await render(bar());
    expect(screen.queryByTestId("tab-pill")).toBeNull();
    expect(screen.getByTestId("tab-pill", { includeHiddenElements: true })).toBeTruthy();
  });
});
