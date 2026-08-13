import { describe, expect, it } from "vitest";
import {
  buildLegalClaudeRuntimes,
  isForeignClaudeRuntimeResidue,
  resolveClaudeManagedRuntimeModel,
} from "./claudeManagedRuntimeModel";

const deepseekCatalog = [
  {
    id: "claude-fable-5",
    model: "deepseek-v4-pro",
    isDefault: true,
  },
  {
    id: "claude-opus-5",
    model: "deepseek-v4-pro",
  },
  {
    id: "claude-sonnet-5",
    model: "deepseek-v4-pro",
  },
  {
    id: "claude-haiku-4-5-20251001",
    model: "deepseek-v4-flash",
  },
];

describe("claudeManagedRuntimeModel", () => {
  it("resolves tier entry id to mapped runtime without repair", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "claude-fable-5",
      catalog: deepseekCatalog,
    });
    expect(result.runtime).toBe("deepseek-v4-pro");
    expect(result.entryId).toBe("claude-fable-5");
    expect(result.repaired).toBe(false);
  });

  it("repairs foreign k3 residue to catalog default", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "k3",
      catalog: deepseekCatalog,
      fallbackRuntime: "k3",
    });
    expect(result.runtime).toBe("deepseek-v4-pro");
    expect(result.entryId).toBe("claude-fable-5");
    expect(result.repaired).toBe(true);
  });

  it("repairs kimi fallback when entry missing", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "claude-sonnet-5-missing",
      catalog: deepseekCatalog,
      fallbackRuntime: "kimi-k3",
    });
    expect(result.runtime).toBe("deepseek-v4-pro");
    expect(result.repaired).toBe(true);
  });

  // 并行 native：MiniMax 会话 residual 不得 freeform 打到 DeepSeek API（用户截图 400）。
  it("repairs MiniMax-M3 residual under DeepSeek catalog (parallel native isolation)", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "MiniMax-M3",
      catalog: deepseekCatalog,
      fallbackRuntime: "MiniMax-M3",
    });
    expect(result.runtime).toBe("deepseek-v4-pro");
    expect(result.entryId).toBe("claude-fable-5");
    expect(result.repaired).toBe(true);
  });

  it("repairs minimax product fallback when entry is foreign", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "claude-fable-stale",
      catalog: deepseekCatalog,
      fallbackRuntime: "minimax-m2.5",
    });
    expect(result.runtime).toBe("deepseek-v4-pro");
    expect(result.repaired).toBe(true);
  });

  it("repairs deepseek product residual under MiniMax-only catalog", () => {
    const minimaxCatalog = [
      {
        id: "minimax-default",
        model: "MiniMax-M3",
        isDefault: true,
      },
      {
        id: "minimax-alt",
        model: "MiniMax-Text-01",
      },
    ];
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "deepseek-v4-pro",
      catalog: minimaxCatalog,
      fallbackRuntime: "deepseek-v4-flash",
    });
    expect(result.runtime).toBe("MiniMax-M3");
    expect(result.entryId).toBe("minimax-default");
    expect(result.repaired).toBe(true);
  });

  it("preserves legitimate freeform when not in catalog", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "claude-opus-4-6",
      catalog: deepseekCatalog,
      fallbackRuntime: "claude-opus-4-6",
    });
    expect(result.runtime).toBe("claude-opus-4-6");
    expect(result.entryId).toBe("claude-opus-4-6");
    expect(result.repaired).toBe(false);
  });

  it("preserves custom freeform names", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "my-org-router-v2",
      catalog: deepseekCatalog,
      fallbackRuntime: "my-org-router-v2",
    });
    expect(result.runtime).toBe("my-org-router-v2");
    expect(result.repaired).toBe(false);
  });

  it("detects foreign residue hints", () => {
    expect(isForeignClaudeRuntimeResidue("k3")).toBe(true);
    expect(isForeignClaudeRuntimeResidue("kimi-code/k3")).toBe(true);
    expect(isForeignClaudeRuntimeResidue("MiniMax-M3")).toBe(true);
    expect(isForeignClaudeRuntimeResidue("minimax-m2")).toBe(true);
    expect(isForeignClaudeRuntimeResidue("deepseek-v4-pro")).toBe(true);
    expect(isForeignClaudeRuntimeResidue("claude-opus-4-6")).toBe(false);
    expect(isForeignClaudeRuntimeResidue("my-org-router-v2")).toBe(false);
  });

  it("does not repair MiniMax when it is already legal in catalog", () => {
    const mixedCatalog = [
      ...deepseekCatalog,
      { id: "minimax-entry", model: "MiniMax-M3", isDefault: false },
    ];
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "minimax-entry",
      catalog: mixedCatalog,
    });
    expect(result.runtime).toBe("MiniMax-M3");
    expect(result.repaired).toBe(false);
  });

  it("builds legal set from catalog runtimes and env slots (not bare tier ids alone)", () => {
    const legal = buildLegalClaudeRuntimes(deepseekCatalog, {
      ANTHROPIC_MODEL: "deepseek-v4-pro",
    });
    expect(legal.has("deepseek-v4-pro")).toBe(true);
    expect(legal.has("deepseek-v4-flash")).toBe(true);
    // tier id is only legal if it is also the runtime (unmapped builtin)
    expect(legal.has("claude-fable-5")).toBe(false);
  });

  it("allows freeform when catalog empty and not foreign", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "my-custom-model",
      catalog: [],
      fallbackRuntime: "my-custom-model",
    });
    expect(result.runtime).toBe("my-custom-model");
    expect(result.repaired).toBe(false);
  });

  it("preserves MiniMax freeform while catalog is unavailable (empty)", () => {
    const result = resolveClaudeManagedRuntimeModel({
      entryId: "MiniMax-M2.5",
      catalog: [],
      fallbackRuntime: "MiniMax-M2.5",
    });
    expect(result.runtime).toBe("MiniMax-M2.5");
    expect(result.entryId).toBe("MiniMax-M2.5");
    expect(result.repaired).toBe(false);
  });
});
