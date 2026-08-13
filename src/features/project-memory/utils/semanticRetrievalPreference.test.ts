// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  getSemanticRetrievalPreference,
  isSemanticRetrievalEnabledByUser,
  SEMANTIC_RETRIEVAL_PREFERENCE_KEY,
  setSemanticRetrievalPreference,
} from "./semanticRetrievalPreference";

describe("semanticRetrievalPreference", () => {
  beforeEach(() => {
    window.localStorage.removeItem(SEMANTIC_RETRIEVAL_PREFERENCE_KEY);
  });

  it("defaults to semantic", () => {
    expect(getSemanticRetrievalPreference()).toBe("semantic");
    expect(isSemanticRetrievalEnabledByUser()).toBe(true);
  });

  it("persists lexical preference", () => {
    setSemanticRetrievalPreference("lexical");
    expect(getSemanticRetrievalPreference()).toBe("lexical");
    expect(isSemanticRetrievalEnabledByUser()).toBe(false);
    expect(window.localStorage.getItem(SEMANTIC_RETRIEVAL_PREFERENCE_KEY)).toBe(
      "lexical",
    );
  });

  it("normalizes unknown values to semantic", () => {
    window.localStorage.setItem(SEMANTIC_RETRIEVAL_PREFERENCE_KEY, "wat");
    expect(getSemanticRetrievalPreference()).toBe("semantic");
  });
});
