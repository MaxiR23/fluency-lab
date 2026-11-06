// apps/mobile/test/components/corrections-card.test.tsx
//
// Tests for CorrectionsCard.
//
// Tested:
// - The count, the struck originals, the corrections and the explanation
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/corrections-card.test.tsx
//
// SEE: apps/mobile/src/components/corrections-card.tsx

import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { CorrectionsCard } from "@/components/corrections-card";
import { colors } from "@/constants/theme";

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

  it("omits the explanation line when there is none", async () => {
    await render(<CorrectionsCard corrections={corrections} explanation={null} />);
    expect(screen.queryByText("Go is irregular.")).toBeNull();
    expect(screen.getByText("2 corrections")).toBeTruthy();
  });
});
