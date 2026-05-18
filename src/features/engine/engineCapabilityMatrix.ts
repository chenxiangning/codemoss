import type { EngineFeatures, EngineType } from "../../types";

export const ENGINE_CAPABILITY_STATES = [
  "supported",
  "compat-input",
  "unsupported",
  "unknown",
] as const;

export type EngineCapabilityState = (typeof ENGINE_CAPABILITY_STATES)[number];

export const ENGINE_CAPABILITY_KEYS = [
  "streaming.text",
  "streaming.reasoning",
  "streaming.tool-output",
  "tool.use",
  "tool.mcp",
  "reasoning.effort",
  "collaboration.mode",
  "session.continuation",
  "image.input",
] as const;

export type EngineCapabilityKey = (typeof ENGINE_CAPABILITY_KEYS)[number];

export type EngineCapabilityRow = {
  engine: EngineType;
  capabilities: Record<EngineCapabilityKey, EngineCapabilityState>;
};

export type EngineCapabilityRuntimeStatus = {
  engine: EngineType;
  capabilities: Record<EngineCapabilityKey, EngineCapabilityState>;
  source: "matrix" | "engine-features";
};

export const ENGINE_CAPABILITY_MATRIX: readonly EngineCapabilityRow[] = [
  {
    engine: "claude",
    capabilities: {
      "streaming.text": "supported",
      "streaming.reasoning": "supported",
      "streaming.tool-output": "supported",
      "tool.use": "supported",
      "tool.mcp": "supported",
      "reasoning.effort": "unsupported",
      "collaboration.mode": "unsupported",
      "session.continuation": "supported",
      "image.input": "supported",
    },
  },
  {
    engine: "codex",
    capabilities: {
      "streaming.text": "supported",
      "streaming.reasoning": "supported",
      "streaming.tool-output": "supported",
      "tool.use": "supported",
      "tool.mcp": "supported",
      "reasoning.effort": "supported",
      "collaboration.mode": "supported",
      "session.continuation": "supported",
      "image.input": "supported",
    },
  },
  {
    engine: "gemini",
    capabilities: {
      "streaming.text": "supported",
      "streaming.reasoning": "supported",
      "streaming.tool-output": "supported",
      "tool.use": "supported",
      "tool.mcp": "supported",
      "reasoning.effort": "unsupported",
      "collaboration.mode": "unsupported",
      "session.continuation": "supported",
      "image.input": "supported",
    },
  },
  {
    engine: "opencode",
    capabilities: {
      "streaming.text": "supported",
      "streaming.reasoning": "supported",
      "streaming.tool-output": "supported",
      "tool.use": "supported",
      "tool.mcp": "unsupported",
      "reasoning.effort": "unsupported",
      "collaboration.mode": "unsupported",
      "session.continuation": "supported",
      "image.input": "unsupported",
    },
  },
] as const satisfies readonly EngineCapabilityRow[];

const engineCapabilityLookup = new Map(
  ENGINE_CAPABILITY_MATRIX.map((row) => [row.engine, row.capabilities]),
);

function unknownCapabilityRecord(): Record<EngineCapabilityKey, EngineCapabilityState> {
  return Object.fromEntries(
    ENGINE_CAPABILITY_KEYS.map((capability) => [capability, "unknown"]),
  ) as Record<EngineCapabilityKey, EngineCapabilityState>;
}

function getMatrixCapabilities(
  engine: EngineType,
): Record<EngineCapabilityKey, EngineCapabilityState> {
  return engineCapabilityLookup.get(engine) ?? unknownCapabilityRecord();
}

export function getEngineCapabilityState(
  engine: EngineType,
  capability: EngineCapabilityKey,
): EngineCapabilityState {
  return engineCapabilityLookup.get(engine)?.[capability] ?? "unknown";
}

export function isEngineCapabilityUsable(
  engine: EngineType,
  capability: EngineCapabilityKey,
): boolean {
  const state = getEngineCapabilityState(engine, capability);
  return state === "supported" || state === "compat-input";
}

export function projectEngineFeaturesToCapabilities(
  features: EngineFeatures,
): Pick<
  Record<EngineCapabilityKey, EngineCapabilityState>,
  "streaming.text" | "streaming.tool-output" | "tool.use" | "session.continuation" | "image.input"
> {
  const streamingState: EngineCapabilityState = features.streaming ? "supported" : "unsupported";
  return {
    "streaming.text": streamingState,
    "streaming.tool-output": streamingState,
    "tool.use": features.toolUse ? "supported" : "unsupported",
    "session.continuation": features.sessionContinuation ? "supported" : "unsupported",
    "image.input": features.imageInput ? "supported" : "unsupported",
  };
}

export function resolveEngineCapabilityRuntimeStatus(input: {
  engine: EngineType;
  features?: EngineFeatures | null;
}): EngineCapabilityRuntimeStatus {
  if (input.features) {
    return {
      engine: input.engine,
      capabilities: {
        ...getMatrixCapabilities(input.engine),
        ...projectEngineFeaturesToCapabilities(input.features),
      },
      source: "engine-features",
    };
  }
  return {
    engine: input.engine,
    capabilities: {
      ...unknownCapabilityRecord(),
      ...getMatrixCapabilities(input.engine),
    },
    source: "matrix",
  };
}
