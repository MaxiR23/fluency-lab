// apps/mobile/test/keys/secure-store-keys.test.ts
//
// Tests for the secure store adapter of the key port, over an injected fake store.
//
// Tested:
// - saveApiKey: the item name, the accessibility option and the stored value
// - deleteApiKey: the item name, a missing item, a rejected delete
// - hasApiKey: a stored key, no key, an empty item, a rejected read
// - readApiKey: the stored key, no key, an empty item, a rejected read
// - A rejected write, a thrown non-Error value
// - The key never reaches the failure cause
//
// What is covered:
// - Normal case, edges. The empty case of a delete is an item that was never stored.
//
// Run with: pnpm exec jest apps/mobile/test/keys/secure-store-keys.test.ts
//
// SEE: apps/mobile/src/keys/secure-store-keys.ts

import { describe, expect, it, jest } from "@jest/globals";

import { createSecureStoreKeys } from "@/keys/secure-store-keys";
import { generatedSecret } from "../helpers/generated-secret";

type SetItem = (
  key: string,
  value: string,
  options: { keychainAccessible: string },
) => Promise<void>;

type DeleteItem = (key: string) => Promise<void>;

type GetItem = (key: string) => Promise<string | null>;

function setup(
  setItemAsync: SetItem = async () => undefined,
  deleteItemAsync: DeleteItem = async () => undefined,
  getItemAsync: GetItem = async () => null,
) {
  const store = jest.fn<SetItem>(setItemAsync);
  const remove = jest.fn<DeleteItem>(deleteItemAsync);
  const read = jest.fn<GetItem>(getItemAsync);
  const port = createSecureStoreKeys({
    setItemAsync: store,
    deleteItemAsync: remove,
    getItemAsync: read,
    keychainAccessible: "this-device-only",
  });
  return { port, store, remove, read };
}

describe("saveApiKey", () => {
  it("stores the key under api_key with the this-device-only accessibility", async () => {
    const key = generatedSecret("api-key");
    const { port, store } = setup();

    expect(await port.saveApiKey(key)).toEqual({ ok: true, value: null });
    expect(store).toHaveBeenCalledTimes(1);
    expect(store).toHaveBeenCalledWith("api_key", key, { keychainAccessible: "this-device-only" });
  });

  it("returns not_saved with the cause when the store rejects", async () => {
    const { port } = setup(async () => {
      throw new Error("keychain locked");
    });

    expect(await port.saveApiKey(generatedSecret("api-key"))).toEqual({
      ok: false,
      failure: "not_saved",
      cause: { name: "Error", detail: null },
    });
  });

  it("returns not_saved when the store throws a non-Error value", async () => {
    const { port } = setup(async () => {
      throw "denied";
    });

    expect(await port.saveApiKey(generatedSecret("api-key"))).toEqual({
      ok: false,
      failure: "not_saved",
      cause: { name: "unknown", detail: null },
    });
  });

  it("never puts the key in the failure cause", async () => {
    const key = generatedSecret("api-key");
    const { port } = setup(async () => {
      const error = new TypeError(`Network request failed ${key}`);
      error.name = "TypeError";
      throw error;
    });

    const outcome = await port.saveApiKey(key);

    expect(JSON.stringify(outcome)).not.toContain(key);
    expect(outcome).toMatchObject({ ok: false, cause: { detail: null } });
  });
});

describe("deleteApiKey", () => {
  it("deletes the api_key item", async () => {
    const { port, remove } = setup();

    expect(await port.deleteApiKey()).toEqual({ ok: true, value: null });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith("api_key");
  });

  it("succeeds when no key was stored", async () => {
    // INFO: deleteItemAsync resolves on a missing item, so it is the same call.
    const { port } = setup(undefined, async () => undefined);

    expect(await port.deleteApiKey()).toEqual({ ok: true, value: null });
  });

  it("returns not_deleted with the cause when the store rejects", async () => {
    const { port } = setup(undefined, async () => {
      throw new Error("keychain locked");
    });

    expect(await port.deleteApiKey()).toEqual({
      ok: false,
      failure: "not_deleted",
      cause: { name: "Error", detail: null },
    });
  });

  it("returns not_deleted when the store throws a non-Error value", async () => {
    const { port } = setup(undefined, async () => {
      throw "denied";
    });

    expect(await port.deleteApiKey()).toEqual({
      ok: false,
      failure: "not_deleted",
      cause: { name: "unknown", detail: null },
    });
  });

  it("never puts a key in the failure cause", async () => {
    const key = generatedSecret("api-key");
    const { port } = setup(undefined, async () => {
      const error = new TypeError(`Network request failed ${key}`);
      error.name = "TypeError";
      throw error;
    });

    const outcome = await port.deleteApiKey();

    expect(JSON.stringify(outcome)).not.toContain(key);
    expect(outcome).toMatchObject({ ok: false, cause: { detail: null } });
  });
});

describe("hasApiKey", () => {
  it("reports a saved key as present and reads the api_key item", async () => {
    const { port, read } = setup(undefined, undefined, async () => generatedSecret("api-key"));

    expect(await port.hasApiKey()).toEqual({ ok: true, value: true });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith("api_key");
  });

  it("reports no key when the item is missing", async () => {
    const { port } = setup(undefined, undefined, async () => null);

    expect(await port.hasApiKey()).toEqual({ ok: true, value: false });
  });

  it("reports no key for an empty item", async () => {
    const { port } = setup(undefined, undefined, async () => "");

    expect(await port.hasApiKey()).toEqual({ ok: true, value: false });
  });

  it("returns not_read with the error name and no detail when the read rejects", async () => {
    const { port } = setup(undefined, undefined, async () => {
      throw new Error("keychain locked");
    });

    expect(await port.hasApiKey()).toEqual({
      ok: false,
      failure: "not_read",
      cause: { name: "Error", detail: null },
    });
  });

  it("returns not_read when the read throws a non-Error value", async () => {
    const { port } = setup(undefined, undefined, async () => {
      throw "denied";
    });

    expect(await port.hasApiKey()).toEqual({
      ok: false,
      failure: "not_read",
      cause: { name: "unknown", detail: null },
    });
  });

  it("never puts the stored value in the outcome", async () => {
    const key = generatedSecret("api-key");
    const { port } = setup(undefined, undefined, async () => key);

    expect(JSON.stringify(await port.hasApiKey())).not.toContain(key);
  });
});

describe("readApiKey", () => {
  it("returns the stored key and reads the api_key item", async () => {
    const key = generatedSecret("api-key");
    const { port, read } = setup(undefined, undefined, async () => key);

    expect(await port.readApiKey()).toEqual({ ok: true, value: key });
    expect(read).toHaveBeenCalledWith("api_key");
  });

  it("returns null when there is no key", async () => {
    const { port } = setup(undefined, undefined, async () => null);

    expect(await port.readApiKey()).toEqual({ ok: true, value: null });
  });

  it("returns null for an empty item", async () => {
    const { port } = setup(undefined, undefined, async () => "");

    expect(await port.readApiKey()).toEqual({ ok: true, value: null });
  });

  it("returns not_read without the key when the read rejects", async () => {
    const key = generatedSecret("api-key");
    const { port } = setup(undefined, undefined, async () => {
      const error = new TypeError(`Network request failed ${key}`);
      error.name = "TypeError";
      throw error;
    });

    const outcome = await port.readApiKey();

    expect(outcome).toEqual({
      ok: false,
      failure: "not_read",
      cause: { name: "TypeError", detail: null },
    });
    expect(JSON.stringify(outcome)).not.toContain(key);
  });
});
