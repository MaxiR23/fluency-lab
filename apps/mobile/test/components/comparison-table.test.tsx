// apps/mobile/test/components/comparison-table.test.tsx
//
// Tests for ComparisonTable, the table of a study note.
//
// Tested:
// - It draws a header row with the labels, then one row per entry
// - The last row has no divider under it
// - A one column summary has no header
// - The rows get a motion only when one is given
//
// What is covered:
// - Normal case, summary, edges
//
// Run with: pnpm exec jest apps/mobile/test/components/comparison-table.test.tsx
//
// SEE: apps/mobile/src/components/comparison-table.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { ComparisonTable } from "@/components/comparison-table";
import { comparisonTableStyle } from "@/components/comparison-table-style";
import { noteMotion, rowMotion } from "@/utils/note-motion";
import { rowTransition } from "@/utils/note-transitions";

const columns = ["Form", "When", "Example"];
const rows = [
  ["Going to", "Plans", "It's going to rain."],
  ["Will", "Decisions now", "I'll call you later."],
];

describe("ComparisonTable", () => {
  it("draws the header labels and every cell", async () => {
    await render(<ComparisonTable columns={columns} rows={rows} />);
    for (const text of [...columns, ...rows.flat()]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it("draws the first cell as the lead, the second muted and the third plain", async () => {
    await render(<ComparisonTable columns={columns} rows={rows} />);
    expect(StyleSheet.flatten(screen.getByText("Going to").props.style).fontFamily).toBe(
      "PlusJakartaSans_700Bold",
    );
    expect(StyleSheet.flatten(screen.getByText("Plans").props.style).color).toBe("#A3A3A3");
    expect(StyleSheet.flatten(screen.getByText("It's going to rain.").props.style).color).toBe(
      "#F5F5F5",
    );
  });

  it("draws the header apart from the rows", async () => {
    await render(<ComparisonTable columns={columns} rows={rows} />);
    expect(screen.getByTestId("table-header")).toBeTruthy();
    expect(screen.getAllByTestId(/^table-row-/)).toHaveLength(2);
  });

  it("draws no divider under the last row", async () => {
    await render(<ComparisonTable columns={columns} rows={rows} />);
    const first = StyleSheet.flatten(screen.getByTestId("table-row-0").props.style);
    const last = StyleSheet.flatten(screen.getByTestId("table-row-1").props.style);
    expect(first).toMatchObject(comparisonTableStyle().row(false));
    expect(last.borderBottomWidth).toBeUndefined();
  });

  it("draws a one column summary with no header", async () => {
    await render(
      <ComparisonTable columns={null} rows={[["Use it for experience."], ["Or news."]]} />,
    );
    expect(screen.queryByTestId("table-header")).toBeNull();
    expect(screen.getByText("Use it for experience.")).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText("Or news.").props.style).color).toBe("#F5F5F5");
  });

  it("gives the rows a motion only when one is given", async () => {
    const { rerender } = await render(<ComparisonTable columns={columns} rows={rows} />);
    expect(screen.getByTestId("table-row-0").props.entering).toBeUndefined();
    await rerender(
      <ComparisonTable
        columns={columns}
        rows={rows}
        row={(index) => rowTransition(rowMotion(noteMotion(false), index))}
      />,
    );
    expect(screen.getByTestId("table-row-0").props.entering).toBeDefined();
    expect(screen.getByTestId("table-row-1").props.entering.getDelay()).toBe(250);
  });
});
