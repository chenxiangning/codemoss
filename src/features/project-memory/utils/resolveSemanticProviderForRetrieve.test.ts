// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveSemanticProviderForRetrieve,
  __resetBundledEmbeddingProviderCacheForTests,
} from "./resolveSemanticProviderForRetrieve";
import {
  SEMANTIC_RETRIEVAL_PREFERENCE_KEY,
  setSemanticRetrievalPreference,
} from "./semanticRetrievalPreference";
import type { ProjectMemoryEmbeddingProvider } from "./projectMemorySemanticRetrieval";

afterEach(() => {
  __resetBundledEmbeddingProviderCacheForTests();
  window.localStorage.removeItem(SEMANTIC_RETRIEVAL_PREFERENCE_KEY);
  vi.restoreAllMocks();
});

function mockProvider(
  status: "available" | "unavailable" | "error",
): ProjectMemoryEmbeddingProvider {
  return {
    providerId: "test",
    modelId: "test-model",
    dimensions: 4,
    embeddingVersion: "test-v1",
    scope: "test",
    health: () => ({ status }),
    embed: () => [0.1, 0.2, 0.3, 0.4],
  };
}

describe("resolveSemanticProviderForRetrieve", () => {
  it("returns null when disabled", async () => {
    const provider = await resolveSemanticProviderForRetrieve({
      disabled: true,
      override: mockProvider("available"),
    });
    expect(provider).toBeNull();
  });

  it("returns override only when health available", async () => {
    await expect(
      resolveSemanticProviderForRetrieve({
        override: mockProvider("available"),
      }),
    ).resolves.toMatchObject({ providerId: "test" });

    await expect(
      resolveSemanticProviderForRetrieve({
        override: mockProvider("unavailable"),
      }),
    ).resolves.toBeNull();
  });

  it("returns null when override is null", async () => {
    await expect(
      resolveSemanticProviderForRetrieve({ override: null }),
    ).resolves.toBeNull();
  });

  it("returns null when user prefers lexical even if override available is ignored path", async () => {
    setSemanticRetrievalPreference("lexical");
    // production path without override — mock create is hard; preference short-circuits first
    await expect(resolveSemanticProviderForRetrieve({})).resolves.toBeNull();
  });

  it("override still works when user prefers lexical", async () => {
    setSemanticRetrievalPreference("lexical");
    await expect(
      resolveSemanticProviderForRetrieve({
        override: mockProvider("available"),
      }),
    ).resolves.toMatchObject({ providerId: "test" });
  });
});
