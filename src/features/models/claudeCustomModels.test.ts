import { describe, expect, it } from "vitest";
import { normalizeClaudeCustomModels } from "./claudeCustomModels";

describe("normalizeClaudeCustomModels", () => {
  it("keeps unscoped models without inventing providerProfileId", () => {
    const models = normalizeClaudeCustomModels([
      { id: "Haiku 4.5", label: "Haiku 4.5" },
      { id: "x".repeat(300), label: "Long" },
    ]);
    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({ id: "Haiku 4.5", label: "Haiku 4.5" });
    expect(models[0]).not.toHaveProperty("providerProfileId");
    expect(models[1]).toMatchObject({ id: "x".repeat(300), label: "Long" });
    expect(models[1]).not.toHaveProperty("providerProfileId");
  });

  it("preserves optional managed provider ownership when present", () => {
    const models = normalizeClaudeCustomModels([
      {
        id: "minimax-m3",
        label: "MiniMax",
        providerProfileId: "  provider-minimax  ",
      },
    ]);
    expect(models).toEqual([
      expect.objectContaining({
        id: "minimax-m3",
        providerProfileId: "provider-minimax",
      }),
    ]);
  });

  it("ignores blank providerProfileId as unscoped", () => {
    const models = normalizeClaudeCustomModels([
      { id: "local-only", label: "Local", providerProfileId: "   " },
    ]);
    expect(models[0]?.providerProfileId).toBeUndefined();
  });
});
