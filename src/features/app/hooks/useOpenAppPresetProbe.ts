import { useEffect, useRef, useState } from "react";
import {
  probeOpenAppPresets,
  type OpenAppPresetProbeResult,
} from "../../../services/tauri";
import type { OpenAppPresetProbe } from "../utils/openAppHealth";

type UseOpenAppPresetProbeOptions = {
  /** Only probe when the Open With settings section is active. */
  enabled: boolean;
};

// Session-level cache: avoid repeat IPC when re-entering settings.
let sessionProbeCache: Record<string, OpenAppPresetProbe> | null = null;
let sessionProbeInFlight: Promise<Record<string, OpenAppPresetProbe>> | null =
  null;

function toProbeMap(
  results: OpenAppPresetProbeResult[],
): Record<string, OpenAppPresetProbe> {
  const map: Record<string, OpenAppPresetProbe> = {};
  for (const item of results) {
    map[item.id] = {
      id: item.id,
      installed: item.installed,
      resolvedPath: item.resolvedPath ?? null,
    };
  }
  return map;
}

async function loadProbeMap(): Promise<Record<string, OpenAppPresetProbe>> {
  if (sessionProbeCache) {
    return sessionProbeCache;
  }
  if (sessionProbeInFlight) {
    return sessionProbeInFlight;
  }
  sessionProbeInFlight = probeOpenAppPresets()
    .then((results) => {
      sessionProbeCache = toProbeMap(results);
      return sessionProbeCache;
    })
    .catch(() => {
      // Soft-fail: settings stay usable without health badges.
      sessionProbeCache = {};
      return sessionProbeCache;
    })
    .finally(() => {
      sessionProbeInFlight = null;
    });
  return sessionProbeInFlight;
}

/**
 * Lazy open-app preset probe. Never polls; never runs when disabled.
 */
export function useOpenAppPresetProbe(
  options: UseOpenAppPresetProbeOptions,
): {
  probeById: Record<string, OpenAppPresetProbe>;
  probing: boolean;
} {
  const { enabled } = options;
  const [probeById, setProbeById] = useState<Record<string, OpenAppPresetProbe>>(
    () => sessionProbeCache ?? {},
  );
  const [probing, setProbing] = useState(false);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (sessionProbeCache) {
      setProbeById(sessionProbeCache);
      return;
    }
    if (requestedRef.current && sessionProbeInFlight) {
      return;
    }
    requestedRef.current = true;
    let cancelled = false;
    setProbing(true);
    void loadProbeMap().then((map) => {
      if (!cancelled) {
        setProbeById(map);
        setProbing(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { probeById, probing };
}

/** Test helper — clears session cache between unit tests. */
export function __resetOpenAppPresetProbeCacheForTests(): void {
  sessionProbeCache = null;
  sessionProbeInFlight = null;
}
