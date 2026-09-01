import { describe, expect, it } from "vitest";
import {
  canUseOmpCapability,
  DEFAULT_OMP_CAPABILITY_MATRIX,
  OMP_CAPABILITY_APPROVAL_POLICY,
  OMP_CAPABILITY_EVIDENCE,
  recordOmpCapabilityEvidence,
  requestOmpCapabilityGrant,
  type OmpCapability,
} from "./ompCapabilities";

/** 8.3 逐工具 capability：read / bash / edit / write / LSP / python(notebook) / image attachment。 */
const TOOL_CAPABILITIES = [
  { tool: "read", capability: "tool.read", highRisk: false },
  { tool: "bash", capability: "tool.shell", highRisk: true },
  { tool: "edit", capability: "tool.edit", highRisk: true },
  { tool: "write", capability: "tool.write", highRisk: true },
  { tool: "LSP", capability: "tool.lsp", highRisk: true },
  { tool: "python(notebook)", capability: "tool.notebook", highRisk: true },
  { tool: "image attachment", capability: "attachment.image", highRisk: false },
] as const satisfies readonly { tool: string; capability: OmpCapability; highRisk: boolean }[];

describe("OMP per-tool capability matrix (8.3)", () => {
  it("marks every tool capability default-off and fail-closed", () => {
    for (const { capability } of TOOL_CAPABILITIES) {
      expect(canUseOmpCapability(DEFAULT_OMP_CAPABILITY_MATRIX, capability)).toBe(false);
      expect(DEFAULT_OMP_CAPABILITY_MATRIX[capability].enabled).toBe(false);
    }
  });

  it("keeps protocol-unproven tools explicitly unknown", () => {
    for (const { capability } of TOOL_CAPABILITIES) {
      if (capability === "attachment.image") {
        continue;
      }
      expect(DEFAULT_OMP_CAPABILITY_MATRIX[capability].state).toBe("unknown");
      expect(DEFAULT_OMP_CAPABILITY_MATRIX[capability].requiresApproval).toBe(true);
    }
  });

  it("records ACP image prompt evidence while keeping attachment off by default", () => {
    // evidence/omp-cli-surface.txt: ACP initialize agentCapabilities.promptCapabilities.image=true
    expect(DEFAULT_OMP_CAPABILITY_MATRIX["attachment.image"]).toEqual({
      state: "supported",
      enabled: false,
      requiresApproval: false,
    });
    expect(OMP_CAPABILITY_EVIDENCE["attachment.image"]).toContain(
      "promptCapabilities.image",
    );
  });

  it("documents an evidence note for every capability in the matrix", () => {
    for (const capability of Object.keys(DEFAULT_OMP_CAPABILITY_MATRIX) as OmpCapability[]) {
      expect(typeof OMP_CAPABILITY_EVIDENCE[capability]).toBe("string");
      expect(OMP_CAPABILITY_EVIDENCE[capability].length).toBeGreaterThan(0);
      expect(OMP_CAPABILITY_APPROVAL_POLICY[capability]).toHaveProperty("highRisk");
    }
  });

  it.each(TOOL_CAPABILITIES)(
    "denies grant without protocol evidence for $tool",
    ({ capability }) => {
      if (capability === "attachment.image") {
        return;
      }
      const decision = requestOmpCapabilityGrant(DEFAULT_OMP_CAPABILITY_MATRIX, capability, {
        approved: true,
      });
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe("capability-not-proven");
      expect(decision.matrix).toBe(DEFAULT_OMP_CAPABILITY_MATRIX);
    },
  );

  it.each(TOOL_CAPABILITIES)(
    "applies observed evidence without auto-enabling $tool",
    ({ capability }) => {
      const observed = recordOmpCapabilityEvidence(
        DEFAULT_OMP_CAPABILITY_MATRIX,
        capability,
        "supported",
      );
      expect(observed[capability].state).toBe("supported");
      expect(observed[capability].enabled).toBe(false);
      expect(canUseOmpCapability(observed, capability)).toBe(false);
    },
  );

  it.each(TOOL_CAPABILITIES)(
    "enforces per-tool approval policy for $tool",
    ({ capability, highRisk }) => {
      const observed = recordOmpCapabilityEvidence(
        DEFAULT_OMP_CAPABILITY_MATRIX,
        capability,
        "supported",
      );
      const unapproved = requestOmpCapabilityGrant(observed, capability);
      const approved = requestOmpCapabilityGrant(observed, capability, { approved: true });

      if (highRisk) {
        expect(unapproved.granted).toBe(false);
        expect(unapproved.reason).toBe("approval-required");
        expect(unapproved.matrix).toBe(observed);
        expect(approved.granted).toBe(true);
        expect(approved.matrix[capability]).toEqual({
          state: "supported",
          enabled: true,
          requiresApproval: true,
        });
      } else {
        expect(unapproved.granted).toBe(true);
        expect(unapproved.reason).toBe("granted");
        expect(unapproved.matrix[capability]).toEqual({
          state: "supported",
          enabled: true,
          requiresApproval: false,
        });
      }
      expect(canUseOmpCapability(approved.matrix, capability)).toBe(true);
    },
  );

  it("never grants a capability whose evidence state is unsupported or degraded", () => {
    for (const state of ["unsupported", "degraded"] as const) {
      const observed = recordOmpCapabilityEvidence(
        DEFAULT_OMP_CAPABILITY_MATRIX,
        "tool.shell",
        state,
      );
      const decision = requestOmpCapabilityGrant(observed, "tool.shell", { approved: true });
      expect(decision.granted).toBe(false);
      expect(decision.reason).toBe("capability-not-proven");
      expect(decision.matrix).toBe(observed);
    }
  });

  it("keeps sibling capabilities closed when one tool is granted", () => {
    const observed = recordOmpCapabilityEvidence(
      DEFAULT_OMP_CAPABILITY_MATRIX,
      "tool.read",
      "supported",
    );
    const granted = requestOmpCapabilityGrant(observed, "tool.read");
    expect(granted.granted).toBe(true);
    for (const { capability } of TOOL_CAPABILITIES) {
      if (capability !== "tool.read") {
        expect(canUseOmpCapability(granted.matrix, capability)).toBe(false);
      }
    }
  });
});
