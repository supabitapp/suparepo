import { afterEach, describe, expect, test } from "vitest";
import { detectConcurrency } from "./index";

const setNavigator = (value: Navigator | undefined) => {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
  });
};

describe("detectConcurrency", () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    if (originalNavigator) {
      setNavigator(originalNavigator);
    } else {
      delete (globalThis as typeof globalThis & { navigator?: Navigator }).navigator;
    }
  });

  test("clamps to 1-4", () => {
    setNavigator({ hardwareConcurrency: 16 } as Navigator);
    expect(detectConcurrency()).toBe(4);
    setNavigator({ hardwareConcurrency: 1 } as Navigator);
    expect(detectConcurrency()).toBe(1);
  });
  test("fallback to 1", () => {
    setNavigator(undefined);
    expect(detectConcurrency()).toBe(1);
  });
});
