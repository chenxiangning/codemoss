/**
 * P1-3 / P1-4: schedule catalog idle-prewarm after the StartupGate window.
 *
 * Cold-start used to fire skills/prompts/commands/collaboration/models prewarm
 * immediately on mount, flooding the gate task board. We wait until after the
 * force-enter horizon (10s) unless the caller is cancelled earlier.
 */

/** Force-enter is 10s; keep a small margin so gate dismiss settles first. */
export const CATALOG_IDLE_PREWARM_DELAY_MS = 12_000;

export type ScheduleCatalogIdlePrewarmOptions = {
  delayMs?: number;
  run: () => void;
};

/**
 * Returns a cancel function suitable for useEffect cleanup.
 */
export function scheduleCatalogIdlePrewarm(
  options: ScheduleCatalogIdlePrewarmOptions,
): () => void {
  // Vitest unit hooks assert immediate catalog fetch; keep production deferred.
  const isTestMode = (() => {
    try {
      return import.meta.env.MODE === "test";
    } catch {
      return false;
    }
  })();
  if (isTestMode && options.delayMs == null) {
    options.run();
    return () => {};
  }

  const delayMs = options.delayMs ?? CATALOG_IDLE_PREWARM_DELAY_MS;
  let cancelled = false;
  const timer = globalThis.setTimeout(() => {
    if (cancelled) {
      return;
    }
    options.run();
  }, delayMs);

  return () => {
    cancelled = true;
    globalThis.clearTimeout(timer);
  };
}
