import { describe, expect, it, vi } from "vitest";
import { buildAccountUsageSnapshot } from "./accountUsageSnapshot";

const t = vi.fn((key: string) => key) as unknown as (
  key: string,
  options?: Record<string, unknown>,
) => string;

describe("buildAccountUsageSnapshot", () => {
  it("maps primary usedPercent and optional secondary window", () => {
    const snapshot = buildAccountUsageSnapshot(
      {
        primary: {
          usedPercent: 40,
          windowDurationMins: 300,
          resetsAt: null,
        },
        secondary: {
          usedPercent: 10,
          windowDurationMins: 10080,
          resetsAt: null,
        },
      },
      false,
      t as never,
    );

    expect(snapshot.sessionPercent).toBe(40);
    expect(snapshot.weeklyPercent).toBe(10);
    expect(snapshot.showWeekly).toBe(true);
  });

  it("inverts percent when usageShowRemaining is true", () => {
    const snapshot = buildAccountUsageSnapshot(
      {
        primary: {
          usedPercent: 25,
          windowDurationMins: 60,
          resetsAt: null,
        },
      },
      true,
      t as never,
    );

    expect(snapshot.sessionPercent).toBe(75);
  });

  it("returns null percents for missing account data", () => {
    const snapshot = buildAccountUsageSnapshot(null, false, t as never);
    expect(snapshot.sessionPercent).toBeNull();
    expect(snapshot.weeklyPercent).toBeNull();
    expect(snapshot.showWeekly).toBe(false);
  });
});
