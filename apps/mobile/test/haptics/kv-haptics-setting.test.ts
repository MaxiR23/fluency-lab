// apps/mobile/test/haptics/kv-haptics-setting.test.ts
//
// Tests for the key-value adapter of the haptics setting port, over an injected fake store.
//
// Tested:
// - read: off is false, a missing item is on, a rejected read returns not_read
// - save: on and off are stored as the strings on and off, a rejected write returns not_saved
//
// What is covered:
// - Normal case, empty case (a missing item), edges
//
// Run with: pnpm exec jest apps/mobile/test/haptics/kv-haptics-setting.test.ts
//
// SEE: apps/mobile/src/haptics/kv-haptics-setting.ts

import { describe, expect, it, jest } from "@jest/globals";

import { createKvHapticsSetting } from "@/haptics/kv-haptics-setting";

function setup(stored: string | null = null, failure?: Error) {
  const getItem = jest.fn<(key: string) => Promise<string | null>>(async () => {
    if (failure !== undefined) throw failure;
    return stored;
  });
  const setItem = jest.fn<(key: string, value: string) => Promise<void>>(async () => {
    if (failure !== undefined) throw failure;
  });
  return { port: createKvHapticsSetting({ getItem, setItem }), getItem, setItem };
}

describe("read", () => {
  it("reads off as false from the haptics item", async () => {
    const { port, getItem } = setup("off");

    expect(await port.read()).toEqual({ ok: true, value: false });
    expect(getItem).toHaveBeenCalledWith("haptics");
  });

  it("reads on as true", async () => {
    expect(await setup("on").port.read()).toEqual({ ok: true, value: true });
  });

  it("reads a missing item as on", async () => {
    expect(await setup(null).port.read()).toEqual({ ok: true, value: true });
  });

  it("returns not_read when reading rejects", async () => {
    expect(await setup(null, new Error("disk")).port.read()).toEqual({
      ok: false,
      failure: "not_read",
      cause: { name: "Error", detail: null },
    });
  });
});

describe("save", () => {
  it("saves on and off as the strings on and off", async () => {
    const { port, setItem } = setup();

    expect(await port.save(false)).toEqual({ ok: true, value: null });
    expect(setItem).toHaveBeenLastCalledWith("haptics", "off");
    expect(await port.save(true)).toEqual({ ok: true, value: null });
    expect(setItem).toHaveBeenLastCalledWith("haptics", "on");
  });

  it("returns not_saved when writing rejects", async () => {
    expect(await setup(null, new Error("disk")).port.save(false)).toEqual({
      ok: false,
      failure: "not_saved",
      cause: { name: "Error", detail: null },
    });
  });
});
