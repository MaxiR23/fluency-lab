// apps/mobile/test/components/topic-step-fields.test.tsx
//
// Tests for TopicStepFields.
//
// Tested:
// - The selected count and a chip for every topic
// - Pressing a topic calls onToggle with it
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/topic-step-fields.test.tsx
//
// SEE: apps/mobile/src/components/topic-step-fields.tsx

import { TOPICS } from "@fluency-lab/shared";
import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { TopicStepFields } from "@/components/topic-step-fields";

describe("TopicStepFields", () => {
  it("draws the count and a chip for every topic", async () => {
    await render(<TopicStepFields value={[TOPICS[0].id, TOPICS[1].id]} onToggle={jest.fn()} />);
    expect(screen.getByText("2 selected")).toBeTruthy();
    for (const topic of TOPICS) {
      expect(screen.getByRole("checkbox", { name: topic.label })).toBeTruthy();
    }
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(2);
  });

  it("draws 0 selected when no topic is chosen", async () => {
    await render(<TopicStepFields value={[]} onToggle={jest.fn()} />);
    expect(screen.getByText("0 selected")).toBeTruthy();
  });

  it("calls onToggle with the pressed topic", async () => {
    const onToggle = jest.fn();
    await render(<TopicStepFields value={[]} onToggle={onToggle} />);
    await fireEvent.press(screen.getByRole("checkbox", { name: TOPICS[2].label }));
    expect(onToggle).toHaveBeenCalledWith(TOPICS[2].id);
  });
});
