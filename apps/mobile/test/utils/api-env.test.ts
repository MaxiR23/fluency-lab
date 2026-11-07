// apps/mobile/test/utils/api-env.test.ts
//
// Tests for readApiUrl, metroHost and withHost.
//
// Tested:
// - The API url is read, and a missing one fails at load
// - Metro host parsed in development only
// - The host of an env URL replaced keeping scheme, port, path
// - readApiUrl with and without a host
//
// What is covered:
// - Normal case, empty case, edges
//
// Run with: pnpm exec jest apps/mobile/test/utils/api-env.test.ts
//
// SEE: apps/mobile/src/utils/api-env.ts

import { describe, expect, it } from "@jest/globals";

import { metroHost, readApiUrl, withHost } from "@/utils/api-env";

describe("readApiUrl", () => {
  it("returns the url", () => {
    expect(readApiUrl("http://host:3000")).toBe("http://host:3000");
  });

  it("throws naming EXPO_PUBLIC_API_URL when it is missing", () => {
    expect(() => readApiUrl(undefined)).toThrow("EXPO_PUBLIC_API_URL");
  });

  it("treats a blank value as missing", () => {
    expect(() => readApiUrl("   ")).toThrow("EXPO_PUBLIC_API_URL");
  });

  it("drops a trailing slash", () => {
    expect(readApiUrl("http://host:3000/")).toBe("http://host:3000");
  });

  it("does not put the value in the error message", () => {
    expect.assertions(1);
    try {
      readApiUrl("   ");
    } catch (error) {
      expect(String(error)).not.toContain("   ");
    }
  });
});

describe("metroHost", () => {
  it("returns the host of a LAN hostUri without its port", () => {
    expect(metroHost(true, "192.168.1.89:8081")).toBe("192.168.1.89");
  });

  it("returns a hostname as it is", () => {
    expect(metroHost(true, "localhost:8081")).toBe("localhost");
  });

  it("returns a host with no port", () => {
    expect(metroHost(true, "192.168.1.89")).toBe("192.168.1.89");
  });

  it("keeps the brackets of an IPv6 host", () => {
    expect(metroHost(true, "[::1]:8081")).toBe("[::1]");
    expect(metroHost(true, "[fe80::1]")).toBe("[fe80::1]");
  });

  it("returns null for a missing hostUri", () => {
    expect(metroHost(true, undefined)).toBeNull();
  });

  it("returns null for an empty or blank hostUri", () => {
    expect(metroHost(true, "")).toBeNull();
    expect(metroHost(true, "   ")).toBeNull();
  });

  it("returns null outside development", () => {
    expect(metroHost(false, "192.168.1.89:8081")).toBeNull();
  });

  it("returns null for a port with no host", () => {
    expect(metroHost(true, ":8081")).toBeNull();
  });

  it("returns null for a colon with no port", () => {
    expect(metroHost(true, "192.168.1.89:")).toBeNull();
  });

  it("returns null for a port that is not a number", () => {
    expect(metroHost(true, "192.168.1.89:80a")).toBeNull();
  });

  it("returns null for an IPv6 host without brackets", () => {
    expect(metroHost(true, "::1:8081")).toBeNull();
  });

  it("returns null for an unclosed or empty bracket", () => {
    expect(metroHost(true, "[::1")).toBeNull();
    expect(metroHost(true, "[]:8081")).toBeNull();
  });

  it("returns null for a value with a path or spaces", () => {
    expect(metroHost(true, "192.168.1.89:8081/x")).toBeNull();
    expect(metroHost(true, "192.168 .1.89")).toBeNull();
  });
});

describe("withHost", () => {
  it("replaces the host and keeps scheme and port", () => {
    expect(withHost("http://192.168.1.88:3000", "192.168.1.89")).toBe("http://192.168.1.89:3000");
  });

  it("keeps the path and the query", () => {
    expect(withHost("http://192.168.1.88:54321/auth/v1?x=1", "192.168.1.89")).toBe(
      "http://192.168.1.89:54321/auth/v1?x=1",
    );
  });

  it("keeps https and a url with no port", () => {
    expect(withHost("https://api.example.com", "10.0.0.2")).toBe("https://10.0.0.2");
  });

  it("puts an IPv6 host with its brackets", () => {
    expect(withHost("http://192.168.1.88:3000", "[::1]")).toBe("http://[::1]:3000");
  });

  it("replaces an IPv6 host", () => {
    expect(withHost("http://[fe80::1]:3000", "192.168.1.89")).toBe("http://192.168.1.89:3000");
  });

  it("returns the url as it is for a null host", () => {
    expect(withHost("http://192.168.1.88:3000", null)).toBe("http://192.168.1.88:3000");
  });

  it("returns a value that is not a url as it is", () => {
    expect(withHost("not a url", "192.168.1.89")).toBe("not a url");
  });
});

describe("readApiUrl with a host", () => {
  it("puts Metro's host in the API url and drops the trailing slash", () => {
    expect(readApiUrl("http://192.168.1.88:3000/", "192.168.1.89")).toBe(
      "http://192.168.1.89:3000",
    );
  });

  it("returns the env url as it is with a null host", () => {
    expect(readApiUrl("http://192.168.1.88:3000", null)).toBe("http://192.168.1.88:3000");
  });
});
