import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CATALOG_IDLE_PREWARM_DELAY_MS,
  scheduleCatalogIdlePrewarm,
} from "./scheduleCatalogIdlePrewarm";

describe("scheduleCatalogIdlePrewarm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defers the run past the StartupGate force-enter horizon when delay is explicit", () => {
    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((() => 1) as unknown as typeof setTimeout);
    const run = vi.fn();
    scheduleCatalogIdlePrewarm({ run, delayMs: CATALOG_IDLE_PREWARM_DELAY_MS });
    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      CATALOG_IDLE_PREWARM_DELAY_MS,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("cancel prevents the deferred run", () => {
    const handlers: Array<() => void> = [];
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((handler: unknown) => {
      if (typeof handler === "function") {
        handlers.push(handler as () => void);
      }
      return 42;
    }) as unknown as typeof setTimeout);
    const clearSpy = vi
      .spyOn(globalThis, "clearTimeout")
      .mockImplementation((() => undefined) as unknown as typeof clearTimeout);
    const run = vi.fn();
    const cancel = scheduleCatalogIdlePrewarm({
      run,
      delayMs: CATALOG_IDLE_PREWARM_DELAY_MS,
    });
    cancel();
    expect(clearSpy).toHaveBeenCalledWith(42);
    for (const handler of handlers) {
      handler();
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("runs immediately in test mode when delay is omitted (unit-hook friendly)", () => {
    const run = vi.fn();
    scheduleCatalogIdlePrewarm({ run });
    expect(run).toHaveBeenCalledTimes(1);
  });
});
