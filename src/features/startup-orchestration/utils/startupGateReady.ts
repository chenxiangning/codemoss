/**
 * startup-gate-ready 归因：仅 first-paint / home-input / force-enter 可 stamp。
 * full-catalog settle MUST NOT 调用 stampStartupGateReady。
 */

import { getStartupTraceSnapshot, recordStartupMilestone } from "./startupTrace";

export type StartupGateReadyReason =
  | "first-paint-complete"
  | "home-input-ready"
  | "force-enter";

let gateReadyReason: StartupGateReadyReason | null = null;

export function getStartupGateReadyReason(): StartupGateReadyReason | null {
  return gateReadyReason;
}

/**
 * Stamp gate-ready once with an allowed reason.
 * Returns true if this call recorded the milestone.
 */
export function stampStartupGateReady(reason: StartupGateReadyReason): boolean {
  if (getStartupTraceSnapshot().milestones["startup-gate-ready"]) {
    if (!gateReadyReason) {
      gateReadyReason = reason;
    }
    return false;
  }
  gateReadyReason = reason;
  recordStartupMilestone("startup-gate-ready");
  return true;
}

/** @internal */
export function resetStartupGateReadyForTests(): void {
  gateReadyReason = null;
}
