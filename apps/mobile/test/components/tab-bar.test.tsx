// apps/mobile/test/components/tab-bar.test.tsx
//
// Tests for TabBar.
//
// Tested:
// - Every tab with its icon and label
// - The current tab is selected and not pressable
// - Another tab navigates after tabPress, unless it was prevented
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/tab-bar.test.tsx
//
// SEE: apps/mobile/src/components/tab-bar.tsx

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ColorValue } from "react-native";

import { Icon } from "@/components/icon";
import { TabBar } from "@/components/tab-bar";

const names = ["home", "progress", "settings"] as const;
const titles = { home: "Home", progress: "Progress", settings: "Settings" };

const emit = jest.fn((_event: { type: "tabPress"; target: string; canPreventDefault: true }) => ({
  defaultPrevented: false,
}));
const navigateToTab = jest.fn((_key: string) => undefined);

function bar(index = 0) {
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
    />
  );
}

describe("TabBar", () => {
  beforeEach(() => {
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
});
