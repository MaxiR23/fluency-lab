// apps/mobile/test/components/result-list.test.tsx
//
// Tests for ResultList.
//
// Tested:
// - A row per rule with its count, a check when all right and an X when a miss
//
// What is covered:
// - Normal case, empty case
//
// Run with: pnpm exec jest apps/mobile/test/components/result-list.test.tsx
//
// SEE: apps/mobile/src/components/result-list.tsx

import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";

import { ResultList } from "@/components/result-list";

describe("ResultList", () => {
  it("draws a row per rule with its count", async () => {
    await render(
      <ResultList
        rows={[
          { label: "Going to vs will", right: 2, total: 2, allRight: true },
          { label: "Present perfect", right: 0, total: 1, allRight: false },
        ]}
      />,
    );
    expect(screen.getByText("Going to vs will")).toBeTruthy();
    expect(screen.getByText("2/2")).toBeTruthy();
    expect(screen.getByText("Present perfect")).toBeTruthy();
    expect(screen.getByText("0/1")).toBeTruthy();
    expect(screen.getAllByTestId("list-row")).toHaveLength(2);
  });

  it("draws a check for a row all right and an X for a miss", async () => {
    await render(
      <ResultList
        rows={[
          { label: "A", right: 1, total: 1, allRight: true },
          { label: "B", right: 0, total: 1, allRight: false },
        ]}
      />,
    );
    expect(screen.getAllByTestId("icon-check", { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getAllByTestId("icon-close", { includeHiddenElements: true })).toHaveLength(1);
  });

  it("draws nothing for no rows", async () => {
    await render(<ResultList rows={[]} />);
    expect(screen.queryByTestId("list-row")).toBeNull();
  });
});
