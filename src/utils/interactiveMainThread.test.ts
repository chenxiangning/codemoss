// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  markInteractiveInputForTests,
  resetInteractiveMainThreadForTests,
  scheduleWhenBrowserIdle,
  scheduleWhenInteractiveQuiet,
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

describe("scheduleWhenInteractiveQuiet", () => {
  it("waits for quiet period after minDelay before running", () => {
    const fn = vi.fn();
    scheduleWhenInteractiveQuiet(fn, {
      minDelayMs: 200,
      quietMs: 100,
      maxWaitMs: 5_000,
      pollMs: 50,
    });
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();
    // past minDelay, no input → lastInputAtMs 0 counts as quiet
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("defers while recent pointer input continues", () => {
    const fn = vi.fn();
    scheduleWhenInteractiveQuiet(fn, {
      minDelayMs: 0,
      quietMs: 300,
      maxWaitMs: 2_000,
      pollMs: 50,
    });
    // Simulate continuous clicks (test helper — fake timers + Date.now)
    markInteractiveInputForTests();
    vi.advanceTimersByTime(100);
    markInteractiveInputForTests();
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
    // stop clicking → quiet 300ms
    vi.advanceTimersByTime(350);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("cancel prevents run", () => {
    const fn = vi.fn();
    const cancel = scheduleWhenInteractiveQuiet(fn, {
      minDelayMs: 50,
      quietMs: 50,
      maxWaitMs: 500,
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
