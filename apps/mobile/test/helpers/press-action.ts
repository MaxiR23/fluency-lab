// Test helper (not a test file): presses a button that a swipeable row draws behind
// the row. ReanimatedSwipeable hides its actions with an animated style of
// pointerEvents "none" until a swipe opens them, and jest cannot run the swipe
// (the pan and measure() do not run), so fireEvent.press ignores them. This calls
// the button's own click handler, the one a screen reader's activation reaches.

import { act, type screen } from "@testing-library/react-native";

type HostElement = ReturnType<typeof screen.getByRole>;

export async function pressAction(button: HostElement): Promise<void> {
  const onClick: unknown = button.props.onClick;
  if (typeof onClick !== "function") throw new Error("The button has no click handler");
  await act(async () => {
    onClick({ stopPropagation: () => {}, nativeEvent: {} });
  });
}
