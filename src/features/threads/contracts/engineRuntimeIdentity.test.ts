import { describe, expect, it } from "vitest";
import {
  asEngineItemId,
  asEngineRunId,
  asEngineTurnId,
  createEngineRuntimeIdentity,
  parseLegacyThreadIdentity,
} from "./engineRuntimeIdentity";

describe("engineRuntimeIdentity", () => {
  it.each(["claude", "codex", "gemini", "grok", "kimi", "opencode", "pi"] as const)(
    "decodes native and pending %s legacy ids at one compatibility boundary",
    (engine) => {
      expect(parseLegacyThreadIdentity(`${engine}:native-1`)).toMatchObject({
        engine,
        logicalSessionId: `${engine}:native-1`,
        nativeSessionId: "native-1",
        pendingSessionId: null,
        source: "legacy-prefix",
      });
      expect(parseLegacyThreadIdentity(`${engine}-pending-local-1`)).toMatchObject({
        engine,
        nativeSessionId: null,
        pendingSessionId: `${engine}-pending-local-1`,
      });
    },
  );

  it("keeps unprefixed historical records compatible with the Codex fallback", () => {
    expect(parseLegacyThreadIdentity("019-runtime-thread")).toMatchObject({
      engine: "codex",
      logicalSessionId: "019-runtime-thread",
      source: "legacy-codex-fallback",
    });
  });

  it("creates explicit typed identities without encoding engine into the logical id", () => {
    expect(
      createEngineRuntimeIdentity({
        engine: "kimi",
        logicalSessionId: "logical-1",
        nativeSessionId: "native-1",
      }),
    ).toEqual({
      engine: "kimi",
      logicalSessionId: "logical-1",
      nativeSessionId: "native-1",
      pendingSessionId: null,
      source: "explicit",
    });
    expect([asEngineRunId("run-1"), asEngineTurnId("turn-1"), asEngineItemId("item-1")]).toEqual([
      "run-1",
      "turn-1",
      "item-1",
    ]);
  });

  it("rejects blank identity values at the trust boundary", () => {
    expect(() => parseLegacyThreadIdentity("  ")).toThrow("threadId must not be blank");
  });
});
