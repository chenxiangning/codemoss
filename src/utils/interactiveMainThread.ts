/**
 * Cooperative yielding so cold-start IPC result application does not starve
 * pointer/keyboard input (field: open app → immediate click freezes until load
 * settles).
 *
 * Different from "quiet period" (which delayed *starting* work and made 100%
 * worse by bursting). Here work can start; we only *pause apply* when input is
 * pending.
 */

type SchedulingNavigator = Navigator & {
  scheduling?: {
    isInputPending?: (options?: { includeContinuous?: boolean }) => boolean;
  };
};

let lastInputAtMs = 0;
let inputHooksInstalled = false;

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function isInputPending(): boolean {
  try {
    const scheduling = (navigator as SchedulingNavigator).scheduling;
    if (typeof scheduling?.isInputPending === "function") {
      return scheduling.isInputPending({ includeContinuous: true });
    }
  } catch {
    // ignore
  }
  // Fallback: recent input within 48ms counts as busy.
  return nowMs() - lastInputAtMs < 48;
}

/** Install once: track pointer/key so apply can yield after input. */
export function ensureInteractiveInputHooks(): void {
  if (inputHooksInstalled || typeof window === "undefined") {
    return;
  }
  inputHooksInstalled = true;
  const mark = () => {
    lastInputAtMs = nowMs();
  };
  window.addEventListener("pointerdown", mark, { capture: true, passive: true });
  window.addEventListener("keydown", mark, { capture: true, passive: true });
  window.addEventListener("wheel", mark, { capture: true, passive: true });
}

function yieldMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function yieldAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      window.setTimeout(resolve, 16);
    }
  });
}

/**
 * Wait until input is not pending (or maxRounds of yields). Call before large
 * React commits (setThreads, hydration Set updates).
 */
export async function yieldToInteractiveInput(
  options: { maxRounds?: number } = {},
): Promise<void> {
  ensureInteractiveInputHooks();
  const maxRounds = options.maxRounds ?? 24;
  for (let i = 0; i < maxRounds; i++) {
    if (!isInputPending() && nowMs() - lastInputAtMs >= 16) {
      break;
    }
    await yieldMacrotask();
  }
  // One frame so the browser can paint the click feedback.
  await yieldAnimationFrame();
}

/**
 * Run fn when the browser is idle. Falls back to setTimeout. Cancel with
 * returned disposer.
 */
export function scheduleWhenBrowserIdle(
  fn: () => void,
  options: { timeoutMs?: number; minDelayMs?: number } = {},
): () => void {
  const timeoutMs = options.timeoutMs ?? 4_000;
  const minDelayMs = options.minDelayMs ?? 0;
  let cancelled = false;
  let idleId: number | null = null;
  let timerId: number | null = null;

  const run = () => {
    if (cancelled) {
      return;
    }
    fn();
  };

  const startIdle = () => {
    if (cancelled) {
      return;
    }
    if (typeof requestIdleCallback === "function") {
      idleId = requestIdleCallback(
        () => {
          idleId = null;
          run();
        },
        { timeout: timeoutMs },
      );
    } else {
      timerId = window.setTimeout(run, Math.min(timeoutMs, 1_000));
    }
  };

  if (minDelayMs > 0) {
    timerId = window.setTimeout(() => {
      timerId = null;
      startIdle();
    }, minDelayMs);
  } else {
    startIdle();
  }

  return () => {
    cancelled = true;
    if (idleId != null && typeof cancelIdleCallback === "function") {
      cancelIdleCallback(idleId);
    }
    if (timerId != null) {
      window.clearTimeout(timerId);
    }
  };
}

/** @internal */
export function resetInteractiveMainThreadForTests(): void {
  lastInputAtMs = 0;
  // hooks stay installed (window listeners); only timing state resets
}
