/**
 * 幕布滚动所有权 — 纯状态机（无 DOM）。
 * 合同：docs/plans/2026-08-01-conversation-canvas-scroll-ownership-architecture.md
 */

import {
  FOLLOW_REARM_THRESHOLD_PX,
  FOLLOW_RELEASE_THRESHOLD_PX,
  MIN_FORCED_HOLD_MS,
  STABLE_HEIGHT_MIN_SAMPLES,
  STABLE_HEIGHT_WINDOW_MS,
  TRUE_BOTTOM_EPSILON_PX,
  USER_SCROLL_ACCUM_UP_PX,
  USER_SCROLL_ACCUM_WINDOW_MS,
  USER_SCROLL_MIN_DELTA_Y,
} from "./scrollAuthorityConstants";
import type {
  ForcedRetireKind,
  GeometryDelta,
  GeometryStabilitySnapshot,
  ScrollAuthorityDecision,
  ScrollAuthorityIntent,
  ScrollAuthorityState,
  ScrollOwner,
  ViewportMode,
  WriteTicket,
} from "./scrollAuthorityTypes";
import { issueWriteTicket } from "./scrollWriteTicket";

export function ownerForMode(mode: ViewportMode): ScrollOwner {
  switch (mode) {
    case "stick-bottom":
      return "stick";
    case "forced-bottom":
      return "forced";
    case "jump-anchor":
      return "jump";
    case "history-head":
      return "explicit";
    case "free":
    default:
      return "none";
  }
}

export function distanceToBottom(input: {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}): number {
  return Math.max(0, input.scrollHeight - input.clientHeight - input.scrollTop);
}

export function isAtTrueBottom(input: {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
  epsilonPx?: number;
}): boolean {
  const epsilon = input.epsilonPx ?? TRUE_BOTTOM_EPSILON_PX;
  return distanceToBottom(input) <= epsilon;
}

export function createInitialGeometrySnapshot(
  now: number,
  phase: "static" | "virtual" = "static",
): GeometryStabilitySnapshot {
  return {
    lastScrollHeight: 0,
    lastScrollHeightChangeAt: now,
    sameHeightSampleCount: 0,
    pendingVirtualRemeasureCount: 0,
    phase,
    phaseDesired: phase,
    pendingMediaLoads: 0,
    finalizingPresentationActive: false,
  };
}

export function createInitialScrollAuthorityState(input: {
  liveAutoFollowEnabled: boolean;
  scopeGeneration?: number;
  now: number;
}): ScrollAuthorityState {
  return {
    mode: input.liveAutoFollowEnabled ? "stick-bottom" : "free",
    liveAutoFollowEnabled: input.liveAutoFollowEnabled,
    scopeGeneration: input.scopeGeneration ?? 0,
    ticket: null,
    geometry: createInitialGeometrySnapshot(input.now),
    accumUpPx: 0,
    accumUpWindowStartedAt: null,
    lastReasonCode: null,
  };
}

export function applyGeometryDeltaToSnapshot(
  geometry: GeometryStabilitySnapshot,
  delta: GeometryDelta,
  now: number,
): GeometryStabilitySnapshot {
  const heightChanged = delta.scrollHeight !== geometry.lastScrollHeight;
  const sameHeightSampleCount = heightChanged
    ? 1
    : geometry.sameHeightSampleCount + 1;
  return {
    lastScrollHeight: delta.scrollHeight,
    lastScrollHeightChangeAt: heightChanged
      ? now
      : geometry.lastScrollHeightChangeAt,
    sameHeightSampleCount,
    pendingVirtualRemeasureCount:
      delta.pendingVirtualRemeasureCount ?? geometry.pendingVirtualRemeasureCount,
    phase: delta.phase,
    phaseDesired: delta.phaseDesired ?? delta.phase,
    pendingMediaLoads: delta.pendingMediaLoads ?? geometry.pendingMediaLoads,
    finalizingPresentationActive:
      delta.finalizingPresentationActive ?? geometry.finalizingPresentationActive,
  };
}

export function isGeometryStable(
  geometry: GeometryStabilitySnapshot,
  now: number,
): boolean {
  if (now - geometry.lastScrollHeightChangeAt < STABLE_HEIGHT_WINDOW_MS) {
    return false;
  }
  if (geometry.sameHeightSampleCount < STABLE_HEIGHT_MIN_SAMPLES) {
    return false;
  }
  if (geometry.pendingVirtualRemeasureCount > 0) {
    return false;
  }
  if (geometry.phase !== geometry.phaseDesired) {
    return false;
  }
  if (geometry.pendingMediaLoads > 0) {
    return false;
  }
  if (geometry.finalizingPresentationActive) {
    return false;
  }
  return true;
}

export function canRetireForced(input: {
  ticket: WriteTicket | null;
  geometry: GeometryStabilitySnapshot;
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
  now: number;
}): ForcedRetireKind {
  // 安全阀优先于最短保持 / finalizing
  if (input.ticket && input.now >= input.ticket.safetyTimeoutAt) {
    return "safety-timeout";
  }
  // Claude/Codex finalizing 呈现窗内禁止稳态退役（与 isGeometryStable 双保险）
  if (input.geometry.finalizingPresentationActive) {
    return "hold";
  }
  // 最短保持：deferred 回刷 + 最长 finalizing（Codex 6s）
  if (
    input.ticket &&
    input.now - input.ticket.issuedAt < MIN_FORCED_HOLD_MS
  ) {
    return "hold";
  }
  if (
    isAtTrueBottom({
      scrollHeight: input.scrollHeight,
      clientHeight: input.clientHeight,
      scrollTop: input.scrollTop,
    }) &&
    isGeometryStable(input.geometry, input.now)
  ) {
    return "stable";
  }
  return "hold";
}

/**
 * 明确用户上滚？(DESIGN §3.4.1)
 */
export function isExplicitUpwardUserScroll(input: {
  deltaY?: number;
  explicitSource?: "wheel" | "key" | "touch" | "pointer";
  accumUpPx: number;
  accumUpWindowStartedAt: number | null;
  now: number;
}): { explicit: boolean; nextAccumUpPx: number; nextWindowStartedAt: number | null } {
  const source = input.explicitSource;
  if (source === "key" || source === "touch" || source === "pointer") {
    return {
      explicit: true,
      nextAccumUpPx: 0,
      nextWindowStartedAt: null,
    };
  }

  const deltaY = input.deltaY ?? 0;
  if (deltaY >= 0) {
    return {
      explicit: false,
      nextAccumUpPx: 0,
      nextWindowStartedAt: null,
    };
  }

  const abs = Math.abs(deltaY);
  if (abs >= USER_SCROLL_MIN_DELTA_Y) {
    return {
      explicit: true,
      nextAccumUpPx: 0,
      nextWindowStartedAt: null,
    };
  }

  // 微抖累计
  let windowStarted = input.accumUpWindowStartedAt;
  let accum = input.accumUpPx;
  if (windowStarted === null || input.now - windowStarted > USER_SCROLL_ACCUM_WINDOW_MS) {
    windowStarted = input.now;
    accum = 0;
  }
  accum += abs;
  if (accum >= USER_SCROLL_ACCUM_UP_PX) {
    return {
      explicit: true,
      nextAccumUpPx: 0,
      nextWindowStartedAt: null,
    };
  }
  return {
    explicit: false,
    nextAccumUpPx: accum,
    nextWindowStartedAt: windowStarted,
  };
}

export function browserClampProven(
  previous: { maxScrollTop: number; scrollTop: number } | null,
  current: { maxScrollTop: number; scrollTop: number },
  tolerancePx = TRUE_BOTTOM_EPSILON_PX + 1,
): boolean {
  if (!previous) {
    return false;
  }
  return (
    current.maxScrollTop < previous.maxScrollTop - 1 &&
    previous.scrollTop > current.maxScrollTop + 1 &&
    Math.abs(current.scrollTop - current.maxScrollTop) <= tolerancePx
  );
}

function retireForcedToRest(
  state: ScrollAuthorityState,
  reasonCode: string,
): ScrollAuthorityState {
  const mode: ViewportMode = state.liveAutoFollowEnabled
    ? "stick-bottom"
    : "free";
  return {
    ...state,
    mode,
    ticket: null,
    lastReasonCode: reasonCode,
    accumUpPx: 0,
    accumUpWindowStartedAt: null,
  };
}

function enterForced(
  state: ScrollAuthorityState,
  now: number,
  reasonCode: string,
): { state: ScrollAuthorityState; ticket: WriteTicket } {
  const ticket = issueWriteTicket({
    owner: "forced",
    edge: "bottom",
    motion: "instant",
    generation: state.scopeGeneration,
    now,
  });
  return {
    ticket,
    state: {
      ...state,
      mode: "forced-bottom",
      ticket,
      lastReasonCode: reasonCode,
      accumUpPx: 0,
      accumUpWindowStartedAt: null,
    },
  };
}

function maybeRetireForced(
  state: ScrollAuthorityState,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop: number },
  now: number,
): ScrollAuthorityDecision | null {
  if (state.mode !== "forced-bottom") {
    return null;
  }
  const kind = canRetireForced({
    ticket: state.ticket,
    geometry: state.geometry,
    scrollHeight: metrics.scrollHeight,
    clientHeight: metrics.clientHeight,
    scrollTop: metrics.scrollTop,
    now,
  });
  if (kind === "hold") {
    return null;
  }
  if (kind === "safety-timeout") {
    const next = retireForcedToRest(state, "settle-timeout-short-of-bottom");
    return {
      state: next,
      requestBottomPin: true,
      requestTopPin: false,
      reasonCode: "settle-timeout-short-of-bottom",
    };
  }
  const next = retireForcedToRest(state, "forced-retired-stable");
  return {
    state: next,
    requestBottomPin: false,
    requestTopPin: false,
    reasonCode: "forced-retired-stable",
  };
}

/**
 * 处理几何观测（先 fold geometry，再尝试退役 / pin）。
 */
export function reduceGeometry(
  state: ScrollAuthorityState,
  delta: GeometryDelta,
  now: number,
): ScrollAuthorityDecision {
  let nextState: ScrollAuthorityState = {
    ...state,
    geometry: applyGeometryDeltaToSnapshot(state.geometry, delta, now),
    scopeGeneration: delta.scopeGeneration,
  };

  if (delta.kind === "scope-switch") {
    nextState = {
      ...createInitialScrollAuthorityState({
        liveAutoFollowEnabled: state.liveAutoFollowEnabled,
        scopeGeneration: delta.scopeGeneration,
        now,
      }),
      liveAutoFollowEnabled: state.liveAutoFollowEnabled,
    };
    return {
      state: nextState,
      requestBottomPin: false,
      requestTopPin: false,
      reasonCode: "scope-switch",
    };
  }

  const metrics = {
    scrollHeight: delta.scrollHeight,
    clientHeight: delta.clientHeight,
    scrollTop: delta.scrollTop,
  };

  const retired = maybeRetireForced(nextState, metrics, now);
  if (retired) {
    return retired;
  }

  const shouldPin =
    nextState.mode === "forced-bottom" || nextState.mode === "stick-bottom";

  const heightGrew =
    delta.scrollHeight > state.geometry.lastScrollHeight ||
    delta.kind === "chrome-resize" ||
    delta.kind === "measure-late" ||
    delta.kind === "content-grow" ||
    delta.kind === "media-load" ||
    delta.kind === "hydrate-detail" ||
    delta.kind === "finalizing-presentation";

  const heightShrunk =
    delta.kind === "content-shrink" ||
    delta.scrollHeight < state.geometry.lastScrollHeight;

  return {
    state: {
      ...nextState,
      lastReasonCode: shouldPin && (heightGrew || heightShrunk)
        ? heightGrew
          ? "post-settle-grow-while-forced"
          : "geometry-shrink-re-pin"
        : nextState.lastReasonCode,
    },
    requestBottomPin: shouldPin && (heightGrew || heightShrunk || !isAtTrueBottom(metrics)),
    requestTopPin: false,
    reasonCode:
      shouldPin && heightGrew
        ? nextState.mode === "forced-bottom"
          ? "post-settle-grow-while-forced"
          : "stick-grow-re-pin"
        : shouldPin && heightShrunk
          ? "geometry-shrink-re-pin"
          : null,
  };
}

/**
 * 处理 Intent。
 */
export function reduceIntent(
  state: ScrollAuthorityState,
  intent: ScrollAuthorityIntent,
  now: number,
  _metrics?: { scrollHeight: number; clientHeight: number; scrollTop: number },
): ScrollAuthorityDecision {
  void _metrics;
  switch (intent.type) {
    case "scope-switch": {
      const next = createInitialScrollAuthorityState({
        liveAutoFollowEnabled: state.liveAutoFollowEnabled,
        scopeGeneration: state.scopeGeneration + 1,
        now,
      });
      return {
        state: next,
        requestBottomPin: false,
        requestTopPin: false,
        reasonCode: "scope-switch",
      };
    }
    case "turn-send":
    case "turn-settle":
    case "open-thread": {
      const { state: forcedState } = enterForced(
        state,
        now,
        intent.type === "turn-send"
          ? "turn-send-forced"
          : intent.type === "turn-settle"
            ? "turn-settle-forced"
            : "open-thread-forced",
      );
      return {
        state: forcedState,
        requestBottomPin: true,
        requestTopPin: false,
        reasonCode: forcedState.lastReasonCode,
      };
    }
    case "explicit-bottom": {
      const ticket = issueWriteTicket({
        owner: "explicit",
        edge: "bottom",
        motion: "smooth",
        generation: state.scopeGeneration,
        now,
      });
      const mode: ViewportMode = state.liveAutoFollowEnabled
        ? "stick-bottom"
        : "free";
      return {
        state: {
          ...state,
          mode,
          ticket,
          lastReasonCode: "explicit-bottom",
          accumUpPx: 0,
          accumUpWindowStartedAt: null,
        },
        requestBottomPin: true,
        requestTopPin: false,
        reasonCode: "explicit-bottom",
      };
    }
    case "explicit-top":
    case "reveal-history-manual": {
      return {
        state: {
          ...state,
          mode: intent.type === "reveal-history-manual" ? "history-head" : "free",
          ticket: null,
          lastReasonCode:
            intent.type === "reveal-history-manual"
              ? "reveal-history-manual"
              : "explicit-top",
          accumUpPx: 0,
          accumUpWindowStartedAt: null,
        },
        requestBottomPin: false,
        requestTopPin: true,
        reasonCode:
          intent.type === "reveal-history-manual"
            ? "reveal-history-manual"
            : "explicit-top",
      };
    }
    case "jump-to-message": {
      const ticket = issueWriteTicket({
        owner: "jump",
        edge: { messageId: intent.messageId },
        motion: "smooth",
        generation: state.scopeGeneration,
        now,
      });
      return {
        state: {
          ...state,
          mode: "jump-anchor",
          ticket,
          lastReasonCode: "jump-to-message",
        },
        requestBottomPin: false,
        requestTopPin: false,
        reasonCode: "jump-to-message",
      };
    }
    case "focus-follow-on": {
      return {
        state: {
          ...state,
          liveAutoFollowEnabled: true,
          mode: "stick-bottom",
          lastReasonCode: "focus-follow-on",
          accumUpPx: 0,
          accumUpWindowStartedAt: null,
        },
        requestBottomPin: true,
        requestTopPin: false,
        reasonCode: "focus-follow-on",
      };
    }
    case "focus-follow-off": {
      return {
        state: {
          ...state,
          liveAutoFollowEnabled: false,
          mode: state.mode === "forced-bottom" ? "forced-bottom" : "free",
          ticket: state.mode === "forced-bottom" ? state.ticket : null,
          lastReasonCode: "focus-follow-off",
        },
        requestBottomPin: false,
        requestTopPin: false,
        reasonCode: "focus-follow-off",
      };
    }
    case "user-scroll": {
      const upward = isExplicitUpwardUserScroll({
        deltaY: intent.deltaY,
        explicitSource: intent.explicitSource,
        accumUpPx: state.accumUpPx,
        accumUpWindowStartedAt: state.accumUpWindowStartedAt,
        now,
      });

      if (state.mode === "forced-bottom") {
        if (upward.explicit) {
          return {
            state: {
              ...state,
              mode: "free",
              ticket: null,
              lastReasonCode: "forced-interrupted-by-user-scroll",
              accumUpPx: 0,
              accumUpWindowStartedAt: null,
            },
            requestBottomPin: false,
            requestTopPin: false,
            reasonCode: "forced-interrupted-by-user-scroll",
          };
        }
        return {
          state: {
            ...state,
            accumUpPx: upward.nextAccumUpPx,
            accumUpWindowStartedAt: upward.nextWindowStartedAt,
            lastReasonCode: "forced-ignored-noise-scroll",
          },
          requestBottomPin: false,
          requestTopPin: false,
          reasonCode: "forced-ignored-noise-scroll",
        };
      }

      // 非 forced：明确上滚 → free；近底 re-arm
      if (upward.explicit || (intent.deltaY !== undefined && intent.deltaY < 0)) {
        const near = intent.nearBottomForRearm === true;
        if (
          near &&
          state.liveAutoFollowEnabled &&
          intent.deltaY !== undefined &&
          intent.deltaY > 0
        ) {
          // 向下滚回底在 rearm 路径处理
        }
        if (intent.deltaY !== undefined && intent.deltaY < 0) {
          return {
            state: {
              ...state,
              mode: "free",
              ticket: null,
              lastReasonCode: "user-scroll-up-free",
              accumUpPx: upward.nextAccumUpPx,
              accumUpWindowStartedAt: upward.nextWindowStartedAt,
            },
            requestBottomPin: false,
            requestTopPin: false,
            reasonCode: "user-scroll-up-free",
          };
        }
      }

      if (
        intent.nearBottomForRearm &&
        state.liveAutoFollowEnabled &&
        (intent.deltaY === undefined || intent.deltaY >= 0)
      ) {
        return {
          state: {
            ...state,
            mode: "stick-bottom",
            lastReasonCode: "user-rearm-stick",
            accumUpPx: 0,
            accumUpWindowStartedAt: null,
          },
          requestBottomPin: true,
          requestTopPin: false,
          reasonCode: "user-rearm-stick",
        };
      }

      return {
        state: {
          ...state,
          accumUpPx: upward.nextAccumUpPx,
          accumUpWindowStartedAt: upward.nextWindowStartedAt,
        },
        requestBottomPin: false,
        requestTopPin: false,
        reasonCode: null,
      };
    }
    default: {
      const _exhaustive: never = intent;
      void _exhaustive;
      return {
        state,
        requestBottomPin: false,
        requestTopPin: false,
        reasonCode: null,
      };
    }
  }
}

/** 同帧：先 geometry 再 intent（DESIGN §4.4） */
export function reduceFrame(input: {
  state: ScrollAuthorityState;
  geometries?: GeometryDelta[];
  intents?: ScrollAuthorityIntent[];
  now: number;
}): ScrollAuthorityDecision {
  let decision: ScrollAuthorityDecision = {
    state: input.state,
    requestBottomPin: false,
    requestTopPin: false,
    reasonCode: null,
  };

  for (const delta of input.geometries ?? []) {
    const next = reduceGeometry(decision.state, delta, input.now);
    decision = {
      state: next.state,
      requestBottomPin: decision.requestBottomPin || next.requestBottomPin,
      requestTopPin: decision.requestTopPin || next.requestTopPin,
      reasonCode: next.reasonCode ?? decision.reasonCode,
    };
  }

  // Intent 优先级：explicit > user > jump > reveal > turn* > focus
  const rank = (intent: ScrollAuthorityIntent): number => {
    switch (intent.type) {
      case "explicit-bottom":
      case "explicit-top":
        return 0;
      case "user-scroll":
        return 1;
      case "jump-to-message":
        return 2;
      case "reveal-history-manual":
        return 3;
      case "turn-send":
      case "turn-settle":
      case "open-thread":
        return 4;
      case "focus-follow-on":
      case "focus-follow-off":
        return 5;
      case "scope-switch":
        return -1;
      default:
        return 9;
    }
  };

  const intents = [...(input.intents ?? [])].sort((a, b) => rank(a) - rank(b));
  // same rank last-wins：稳定排序后同 rank 后者覆盖 — 用 reduce 按序应用
  for (const intent of intents) {
    const next = reduceIntent(decision.state, intent, input.now);
    decision = {
      state: next.state,
      requestBottomPin: decision.requestBottomPin || next.requestBottomPin,
      requestTopPin: decision.requestTopPin || next.requestTopPin,
      reasonCode: next.reasonCode ?? decision.reasonCode,
    };
  }

  return decision;
}

export function shouldContinuousPin(mode: ViewportMode): boolean {
  return mode === "forced-bottom" || mode === "stick-bottom";
}

/** re-arm 只认真底（≤ TRUE_BOTTOM / FOLLOW_REARM 已收敛为 1px） */
export function isNearBottomForRearm(distancePx: number): boolean {
  return distancePx <= FOLLOW_REARM_THRESHOLD_PX;
}

/** scroll 事件离底释放：滞回阈值，避免 2px 抖动反复解/绑 */
export function isFarEnoughToReleaseFollow(distancePx: number): boolean {
  return distancePx > FOLLOW_RELEASE_THRESHOLD_PX;
}
