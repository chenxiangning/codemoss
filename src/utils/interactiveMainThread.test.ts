// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetInteractiveMainThreadForTests,
  scheduleWhenBrowserIdle,
  yieldToInteractiveInput,
} from "./interactiveMainThread";

beforeEach(() => {
  resetInteractiveMainThreadForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  resetInteractiveMainThreadForTests();
});

describe("scheduleWhenBrowserIdle", () => {
  it("runs after minDelay when idle API missing", () => {
    const fn = vi.fn();
    // jsdom may lack requestIdleCallback — fallback path
    scheduleWhenBrowserIdle(fn, { minDelayMs: 100, timeoutMs: 500 });
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    // idle fallback or ric — flush
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalled();
  });

  it("cancel prevents run", () => {
    const fn = vi.fn();
    const cancel = scheduleWhenBrowserIdle(fn, {
      minDelayMs: 50,
      timeoutMs: 200,
    });
    cancel();
    vi.advanceTimersByTime(1_000);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("yieldToInteractiveInput", () => {
  it("resolves without hanging", async () => {
    const p = yieldToInteractiveInput({ maxRounds: 2 });
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBeUndefined();
  });
});
