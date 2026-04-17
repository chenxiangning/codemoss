type ThreadTerminalFallbackCandidate = {
  createdAt: number;
  heartbeatPulseAtCapture?: number;
};

type ThreadTerminalFallbackStatus = {
  isProcessing?: boolean;
  isReviewing?: boolean;
  processingStartedAt?: number | null;
  heartbeatPulse?: number;
};

type ShouldForceSettleMissingTerminalParams = {
  status: ThreadTerminalFallbackStatus | undefined;
  candidate: ThreadTerminalFallbackCandidate | undefined;
  now: number;
  graceMs: number;
};

export function shouldForceSettleMissingTerminal({
  status,
  candidate,
  now,
  graceMs,
}: ShouldForceSettleMissingTerminalParams): boolean {
  if (!status?.isProcessing || status.isReviewing) {
    return false;
  }
  if (!candidate) {
    return false;
  }
  if (now - candidate.createdAt < graceMs) {
    return false;
  }
  const processingStartedAt = status.processingStartedAt ?? null;
  if (processingStartedAt !== null && candidate.createdAt < processingStartedAt) {
    return false;
  }
  const currentHeartbeatPulse = status.heartbeatPulse ?? 0;
  const heartbeatPulseAtCapture = candidate.heartbeatPulseAtCapture ?? 0;
  if (currentHeartbeatPulse > heartbeatPulseAtCapture) {
    return false;
  }
  return true;
}
