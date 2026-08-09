import { useCallback, useEffect, useState } from "react";
import type { CliInstallEngine, CliVersionStatus } from "@/types";
import { getCliVersionStatus } from "@/services/tauri";

type UseCliVersionStatusOptions = {
  engine: CliInstallEngine;
  enabled?: boolean;
};

/** Session-local cache so CLI switch can paint last-known version immediately. */
const cliVersionStatusCache = new Map<CliInstallEngine, CliVersionStatus>();

function readCachedStatus(engine: CliInstallEngine): CliVersionStatus | null {
  return cliVersionStatusCache.get(engine) ?? null;
}

export function useCliVersionStatus({
  engine,
  enabled = true,
}: UseCliVersionStatusOptions) {
  const cached = enabled ? readCachedStatus(engine) : null;
  const [status, setStatus] = useState<CliVersionStatus | null>(cached);
  // Avoid first paint flashing "not installed" before the effect runs.
  const [loading, setLoading] = useState(() => enabled && cached === null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getCliVersionStatus(engine);
      // Guard against out-of-order responses if engine/enabled flips mid-flight.
      if (next.engine && next.engine !== engine) {
        return;
      }
      cliVersionStatusCache.set(engine, next);
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // Keep cached status if any; only clear when we had nothing to show.
      setStatus((previous) => previous ?? readCachedStatus(engine));
    } finally {
      setLoading(false);
    }
  }, [enabled, engine]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const nextCached = readCachedStatus(engine);
    setStatus(nextCached);
    // Soft refresh when cache hits; hard loading only when cold.
    setLoading(nextCached === null);
    void refresh();
  }, [enabled, engine, refresh]);

  return {
    status,
    loading,
    error,
    refresh,
  };
}
