import { normalizedLevenshtein } from "../utils/levenshtein";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(normalizedLevenshtein("hello", "hello")).toBe(0);
  });

  it("returns 1 for completely different strings", () => {
    expect(normalizedLevenshtein("abc", "xyz")).toBe(1);
  });

  it("detects similar strings", () => {
    expect(normalizedLevenshtein("Classic T-Shirt", "Classic TShirt")).toBeLessThan(0.2);
  });
});
