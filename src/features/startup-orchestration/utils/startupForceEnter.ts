/**
 * Cold-start force-enter / max-gate-unmask coordination.
 *
 * When the user (or the 20s ceiling) unmasks the startup gate early, in-flight
 * list hydrate must soft-cancel and pending idle full-catalog re-schedules must
 * not re-flood the main thread into the same click window.
 */

import { stampStartupGateReady } from "./startupGateReady";

type ForceEnterListener = () => void;

let forceEntered = false;
let forceEnteredAtMs = 0;
const idleHydrationCancels = new Set<() => void>();
const listeners = new Set<ForceEnterListener>();

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function isStartupForceEntered(): boolean {
  return forceEntered;
}

/** Wall time of last force-enter (performance.now), or 0. */
export function getStartupForceEnteredAtMs(): number {
  return forceEnteredAtMs;
}

/**
 * Register a disposer for a post-first-paint full-catalog idle schedule.
 * Force-enter cancels all registered disposers.
 */
export function registerStartupIdleHydrationCancel(cancel: () => void): () => void {
  idleHydrationCancels.add(cancel);
  return () => {
    idleHydrationCancels.delete(cancel);
  };
}

export function subscribeStartupForceEnter(listener: ForceEnterListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Mark force-enter, cancel pending idle full-catalog schedules, notify listeners.
 * Does not cancel orchestrator tasks — caller must cancelAllTasks("stale").
 */
export function markStartupForceEnter(): void {
  forceEntered = true;
  forceEnteredAtMs = nowMs();
  for (const cancel of [...idleHydrationCancels]) {
    try {
      cancel();
    } catch {
      // ignore individual cancel failures
    }
    idleHydrationCancels.delete(cancel);
  }
  // Gate attribution only — Overlay closes without waiting full-catalog.
  stampStartupGateReady("force-enter");
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore
    }
  });
}

/** @internal */
export function resetStartupForceEnterForTests(): void {
  forceEntered = false;
  forceEnteredAtMs = 0;
  idleHydrationCancels.clear();
  listeners.clear();
}
