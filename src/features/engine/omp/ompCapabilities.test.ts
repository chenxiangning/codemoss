import { describe, expect, it } from "vitest";
import {
  canUseOmpCapability,
  DEFAULT_OMP_CAPABILITY_MATRIX,
  grantOmpCapability,
} from "./ompCapabilities";

describe("OMP capability gates", () => {
  it("fails closed for every unverified capability", () => {
    expect(canUseOmpCapability(DEFAULT_OMP_CAPABILITY_MATRIX, "tool.shell")).toBe(false);
    expect(canUseOmpCapability(DEFAULT_OMP_CAPABILITY_MATRIX, "browser")).toBe(false);
    expect(DEFAULT_OMP_CAPABILITY_MATRIX.mcp).toMatchObject({
      state: "unknown",
      enabled: false,
      requiresApproval: true,
    });
  });

  it("requires an explicit supported grant before execution", () => {
    const granted = grantOmpCapability(DEFAULT_OMP_CAPABILITY_MATRIX, "tool.read", {
      requiresApproval: false,
    });
    expect(canUseOmpCapability(granted, "tool.read")).toBe(true);
    expect(granted["tool.read"]).toEqual({
      state: "supported",
      enabled: true,
      requiresApproval: false,
    });
    expect(canUseOmpCapability(granted, "tool.write")).toBe(false);
  });
});
