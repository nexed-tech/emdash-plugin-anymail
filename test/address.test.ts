import { describe, expect, it } from "vitest";

import { formatAddress, parseAddress, toAddressList } from "../src/core/address";

describe("parseAddress", () => {
  it("parses a bare address", () => {
    expect(parseAddress("a@b.com")).toEqual({ email: "a@b.com" });
  });

  it("parses a named address", () => {
    expect(parseAddress("Ada Lovelace <ada@example.com>")).toEqual({
      email: "ada@example.com",
      name: "Ada Lovelace",
    });
  });

  it("parses a quoted display name", () => {
    expect(parseAddress('"Lovelace, Ada" <ada@example.com>')).toEqual({
      email: "ada@example.com",
      name: "Lovelace, Ada",
    });
  });

  it("passes an Address object through", () => {
    expect(parseAddress({ email: "x@y.com", name: "X" })).toEqual({ email: "x@y.com", name: "X" });
  });

  it("falls back to a bare email for unparseable input", () => {
    expect(parseAddress("not an email")).toEqual({ email: "not an email" });
  });
});

describe("formatAddress", () => {
  it("formats with and without a name", () => {
    expect(formatAddress({ email: "a@b.com" })).toBe("a@b.com");
    expect(formatAddress({ email: "a@b.com", name: "A B" })).toBe("A B <a@b.com>");
  });
});

describe("toAddressList", () => {
  it("normalises undefined / one / many", () => {
    expect(toAddressList(undefined)).toEqual([]);
    expect(toAddressList("a@b.com")).toEqual([{ email: "a@b.com" }]);
    expect(toAddressList(["a@b.com", "C <c@d.com>"])).toEqual([
      { email: "a@b.com" },
      { email: "c@d.com", name: "C" },
    ]);
  });
});
