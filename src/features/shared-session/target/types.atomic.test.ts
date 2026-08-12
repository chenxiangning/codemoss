import { describe, expect, it } from "vitest";
import {
  isAtomicExecutionTarget,
  isResolvedExecutionTarget,
} from "./types";

describe("isAtomicExecutionTarget", () => {
  it("accepts PI native local target that Shared resolver rejects", () => {
    const target = {
      engine: "pi" as const,
      providerProfileId: null,
      modelCatalogEntryId: "kimi-coding/k3",
      model: "kimi-coding/k3",
      providerProfileNameSnapshot: "本地配置",
      providerProfileSource: "disk" as const,
      reasoning: null,
    };
    expect(isAtomicExecutionTarget(target)).toBe(true);
    expect(isResolvedExecutionTarget(target)).toBe(false);
  });

  it("still accepts shared engines as both atomic and resolved", () => {
    const target = {
      engine: "kimi" as const,
      providerProfileId: null,
      modelCatalogEntryId: "kimi-k3",
      model: "kimi-k3",
      providerProfileNameSnapshot: "本地配置",
      providerProfileSource: "disk" as const,
      reasoning: null,
    };
    expect(isAtomicExecutionTarget(target)).toBe(true);
    expect(isResolvedExecutionTarget(target)).toBe(true);
  });
});
