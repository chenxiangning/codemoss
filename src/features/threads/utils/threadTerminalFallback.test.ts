import { describe, expect, it } from "vitest";
import { shouldForceSettleMissingTerminal } from "./threadTerminalFallback";

describe("threadTerminalFallback", () => {
  it("forces settle when assistant completed and no later heartbeat arrives", () => {
    expect(
      shouldForceSettleMissingTerminal({
        status: {
          isProcessing: true,
          isReviewing: false,
          processingStartedAt: 1_000,
        },
        candidate: {
          createdAt: 2_000,
          heartbeatPulseAtCapture: 1,
        },
        now: 6_500,
        graceMs: 4_000,
      }),
    ).toBe(true);
  });

  it("does not force settle before grace window elapses", () => {
    expect(
      shouldForceSettleMissingTerminal({
        status: {
          isProcessing: true,
          isReviewing: false,
          processingStartedAt: 1_000,
          heartbeatPulse: 1,
        },
        candidate: {
          createdAt: 2_000,
          heartbeatPulseAtCapture: 1,
        },
        now: 5_500,
        graceMs: 4_000,
      }),
    ).toBe(false);
  });

  it("does not force settle when a heartbeat arrives after assistant completion", () => {
    expect(
      shouldForceSettleMissingTerminal({
        status: {
          isProcessing: true,
          isReviewing: false,
          processingStartedAt: 1_000,
          heartbeatPulse: 2,
        },
        candidate: {
          createdAt: 2_000,
          heartbeatPulseAtCapture: 1,
        },
        now: 7_000,
        graceMs: 4_000,
      }),
    ).toBe(false);
  });

  it("does not force settle while thread is reviewing", () => {
    expect(
      shouldForceSettleMissingTerminal({
        status: {
          isProcessing: true,
          isReviewing: true,
          processingStartedAt: 1_000,
        },
        candidate: {
          createdAt: 2_000,
          heartbeatPulseAtCapture: 0,
        },
        now: 7_000,
        graceMs: 4_000,
      }),
    ).toBe(false);
  });
});
