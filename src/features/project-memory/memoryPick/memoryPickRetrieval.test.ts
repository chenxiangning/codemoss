// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  pickAlwaysTopKCandidateIds,
  retrieveMemoryPickCandidates,
} from "./memoryPickRetrieval";
import type { MemoryPickCandidate } from "./memoryPickTypes";
import type { ProjectMemoryEmbeddingProvider } from "../utils/projectMemorySemanticRetrieval";

function item(id: string, title: string, summary: string, updatedAt: number) {
  return {
    id,
    workspaceId: "ws",
    kind: "note",
    title,
    summary,
    detail: summary,
    cleanText: summary,
    rawText: summary,
    tags: [] as string[],
    importance: "medium",
    source: "manual",
    fingerprint: id,
    createdAt: updatedAt,
    updatedAt,
  };
}

function mockProvider(overrides?: {
  healthStatus?: "available" | "unavailable" | "error";
  embed?: (text: string) => number[];
}): ProjectMemoryEmbeddingProvider {
  return {
    providerId: "test-provider",
    modelId: "test-model",
    dimensions: 4,
    embeddingVersion: "v1",
    scope: "test",
    health: () => ({
      status: overrides?.healthStatus ?? "available",
    }),
    embed: overrides?.embed ?? (() => [1, 0, 0, 0]),
  };
}

describe("retrieveMemoryPickCandidates", () => {
  it("returns related candidates by relevance threshold (lexical)", async () => {
    const listFn = vi.fn(async () => ({
      items: [
        item("a", "数据库连接池", "超时与连接上限", 10),
        item("b", "UI 主题", "暗色模式", 20),
        item("c", "数据库索引", "慢查询优化", 30),
      ],
      total: 3,
    }));

    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "数据库 超时",
      listFn: listFn as never,
      limit: 10,
      timeoutMs: 2000,
    });

    expect(result.error).toBeNull();
    expect(result.diagnostics.emptyReason).toBe("ok");
    expect(result.diagnostics.retrievalMode).toBe("lexical");
    expect(result.diagnostics.providerStatus).toBe("skipped");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.some((c) => c.id === "a" || c.id === "c")).toBe(
      true,
    );
    expect(listFn).toHaveBeenCalledWith(
      expect.objectContaining({ page: 0, pageSize: 200 }),
    );
  });

  it("你好 with no lexical hit returns empty without timeout", async () => {
    const listFn = vi.fn(async () => ({
      items: [
        item("a", "数据库连接池", "超时与连接上限", 10),
        item("b", "CRUD 示例", "用户表接口", 20),
      ],
      total: 2,
    }));

    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "你好",
      listFn: listFn as never,
      timeoutMs: 2000,
    });

    expect(result.error).toBeNull();
    expect(result.candidates).toEqual([]);
    // CJK bigram 存在但无命中 → no_match（非 no_query_terms）
    expect(result.diagnostics.emptyReason).toBe("no_match");
    expect(result.diagnostics.retrievalMode).toBe("lexical");
  });

  it("maps no_query_terms when normalize yields empty", async () => {
    const listFn = vi.fn(async () => ({
      items: [item("a", "数据库", "x", 1)],
      total: 1,
    }));
    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "   ",
      listFn: listFn as never,
    });
    expect(result.candidates).toEqual([]);
    expect(result.diagnostics.emptyReason).toBe("no_query_terms");
    expect(listFn).not.toHaveBeenCalled();
  });

  it("returns timeout only when list hangs past budget", async () => {
    const listFn = vi.fn(
      () =>
        new Promise(() => {
          /* never */
        }),
    );
    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "anything",
      listFn: listFn as never,
      timeoutMs: 40,
    });
    expect(result.candidates).toEqual([]);
    expect(result.error).toBe("timeout");
    expect(result.diagnostics.emptyReason).toBe("timeout");
  });

  it("returns empty without error when no memories", async () => {
    const listFn = vi.fn(async () => ({ items: [], total: 0 }));
    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "database timeout",
      listFn: listFn as never,
    });
    expect(result.candidates).toEqual([]);
    expect(result.error).toBeNull();
    expect(result.diagnostics.emptyReason).toBe("no_match");
  });

  it("reports retrieve_failed as emptyReason error", async () => {
    const listFn = vi.fn(async () => {
      throw new Error("backend down");
    });
    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "database",
      listFn: listFn as never,
    });
    expect(result.error).toBe("retrieve_failed");
    expect(result.diagnostics.emptyReason).toBe("error");
  });

  it("without provider stays lexical even when semantic would help", async () => {
    const listFn = vi.fn(async () => ({
      items: [item("a", "连接池调优", "maxIdle", 10)],
      total: 1,
    }));
    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "连接池",
      listFn: listFn as never,
    });
    expect(result.diagnostics.retrievalMode).toBe("lexical");
    expect(result.diagnostics.providerStatus).toBe("skipped");
  });

  it("with available mock provider may report hybrid/semantic honestly", async () => {
    const listFn = vi.fn(async () => ({
      items: [
        item("a", "数据库连接池", "超时与连接上限", 10),
        item("b", "UI 主题", "暗色模式", 20),
      ],
      total: 2,
    }));
    const provider = mockProvider({
      embed: (text: string) => {
        // 查询与 a 同向，与 b 正交
        if (text.includes("数据库") || text.includes("连接")) {
          return [1, 0, 0, 0];
        }
        if (text.includes("UI") || text.includes("主题")) {
          return [0, 1, 0, 0];
        }
        return [1, 0, 0, 0];
      },
    });

    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "数据库 连接",
      listFn: listFn as never,
      semanticProvider: provider,
      allowTestSemanticProvider: true,
      limit: 10,
    });

    expect(result.error).toBeNull();
    // provider 可用时不应伪装；lexical|semantic|hybrid 均可
    expect(["lexical", "semantic", "hybrid"]).toContain(
      result.diagnostics.retrievalMode,
    );
    if (result.diagnostics.retrievalMode !== "lexical") {
      expect(result.diagnostics.providerStatus).toBe("available");
    }
  });

  it("unavailable provider falls back to lexical without lying", async () => {
    const listFn = vi.fn(async () => ({
      items: [item("a", "数据库连接池", "超时", 10)],
      total: 1,
    }));
    const result = await retrieveMemoryPickCandidates({
      workspaceId: "ws",
      query: "数据库",
      listFn: listFn as never,
      semanticProvider: mockProvider({ healthStatus: "unavailable" }),
      allowTestSemanticProvider: true,
    });
    expect(result.diagnostics.retrievalMode).toBe("lexical");
    expect(result.diagnostics.providerStatus).toBe("unavailable");
    expect(result.candidates.length).toBeGreaterThan(0);
  });
});

describe("pickAlwaysTopKCandidateIds", () => {
  it("picks top k by score", () => {
    const candidates: MemoryPickCandidate[] = [
      { id: "1", title: "1", summary: "", score: 0.1 },
      { id: "2", title: "2", summary: "", score: 0.9 },
      { id: "3", title: "3", summary: "", score: 0.5 },
    ];
    expect(pickAlwaysTopKCandidateIds(candidates, 2)).toEqual(["2", "3"]);
  });
});
