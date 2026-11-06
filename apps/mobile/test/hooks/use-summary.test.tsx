// apps/mobile/test/hooks/use-summary.test.tsx
//
// Tests for the Summary hook.
//
// Tested:
// - The profile and the session's summary are read once and the state is ready
// - A failed read of either one is a failed state
// - Without a session id nothing is read and the state is failed as not_found
// - retry goes back to loading and reads again
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/hooks/use-summary.test.tsx
//
// SEE: apps/mobile/src/hooks/use-summary.ts

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useSummary } from "@/hooks/use-summary";
import { completedProfile, fakeData, resetFakeData, summaryWith } from "../helpers/fake-data";

jest.mock("@/data", () => ({
  data: jest.requireActual<typeof import("../helpers/fake-data")>("../helpers/fake-data").fakeData,
}));

describe("useSummary", () => {
  beforeEach(() => {
    resetFakeData();
  });

  it("reads the profile and the session's summary and is ready", async () => {
    const summary = summaryWith({ messageCount: 4 });
    fakeData.getSessionSummary.mockResolvedValue({ ok: true, value: summary });
    const { result } = await renderHook(() => useSummary("session-1"));
    await waitFor(() => expect(result.current.state.kind).toBe("ready"));
    expect(result.current.state).toEqual({
      kind: "ready",
      profile: completedProfile(),
      summary,
    });
    expect(fakeData.getSessionSummary).toHaveBeenCalledWith("session-1");
    expect(fakeData.getSessionSummary).toHaveBeenCalledTimes(1);
  });

  it("is failed with the summary's failure", async () => {
    fakeData.getSessionSummary.mockResolvedValue({ ok: false, failure: "not_found" });
    const { result } = await renderHook(() => useSummary("session-1"));
    await waitFor(() => expect(result.current.state.kind).toBe("failed"));
    expect(result.current.state).toEqual({ kind: "failed", failure: "not_found" });
  });

  it("is failed with the profile's failure", async () => {
    fakeData.getProfile.mockResolvedValue({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useSummary("session-1"));
    await waitFor(() => expect(result.current.state.kind).toBe("failed"));
    expect(result.current.state).toEqual({ kind: "failed", failure: "network" });
  });

  it("reads nothing and is failed as not_found without a session id", async () => {
    const { result } = await renderHook(() => useSummary(null));
    expect(result.current.state).toEqual({ kind: "failed", failure: "not_found" });
    await act(async () => result.current.retry());
    expect(result.current.state).toEqual({ kind: "failed", failure: "not_found" });
    expect(fakeData.getSessionSummary).not.toHaveBeenCalled();
    expect(fakeData.getProfile).not.toHaveBeenCalled();
  });

  it("retry goes back to loading and reads again", async () => {
    fakeData.getSessionSummary.mockResolvedValueOnce({ ok: false, failure: "network" });
    const { result } = await renderHook(() => useSummary("session-1"));
    await waitFor(() => expect(result.current.state.kind).toBe("failed"));

    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current.retry();
    });
    await act(async () => pending);

    expect(result.current.state.kind).toBe("ready");
    expect(fakeData.getSessionSummary).toHaveBeenCalledTimes(2);
  });
});
