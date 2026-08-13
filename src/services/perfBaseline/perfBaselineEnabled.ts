// Lightweight enablement + schema constants for startup-critical paths.
// Must stay free of mermaid / heavy diagnostics so bootstrap cannot co-chunk
// with vendor-mermaid (see cold-start P0-1).

export const PERF_BASELINE_SCHEMA_VERSION = "1.0";

type PerfEnv = {
  VITE_ENABLE_PERF_BASELINE?: string;
  DEV?: boolean;
  PROD?: boolean;
};

function readPerfEnv(): PerfEnv {
  const viteEnv = import.meta.env as PerfEnv | undefined;
  const processEnv = typeof process === "undefined" ? undefined : process.env;
  return {
    VITE_ENABLE_PERF_BASELINE:
      viteEnv?.VITE_ENABLE_PERF_BASELINE ?? processEnv?.VITE_ENABLE_PERF_BASELINE,
    DEV: viteEnv?.DEV ?? processEnv?.NODE_ENV !== "production",
    PROD: viteEnv?.PROD ?? processEnv?.NODE_ENV === "production",
  };
}

/** True only when explicitly enabled and not a production build. */
export function isPerfBaselineEnabled(env: PerfEnv = readPerfEnv()) {
  return env.VITE_ENABLE_PERF_BASELINE === "1" && env.PROD !== true;
}
