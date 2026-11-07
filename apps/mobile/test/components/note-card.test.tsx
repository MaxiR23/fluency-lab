// apps/mobile/test/components/note-card.test.tsx
//
// Tests for NoteCard, the card of a study note inside the tutor's bubble.
//
// Tested:
// - It draws the title, the topic, the icon and the preview lines, the lead in bold
// - Saved to Notes shows only when the note is saved
// - Pressing calls back only when the note is saved
// - Its accessibility label names the note
// - The saved line has no entering animation with reduce motion
//
// What is covered:
// - Normal case, not saved yet, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/note-card.test.tsx
//
// SEE: apps/mobile/src/components/note-card.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { NoteCard } from "@/components/note-card";
import { textStyle } from "@/components/text-style";
import { chatMotion } from "@/utils/chat-motion";
import { savedTransition } from "@/utils/note-transitions";

const card = {
  title: "Future forms",
  topic: "Going to, will",
  icon: "table",
  preview: [
    { lead: "going to", text: "plans" },
    { lead: null, text: "A point with no lead" },
  ],
} as const;

describe("NoteCard", () => {
  it("draws the title, the topic, the icon and the chevron", async () => {
    await render(<NoteCard {...card} saved onPress={jest.fn()} />);
    expect(screen.getByText("Future forms")).toBeTruthy();
    expect(screen.getByText("Going to, will")).toBeTruthy();
    expect(screen.getByTestId("icon-table", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("icon-chevron", { includeHiddenElements: true })).toBeTruthy();
  });

  it("draws the icon it is given", async () => {
    await render(<NoteCard {...card} icon="list" saved onPress={jest.fn()} />);
    expect(screen.getByTestId("icon-list", { includeHiddenElements: true })).toBeTruthy();
  });

  it("draws each preview line, the lead in bold accent when there is one", async () => {
    await render(<NoteCard {...card} saved onPress={jest.fn()} />);
    const lead = screen.getByText("going to");
    expect(StyleSheet.flatten(lead.props.style)).toMatchObject(textStyle("noteLead"));
    expect(screen.getByText(/plans/)).toBeTruthy();
    expect(screen.getByText("A point with no lead")).toBeTruthy();
    expect(screen.queryAllByText("going to")).toHaveLength(1);
  });

  it("draws Saved to Notes only when the note is saved", async () => {
    const { rerender } = await render(<NoteCard {...card} saved={false} />);
    expect(screen.queryByText("Saved to Notes")).toBeNull();
    await rerender(<NoteCard {...card} saved onPress={jest.fn()} />);
    expect(screen.getByText("Saved to Notes")).toBeTruthy();
    expect(screen.getByTestId("icon-check", { includeHiddenElements: true })).toBeTruthy();
  });

  it("calls onPress when saved", async () => {
    const onPress = jest.fn();
    await render(<NoteCard {...card} saved onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Future forms, study note" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress before the note is saved", async () => {
    const onPress = jest.fn();
    await render(<NoteCard {...card} saved={false} onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Future forms, study note" });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("draws the saved line with its entering animation, and none with reduce motion", async () => {
    const { rerender } = await render(
      <NoteCard
        {...card}
        saved
        onPress={jest.fn()}
        savedEntering={savedTransition(chatMotion(false).saved)}
      />,
    );
    expect(screen.getByTestId("note-saved").props.entering).toBeDefined();
    await rerender(
      <NoteCard
        {...card}
        saved
        onPress={jest.fn()}
        savedEntering={savedTransition(chatMotion(true).saved)}
      />,
    );
    expect(screen.getByTestId("note-saved").props.entering).toBeUndefined();
  });
});
