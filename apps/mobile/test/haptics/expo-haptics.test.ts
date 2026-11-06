// apps/mobile/test/haptics/expo-haptics.test.ts
//
// Tests for the expo-haptics adapter of the haptics port, over injected fake functions.
//
// Tested:
// - A tab press plays a selection and Send plays a light impact
// - A rejected library call returns not_played
//
// What is covered:
// - Normal case, edges. There is no expected empty case (play returns no data) and no
//   separate transport case: a rejection is the only failure.
//
// Run with: pnpm exec jest apps/mobile/test/haptics/expo-haptics.test.ts
//
// SEE: apps/mobile/src/haptics/expo-haptics.ts

import { describe, expect, it, jest } from "@jest/globals";

import { createExpoHaptics } from "@/haptics/expo-haptics";

function setup(failure?: Error) {
  const impactAsync = jest.fn<(style: string) => Promise<void>>(async () => {
    if (failure !== undefined) throw failure;
  });
  const selectionAsync = jest.fn<() => Promise<void>>(async () => {
    if (failure !== undefined) throw failure;
  });
  const port = createExpoHaptics({ impactAsync, selectionAsync, light: "light-style" });
  return { port, impactAsync, selectionAsync };
}

describe("play", () => {
  it("plays a selection for a tab", async () => {
    const { port, impactAsync, selectionAsync } = setup();

    expect(await port.play("tab")).toEqual({ ok: true, value: null });
    expect(selectionAsync).toHaveBeenCalledTimes(1);
    expect(impactAsync).not.toHaveBeenCalled();
  });

  it("plays a light impact for send", async () => {
    const { port, impactAsync, selectionAsync } = setup();

    expect(await port.play("send")).toEqual({ ok: true, value: null });
    expect(impactAsync).toHaveBeenCalledWith("light-style");
    expect(selectionAsync).not.toHaveBeenCalled();
  });

  it("returns not_played when the library rejects", async () => {
    const { port } = setup(new Error("no engine"));

    expect(await port.play("tab")).toEqual({
      ok: false,
      failure: "not_played",
      cause: { name: "Error", detail: null },
    });
    expect(await port.play("send")).toMatchObject({ ok: false, failure: "not_played" });
  });
});
