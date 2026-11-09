// apps/mobile/test/components/rename-sheet.test.tsx
//
// Tests for RenameSheet.
//
// Tested:
// - The overlay is modal for VoiceOver
// - It draws Rename chat, the Title field with its value and the count
// - The field is limited to 60 characters and hands every change to onChangeText
// - Save is disabled when it cannot save and calls onSave when it can
// - Cancel and the scrim call onCancel
// - The failure shows under the field
// - Saving shows Save loading and disables Cancel
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/rename-sheet.test.tsx
//
// SEE: apps/mobile/src/components/rename-sheet.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RenameSheet } from "@/components/rename-sheet";
import type { RenameSheetView } from "@/utils/rename-sheet";

const view: RenameSheetView = {
  value: "Ramen spots in Tokyo",
  count: "20/60",
  canSave: true,
  saving: false,
  failure: null,
};

function sheet(overrides: Partial<RenameSheetView> = {}, handlers = {}) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <RenameSheet
        view={{ ...view, ...overrides }}
        onChangeText={jest.fn()}
        onCancel={jest.fn()}
        onSave={jest.fn()}
        motion={null}
        {...handlers}
      />
    </SafeAreaProvider>
  );
}

describe("RenameSheet", () => {
  it("is modal on the overlay, so the chat behind it is hidden from VoiceOver", async () => {
    await render(sheet());
    expect(screen.getByTestId("rename-overlay").props.accessibilityViewIsModal).toBe(true);
  });

  it("draws Rename chat, the Title field with its value and the count", async () => {
    await render(sheet());
    expect(screen.getByRole("header", { name: "Rename chat" })).toBeTruthy();
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByDisplayValue("Ramen spots in Tokyo")).toBeTruthy();
    expect(screen.getByText("20/60")).toBeTruthy();
  });

  it("limits the field to 60 characters", async () => {
    await render(sheet());
    expect(screen.getByLabelText("Title").props.maxLength).toBe(60);
  });

  it("disables Save when it cannot save and calls onSave when it can", async () => {
    const onSave = jest.fn();
    await render(sheet({ canSave: false }, { onSave }));
    await fireEvent.press(screen.getByRole("button", { name: "Save", disabled: true }));
    expect(onSave).not.toHaveBeenCalled();
    await screen.unmount();

    const onSave2 = jest.fn();
    await render(sheet({}, { onSave: onSave2 }));
    await fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(onSave2).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel from Cancel and from the scrim", async () => {
    const onCancel = jest.fn();
    await render(sheet({}, { onCancel }));
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    await fireEvent.press(screen.getByTestId("rename-scrim"));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("draws the failure under the field", async () => {
    await render(sheet({ failure: "Could not reach the server. Try again." }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Could not reach the server. Try again.")).toBeTruthy();
  });

  it("shows Save loading and disables Cancel while saving", async () => {
    const onCancel = jest.fn();
    await render(sheet({ saving: true, canSave: false }, { onCancel }));
    expect(screen.getByRole("button", { name: "Save", busy: true })).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Cancel", disabled: true }));
    await fireEvent.press(screen.getByTestId("rename-scrim"));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("hands every change to onChangeText", async () => {
    const onChangeText = jest.fn();
    await render(sheet({}, { onChangeText }));
    await fireEvent.changeText(screen.getByLabelText("Title"), "Tokyo ramen");
    expect(onChangeText).toHaveBeenCalledWith("Tokyo ramen");
  });
});
