import { describe, expect, it } from "vitest";
import { applyOptimisticActiveProvider } from "./applyOptimisticActiveProvider";
import { DISABLED_PROVIDER_ID } from "./types";

describe("applyOptimisticActiveProvider", () => {
  const providers = [
    { id: "a", isActive: false },
    { id: "b", isActive: true },
    { id: "c" },
  ];

  it("activates the target and clears other actives", () => {
    const next = applyOptimisticActiveProvider(providers, "a");
    expect(next.map((p) => [p.id, p.isActive])).toEqual([
      ["a", true],
      ["b", false],
      ["c", false],
    ]);
  });

  it("disables all when target is DISABLED_PROVIDER_ID", () => {
    const next = applyOptimisticActiveProvider(providers, DISABLED_PROVIDER_ID);
    expect(next.every((p) => p.isActive === false)).toBe(true);
  });

  it("preserves object identity for unchanged rows", () => {
    const already = [
      { id: "a", isActive: true },
      { id: "b", isActive: false },
    ];
    const next = applyOptimisticActiveProvider(already, "a");
    expect(next[0]).toBe(already[0]);
    expect(next[1]).toBe(already[1]);
  });
});
