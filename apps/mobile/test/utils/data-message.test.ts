// apps/mobile/test/utils/data-message.test.ts
//
// Tests for the messages of data and key failures.
//
// Tested:
// - One message per data failure
// - The message of a key that could not be saved
//
// What is covered:
// - Normal case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/data-message.test.ts
//
// SEE: apps/mobile/src/utils/data-message.ts

import { describe, expect, it } from "@jest/globals";

import type { DataFailure } from "@/data/data-port";
import { dataFailureMessage, keySaveFailureMessage } from "@/utils/data-message";

describe("dataFailureMessage", () => {
  it("tells the user to check the connection on network", () => {
    expect(dataFailureMessage("network")).toBe(
      "Could not reach the server. Check your connection and try again.",
    );
  });

  it("tells the user to sign in again on unauthorized", () => {
    expect(dataFailureMessage("unauthorized")).toBe("Your session ended. Sign in again.");
  });

  it.each<DataFailure>(["unavailable", "not_found", "invalid_input", "bad_response"])(
    "shows the generic message for %s",
    (failure) => {
      expect(dataFailureMessage(failure)).toBe(
        "Something went wrong. Wait a moment and try again.",
      );
    },
  );
});

describe("keySaveFailureMessage", () => {
  it("says the key was not saved on this device", () => {
    expect(keySaveFailureMessage).toBe("Could not save your key on this device. Try again.");
  });
});
