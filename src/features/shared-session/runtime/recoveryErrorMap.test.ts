import { describe, expect, it } from "vitest";

import {
  classifyRecoveryError,
  extractDurableOwnerFromMismatch,
  squadBaseBindingKey,
} from "./recoveryErrorMap";

describe("classifyRecoveryError", () => {
  it("maps binding owner mismatch to recovery-owner-mismatch", () => {
    const result = classifyRecoveryError(
      new Error(
        "binding owner mismatch: key 'squad:agent-x' does not match durable owner 'claude:default'",
      ),
    );
    expect(result.kind).toBe("recovery-owner-mismatch");
  });

  it("keeps recovery-active classification", () => {
    const result = classifyRecoveryError(
      new Error(
        "recovery-active: attempt a1 is still owned by Runtime; Probe/Stop before rebuild",
      ),
    );
    expect(result.kind).toBe("recovery-active");
  });
});

describe("extractDurableOwnerFromMismatch", () => {
  it("parses durable owner from mismatch error", () => {
    expect(
      extractDurableOwnerFromMismatch(
        new Error(
          "binding owner mismatch: key 'squad:run:node:claude:default' does not match durable owner 'claude:default'",
        ),
      ),
    ).toBe("claude:default");
  });

  it("returns null when pattern missing", () => {
    expect(extractDurableOwnerFromMismatch(new Error("other"))).toBeNull();
  });
});

describe("squadBaseBindingKey", () => {
  it("extracts durable base from squad worker key", () => {
    expect(
      squadBaseBindingKey("squad:run-1:plan:claude:default"),
    ).toBe("claude:default");
  });

  it("returns null for non-squad keys", () => {
    expect(squadBaseBindingKey("claude:default")).toBeNull();
  });
});
