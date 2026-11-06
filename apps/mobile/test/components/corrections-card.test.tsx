// apps/mobile/test/components/corrections-card.test.tsx
//
// Tests for CorrectionsCard.
//
// Tested:
// - The count, the struck originals, the corrections and the explanation
// - The ask row with the reply count, a withdrawn correction and the pinned card of a thread
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/corrections-card.test.tsx
//
// SEE: apps/mobile/src/components/corrections-card.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { CorrectionsCard } from "@/components/corrections-card";
import { colors, spacing } from "@/constants/theme";
import { chatMotion } from "@/utils/chat-motion";
import { enterTransition } from "@/utils/chat-transitions";

const corrections = [
  { original: "goed", corrected: "went" },
  { original: "a apple", corrected: "an apple" },
];

describe("CorrectionsCard", () => {
  it("draws the count, each struck original with its correction, and the explanation", async () => {
    await render(<CorrectionsCard corrections={corrections} explanation="Go is irregular." />);
    expect(screen.getByText("2 corrections")).toBeTruthy();
    const struck = screen.getByText("goed");
    expect(StyleSheet.flatten(struck.props.style).textDecorationLine).toBe("line-through");
    expect(screen.getByText(/went/)).toBeTruthy();
    expect(screen.getByText("a apple")).toBeTruthy();
    expect(screen.getByText(/an apple/)).toBeTruthy();
    expect(screen.getByText("Go is irregular.")).toBeTruthy();
  });

  it("draws the card on the sunken surface", async () => {
    await render(<CorrectionsCard corrections={[corrections[0]]} explanation={null} />);
    expect(screen.getByText("1 correction")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText("1 correction").parent?.props.style)).toMatchObject({
      backgroundColor: colors.surfaceSunken,
      borderColor: colors.border,
    });
  });

  it("draws two identical corrections without a duplicate key", async () => {
    const errors = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const same = { original: "goed", corrected: "went" };
    await render(<CorrectionsCard corrections={[same, same]} explanation={null} />);
    expect(screen.getByText("2 corrections")).toBeTruthy();
    expect(screen.getAllByText("goed")).toHaveLength(2);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("draws nothing for no corrections", async () => {
    await render(<CorrectionsCard corrections={[]} explanation="Ignored." />);
    expect(screen.toJSON()).toBeNull();
  });

  it("draws nothing for no corrections, with or without an entering animation", async () => {
    const entering = enterTransition(chatMotion(false).enter);
    await render(<CorrectionsCard corrections={[]} explanation={null} entering={entering} />);
    expect(screen.toJSON()).toBeNull();
  });

  it("draws the card with an entering animation", async () => {
    const entering = enterTransition(chatMotion(false).enter);
    await render(
      <CorrectionsCard corrections={corrections} explanation={null} entering={entering} />,
    );
    expect(screen.getByText("2 corrections")).toBeTruthy();
  });

  describe("the ask row", () => {
    it("draws Ask about this with the reply count and calls onPress", async () => {
      const onPress = jest.fn();
      await render(
        <CorrectionsCard
          corrections={corrections}
          explanation={null}
          ask={{ replies: "2 replies", onPress }}
        />,
      );
      expect(screen.getByText("Ask about this")).toBeTruthy();
      expect(screen.getByText("2 replies")).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Ask about this, 2 replies" }));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("draws no count without replies", async () => {
      await render(
        <CorrectionsCard
          corrections={corrections}
          explanation={null}
          ask={{ replies: null, onPress: () => {} }}
        />,
      );
      expect(screen.getByRole("button", { name: "Ask about this" })).toBeTruthy();
      expect(screen.queryByText(/repl/)).toBeNull();
    });

    it("draws no row without ask", async () => {
      await render(<CorrectionsCard corrections={corrections} explanation={null} />);
      expect(screen.queryByText("Ask about this")).toBeNull();
      expect(screen.queryAllByRole("button")).toEqual([]);
    });

    it("draws the card with the 6 bottom padding only with the ask row", async () => {
      await render(
        <CorrectionsCard
          corrections={corrections}
          explanation={null}
          ask={{ replies: null, onPress: () => {} }}
        />,
      );
      const card = screen.getByText("2 corrections").parent;
      expect(StyleSheet.flatten(card?.props.style).paddingBottom).toBe(spacing.stack);
    });
  });

  describe("a withdrawn correction", () => {
    const withdrawn = [
      { original: "goed", corrected: "went", withdrawn: true as const },
      { original: "a apple", corrected: "an apple" },
    ];

    it("draws one struck line in the placeholder color with the Withdrawn tag", async () => {
      await render(<CorrectionsCard corrections={withdrawn} explanation={null} />);
      const line = screen.getByText("goed → went");
      expect(StyleSheet.flatten(line.props.style)).toMatchObject({
        color: colors.textPlaceholder,
        textDecorationLine: "line-through",
      });
      expect(screen.getByText("Withdrawn")).toBeTruthy();
      expect(screen.getAllByText("Withdrawn")).toHaveLength(1);
    });

    it("keeps the active correction drawn as before", async () => {
      await render(<CorrectionsCard corrections={withdrawn} explanation={null} />);
      expect(screen.getByText("a apple")).toBeTruthy();
      expect(screen.getByText("2 corrections")).toBeTruthy();
    });

    it("draws the card when every correction is withdrawn", async () => {
      await render(<CorrectionsCard corrections={[withdrawn[0]]} explanation={null} />);
      expect(screen.getByText("1 correction")).toBeTruthy();
      expect(screen.getByText("Withdrawn")).toBeTruthy();
    });

    it("draws it the same in the pinned card", async () => {
      await render(
        <CorrectionsCard
          corrections={withdrawn}
          explanation={null}
          pinned={{ sentence: "I goed.", rule: null }}
        />,
      );
      expect(screen.getByText("goed → went")).toBeTruthy();
      expect(screen.getByText("Withdrawn")).toBeTruthy();
    });
  });

  describe("the pinned card", () => {
    it("draws the sentence first, no count, the rule at the bottom and no explanation", async () => {
      await render(
        <CorrectionsCard
          corrections={corrections}
          explanation="Go is irregular."
          pinned={{ sentence: "I goed home.", rule: "Spelling" }}
        />,
      );
      expect(screen.getByText("I goed home.")).toBeTruthy();
      expect(screen.queryByText("2 corrections")).toBeNull();
      expect(screen.queryByText("Go is irregular.")).toBeNull();
      expect(screen.getByText("Spelling")).toBeTruthy();
      const texts = screen.getAllByText(/./).map((node) => node.props.children);
      expect(texts[0]).toBe("I goed home.");
      expect(texts[texts.length - 1]).toBe("Spelling");
    });

    it("draws no rule line without a rule", async () => {
      await render(
        <CorrectionsCard
          corrections={corrections}
          explanation={null}
          pinned={{ sentence: "I goed home.", rule: null }}
        />,
      );
      expect(screen.getByText("I goed home.")).toBeTruthy();
      expect(screen.queryByText("Spelling")).toBeNull();
    });
  });

  it("omits the explanation line when there is none", async () => {
    await render(<CorrectionsCard corrections={corrections} explanation={null} />);
    expect(screen.queryByText("Go is irregular.")).toBeNull();
    expect(screen.getByText("2 corrections")).toBeTruthy();
  });
});
