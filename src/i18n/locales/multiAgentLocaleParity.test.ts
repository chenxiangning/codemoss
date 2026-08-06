import { describe, expect, it } from "vitest";

import en from "./en/multiAgent";
import zh from "./zh/multiAgent";

type Bundle = { multiAgent: Record<string, unknown> };

function flattenKeys(node: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenKeys(value as Record<string, unknown>, path);
    }
    return [path];
  });
}

function valueAt(node: Record<string, unknown>, path: string): string {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, segment) => (acc as Record<string, unknown>)[segment],
      node,
    ) as string;
}

function placeholders(value: string) {
  return (value.match(/\{\{[^}]+\}\}/g) ?? []).sort();
}

describe("multiAgent locale parity", () => {
  const enKeys = flattenKeys((en as Bundle).multiAgent).sort();
  const zhKeys = flattenKeys((zh as Bundle).multiAgent).sort();

  it("zh and en share the same key set", () => {
    expect(zhKeys).toEqual(enKeys);
  });

  it("zh mirrors en interpolation placeholders", () => {
    enKeys.forEach((path) => {
      expect(placeholders(valueAt((zh as Bundle).multiAgent, path))).toEqual(
        placeholders(valueAt((en as Bundle).multiAgent, path)),
      );
    });
  });
});
