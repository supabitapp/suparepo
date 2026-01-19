import { describe, expect, test } from "vitest";
import { calculateSavings, formatBytes } from "./format";

describe("formatBytes", () => {
  test("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });
  test("formats KB", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("2 KB");
  });
  test("formats MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 * 1024 * 2.5)).toBe("2.5 MB");
  });
});

describe("calculateSavings", () => {
  test("calculates percentage", () => {
    expect(calculateSavings(100, 80)).toBe(20);
    expect(calculateSavings(1000, 500)).toBe(50);
  });
  test("handles zero", () => expect(calculateSavings(0, 100)).toBe(0));
  test("handles negative", () => expect(calculateSavings(100, 120)).toBe(-20));
});
