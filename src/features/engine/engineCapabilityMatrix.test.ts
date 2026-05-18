import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { EngineFeatures, EngineType } from "../../types";
import {
  ENGINE_CAPABILITY_KEYS,
  ENGINE_CAPABILITY_MATRIX,
  ENGINE_CAPABILITY_STATES,
  getEngineCapabilityState,
  isEngineCapabilityUsable,
  projectEngineFeaturesToCapabilities,
  resolveEngineCapabilityRuntimeStatus,
  type EngineCapabilityKey,
  type EngineCapabilityState,
} from "./engineCapabilityMatrix";

type MatrixFixture = {
  stateValues: string[];
  engines: EngineType[];
  capabilities: Array<{ key: EngineCapabilityKey }>;
  matrix: Record<EngineType, Record<EngineCapabilityKey, EngineCapabilityState>>;
};

const fixture = JSON.parse(
  readFileSync(
    new URL(
      "../../../openspec/changes/add-engine-capability-matrix-spec/specs/engine-capability-matrix/fixtures/matrix.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as MatrixFixture;

describe("engineCapabilityMatrix", () => {
  it("matches the spec-owned matrix fixture", () => {
    expect(ENGINE_CAPABILITY_STATES).toEqual(fixture.stateValues);
    expect(ENGINE_CAPABILITY_KEYS).toEqual(
      fixture.capabilities.map((capability) => capability.key),
    );
    expect(
      Object.fromEntries(
        ENGINE_CAPABILITY_MATRIX.map((row) => [row.engine, row.capabilities]),
      ),
    ).toEqual(fixture.matrix);
  });

  it("treats unsupported and unknown capabilities as unusable", () => {
    expect(isEngineCapabilityUsable("opencode", "tool.mcp")).toBe(false);
    expect(isEngineCapabilityUsable("opencode", "image.input")).toBe(false);
    expect(getEngineCapabilityState("codex", "reasoning.effort")).toBe("supported");
  });

  it("projects legacy TS EngineFeatures into capability states without changing field shape", () => {
    const features: EngineFeatures = {
      streaming: true,
      reasoning: false,
      toolUse: true,
      imageInput: false,
      sessionContinuation: true,
    };

    expect(projectEngineFeaturesToCapabilities(features)).toEqual({
      "streaming.text": "supported",
      "streaming.tool-output": "supported",
      "tool.use": "supported",
      "session.continuation": "supported",
      "image.input": "unsupported",
    });
  });

  it("resolves runtime capability status from legacy EngineStatus features without UI wiring", () => {
    const features: EngineFeatures = {
      streaming: true,
      reasoning: false,
      toolUse: true,
      imageInput: false,
      sessionContinuation: true,
    };

    expect(
      resolveEngineCapabilityRuntimeStatus({ engine: "claude", features }),
    ).toMatchObject({
      engine: "claude",
      source: "engine-features",
      capabilities: {
        "streaming.text": "supported",
        "streaming.reasoning": "supported",
        "tool.use": "supported",
        "image.input": "unsupported",
        "session.continuation": "supported",
      },
    });
  });

  it("does not let legacy runtime flags downgrade spec-owned reasoning streaming", () => {
    const features: EngineFeatures = {
      streaming: true,
      reasoning: false,
      toolUse: true,
      imageInput: true,
      sessionContinuation: true,
    };

    expect(
      resolveEngineCapabilityRuntimeStatus({ engine: "claude", features }).capabilities[
        "streaming.reasoning"
      ],
    ).toBe("supported");
  });

  it("falls back to the spec matrix when runtime features are unavailable", () => {
    expect(resolveEngineCapabilityRuntimeStatus({ engine: "opencode" })).toMatchObject({
      engine: "opencode",
      source: "matrix",
      capabilities: {
        "tool.mcp": "unsupported",
        "image.input": "unsupported",
      },
    });
  });
});
