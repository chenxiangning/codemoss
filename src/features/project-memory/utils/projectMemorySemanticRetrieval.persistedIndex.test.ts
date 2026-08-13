import { describe, expect, it } from "vitest";
import type { ProjectMemoryItem } from "../../../services/tauri";
import {
  buildProjectMemoryEmbeddingContentHash,
  retrieveProjectMemorySemanticCandidates,
  type ProjectMemoryEmbeddingIndexRecord,
  type ProjectMemoryEmbeddingProvider,
} from "./projectMemorySemanticRetrieval";

function makeMemory(
  partial: Partial<ProjectMemoryItem> & { id: string },
): ProjectMemoryItem {
  return {
    id: partial.id,
    workspaceId: partial.workspaceId ?? "ws-1",
    kind: "note",
    title: partial.title ?? "Auth flow",
    summary: partial.summary ?? "OAuth login notes",
    cleanText: partial.cleanText ?? "oauth login refresh token",
    tags: partial.tags ?? ["auth"],
    importance: partial.importance ?? "medium",
    source: "manual",
    fingerprint: partial.id,
    createdAt: 1,
    updatedAt: partial.updatedAt ?? 100,
    detail: partial.detail ?? "oauth login refresh token",
    deletedAt: partial.deletedAt ?? null,
  };
}

function makeProvider(): ProjectMemoryEmbeddingProvider {
  return {
    providerId: "mock",
    modelId: "mock-dim4",
    dimensions: 4,
    embeddingVersion: "mock-v1",
    scope: "test",
    health: () => ({ status: "available" }),
    embed: (text: string) => {
      // 简单 bag-of-chars 伪向量，同义词可拉开
      const lower = text.toLowerCase();
      return [
        lower.includes("oauth") || lower.includes("login") ? 1 : 0,
        lower.includes("token") || lower.includes("会话") ? 1 : 0,
        lower.includes("auth") || lower.includes("认证") ? 1 : 0,
        0.1,
      ];
    },
  };
}

describe("retrieveProjectMemorySemanticCandidates with persisted index", () => {
  it("uses indexRecords without full rebuild and can yield hybrid", async () => {
    const memory = makeMemory({ id: "m1", title: "OAuth login" });
    const provider = makeProvider();
    const vector = await provider.embed(
      "Title: OAuth login\nSummary: OAuth login notes",
    );
    const record: ProjectMemoryEmbeddingIndexRecord = {
      workspaceId: "ws-1",
      memoryId: "m1",
      providerId: provider.providerId,
      modelId: provider.modelId,
      embeddingVersion: provider.embeddingVersion,
      dimensions: provider.dimensions,
      contentHash: buildProjectMemoryEmbeddingContentHash(memory),
      vector,
      memoryUpdatedAt: memory.updatedAt,
      indexedAt: Date.now(),
    };

    const result = await retrieveProjectMemorySemanticCandidates({
      workspaceId: "ws-1",
      query: "认证登录 token",
      memories: [memory],
      provider,
      allowTestProvider: true,
      indexRecords: [record],
      topK: 5,
    });

    expect(result.status).toBe("available");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(
      result.candidates.some(
        (c) => c.retrievalMode === "hybrid" || c.retrievalMode === "semantic",
      ),
    ).toBe(true);
  });

  it("falls back when index empty", async () => {
    const memory = makeMemory({ id: "m1" });
    const provider = makeProvider();
    const result = await retrieveProjectMemorySemanticCandidates({
      workspaceId: "ws-1",
      query: "oauth",
      memories: [memory],
      provider,
      allowTestProvider: true,
      indexRecords: [],
    });
    expect(result.candidates).toEqual([]);
    expect(result.diagnostics.fallbackReason).toBe("empty_or_stale_index");
  });
});
