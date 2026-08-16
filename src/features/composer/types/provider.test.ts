import { describe, expect, it } from "vitest";
import {
  isValidModelId as isValidVendorModelId,
  MODEL_ID_PATTERN as VENDOR_MODEL_ID_PATTERN,
} from "@mossx/plugin-vendors/runtime";
import {
  isValidModelId,
  MODEL_ID_PATTERN,
  validateCodexCustomModels,
} from "./provider";

describe("composer/provider model id validation", () => {
  it("accepts model ids with square brackets", () => {
    expect(isValidModelId("[L]gemini-3-flash-preview")).toBe(true);
    expect(isValidModelId("Cxn[1m]")).toBe(true);
  });

  it("keeps bracketed custom models after runtime validation", () => {
    const models = validateCodexCustomModels([
      {
        id: "[L]gemini-3-flash-preview",
        label: "[L]gemini-3-flash-preview",
      },
      {
        id: "gemini-3-flash-preview",
        label: "gemini-3-flash-preview",
      },
    ]);
    expect(models).toHaveLength(2);
    expect(models[0]?.id).toBe("[L]gemini-3-flash-preview");
    expect(models[1]?.id).toBe("gemini-3-flash-preview");
  });

  it("shares a single validation implementation with vendors/types", () => {
    expect(isValidVendorModelId).toBe(isValidModelId);
    expect(VENDOR_MODEL_ID_PATTERN).toBe(MODEL_ID_PATTERN);
  });

  it("rejects empty, over-length, and illegal-character ids on both surfaces", () => {
    const cases = [
      "",
      "   ",
      "x".repeat(129),
      "model id with spaces",
      "model\tid",
      "model(id)",
    ];
    for (const value of cases) {
      expect(isValidModelId(value)).toBe(false);
      expect(isValidVendorModelId(value)).toBe(false);
    }
  });
});
