import { describe, expect, it, beforeEach } from "vitest";
import {
  MIN_FORCED_HOLD_MS,
  SAFETY_TIMEOUT_FORCED_MS,
  STABLE_HEIGHT_MIN_SAMPLES,
  STABLE_HEIGHT_WINDOW_MS,
  TRUE_BOTTOM_EPSILON_PX,
  USER_SCROLL_MIN_DELTA_Y,
} from "./scrollAuthorityConstants";
import {
  browserClampProven,
  canRetireForced,
  createInitialScrollAuthorityState,
  distanceToBottom,
  isAtTrueBottom,
  isExplicitUpwardUserScroll,
  isGeometryStable,
  ownerForMode,
  reduceFrame,
  reduceGeometry,
  reduceIntent,
  shouldContinuousPin,
} from "./scrollAuthorityMachine";
import { resetScrollWriteTicketSeqForTests, ticketMatchesAppliedScrollTop, recordTicketAppliedScrollTop } from "./scrollWriteTicket";
import type { GeometryDelta, ScrollAuthorityState } from "./scrollAuthorityTypes";

function metricsAtBottom(scrollHeight = 2000, clientHeight = 720) {
  return {
    scrollHeight,
    clientHeight,
    scrollTop: scrollHeight - clientHeight,
  };
}

function observeDelta(
  state: ScrollAuthorityState,
  partial: Partial<GeometryDelta> & Pick<GeometryDelta, "scrollHeight" | "clientHeight" | "scrollTop">,
): GeometryDelta {
  return {
    kind: partial.kind ?? "observe",
    scrollHeight: partial.scrollHeight,
    clientHeight: partial.clientHeight,
    scrollTop: partial.scrollTop,
    maxScrollTop: Math.max(0, partial.scrollHeight - partial.clientHeight),
    phase: partial.phase ?? "static",
    scopeGeneration: partial.scopeGeneration ?? state.scopeGeneration,
    pendingVirtualRemeasureCount: partial.pendingVirtualRemeasureCount ?? 0,
    phaseDesired: partial.phaseDesired ?? partial.phase ?? "static",
    pendingMediaLoads: partial.pendingMediaLoads ?? 0,
    finalizingPresentationActive: partial.finalizingPresentationActive ?? false,
  };
}

describe("scrollAuthorityMachine", () => {
  beforeEach(() => {
    resetScrollWriteTicketSeqForTests();
  });

  it("maps mode to owner 1:1", () => {
    expect(ownerForMode("stick-bottom")).toBe("stick");
    expect(ownerForMode("forced-bottom")).toBe("forced");
    expect(ownerForMode("free")).toBe("none");
    expect(ownerForMode("jump-anchor")).toBe("jump");
  });

  it("defines true bottom at 1px epsilon not 120", () => {
    expect(
      isAtTrueBottom({ scrollHeight: 1000, clientHeight: 700, scrollTop: 299 }),
    ).toBe(true);
    expect(
      isAtTrueBottom({ scrollHeight: 1000, clientHeight: 700, scrollTop: 298 }),
    ).toBe(false);
    expect(distanceToBottom({ scrollHeight: 1000, clientHeight: 700, scrollTop: 200 })).toBe(
      100,
    );
    expect(TRUE_BOTTOM_EPSILON_PX).toBe(1);
  });

  it("enters forced-bottom on turn-settle and requests pin", () => {
    const now = 1_000;
    const state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: true,
      now,
    });
    const decision = reduceIntent(state, { type: "turn-settle" }, now);
    expect(decision.state.mode).toBe("forced-bottom");
    expect(decision.requestBottomPin).toBe(true);
    expect(decision.state.ticket?.owner).toBe("forced");
    expect(decision.state.ticket?.safetyTimeoutAt).toBe(now + SAFETY_TIMEOUT_FORCED_MS);
  });

  it("interrupts forced on explicit wheel up", () => {
    const now = 1_000;
    let state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: true,
      now,
    });
    state = reduceIntent(state, { type: "turn-settle" }, now).state;
    const decision = reduceIntent(
      state,
      {
        type: "user-scroll",
        deltaY: -USER_SCROLL_MIN_DELTA_Y,
        explicitSource: "wheel",
      },
      now + 10,
    );
    expect(decision.state.mode).toBe("free");
    expect(decision.reasonCode).toBe("forced-interrupted-by-user-scroll");
    expect(shouldContinuousPin(decision.state.mode)).toBe(false);
  });

  it("does not interrupt forced on micro wheel noise", () => {
    const now = 1_000;
    let state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: true,
      now,
    });
    state = reduceIntent(state, { type: "turn-settle" }, now).state;
    const decision = reduceIntent(
      state,
      { type: "user-scroll", deltaY: -1, explicitSource: "wheel" },
      now + 10,
    );
    expect(decision.state.mode).toBe("forced-bottom");
    expect(decision.reasonCode).toBe("forced-ignored-noise-scroll");
  });

  it("pins on content grow while forced", () => {
    const now = 1_000;
    let state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: false,
      now,
    });
    state = reduceIntent(state, { type: "turn-settle" }, now).state;
    const m0 = metricsAtBottom(2000);
    state = reduceGeometry(
      state,
      observeDelta(state, { ...m0, kind: "observe" }),
      now + 20,
    ).state;

    const m1 = { scrollHeight: 3600, clientHeight: 720, scrollTop: 2000 - 720 };
    const decision = reduceGeometry(
      state,
      observeDelta(state, { ...m1, kind: "content-grow" }),
      now + 40,
    );
    expect(decision.state.mode).toBe("forced-bottom");
    expect(decision.requestBottomPin).toBe(true);
    expect(decision.reasonCode).toBe("post-settle-grow-while-forced");
  });

  it("retires forced to stick when stable at true bottom and follow on", () => {
    const now = 1_000;
    let state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: true,
      now,
    });
    state = reduceIntent(state, { type: "turn-settle" }, now).state;
    const m = metricsAtBottom(2400);
    // 最短保持内不得稳态退役（固定时刻，不越界 MIN_FORCED_HOLD=300）
    let t = now + 40;
    for (let i = 0; i < STABLE_HEIGHT_MIN_SAMPLES + 2; i += 1) {
      state = reduceGeometry(
        state,
        observeDelta(state, { ...m, kind: "observe" }),
        t,
      ).state;
      t += 20;
    }
    expect(t - now).toBeLessThan(MIN_FORCED_HOLD_MS);
    expect(state.mode).toBe("forced-bottom");

    t = now + MIN_FORCED_HOLD_MS + STABLE_HEIGHT_WINDOW_MS;
    for (let i = 0; i < STABLE_HEIGHT_MIN_SAMPLES + 4; i += 1) {
      const decision = reduceGeometry(
        state,
        observeDelta(state, { ...m, kind: "observe" }),
        t,
      );
      state = decision.state;
      if (decision.reasonCode === "forced-retired-stable") {
        expect(decision.state.mode).toBe("stick-bottom");
        return;
      }
      t += STABLE_HEIGHT_WINDOW_MS;
    }
    expect(state.mode).toBe("stick-bottom");
  });

  it("retires forced to free at true bottom when follow off", () => {
    const now = 1_000;
    let state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: false,
      now,
    });
    state = reduceIntent(state, { type: "turn-settle" }, now).state;
    const m = metricsAtBottom(1800);
    let t = now + MIN_FORCED_HOLD_MS + STABLE_HEIGHT_WINDOW_MS;
    for (let i = 0; i < 12; i += 1) {
      t += STABLE_HEIGHT_WINDOW_MS;
      const decision = reduceGeometry(
        state,
        observeDelta(state, { ...m, kind: "observe" }),
        t,
      );
      state = decision.state;
      if (state.mode === "free" && decision.reasonCode === "forced-retired-stable") {
        return;
      }
    }
    expect(state.mode).toBe("free");
  });

  it("holds forced during min hold even when geometry looks stable", () => {
    const now = 500;
    let state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: true,
      now,
    });
    state = reduceIntent(state, { type: "turn-settle" }, now).state;
    const m = metricsAtBottom(2000);
    let t = now;
    for (let i = 0; i < 10; i += 1) {
      t += STABLE_HEIGHT_WINDOW_MS;
      if (t - now >= MIN_FORCED_HOLD_MS) {
        break;
      }
      const decision = reduceGeometry(
        state,
        observeDelta(state, { ...m, kind: "observe" }),
        t,
      );
      state = decision.state;
      expect(state.mode).toBe("forced-bottom");
      expect(decision.reasonCode).not.toBe("forced-retired-stable");
    }
  });

  it("holds forced while finalizingPresentationActive even past min hold", () => {
    const now = 0;
    let state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: true,
      now,
    });
    state = reduceIntent(state, { type: "turn-settle" }, now).state;
    const m = metricsAtBottom(3000);
    // 超过 MIN_FORCED_HOLD 但仍在 finalizing
    let t = MIN_FORCED_HOLD_MS + STABLE_HEIGHT_WINDOW_MS * 3;
    for (let i = 0; i < STABLE_HEIGHT_MIN_SAMPLES + 3; i += 1) {
      const decision = reduceGeometry(
        state,
        observeDelta(state, {
          ...m,
          kind: "observe",
          finalizingPresentationActive: true,
        }),
        t,
      );
      state = decision.state;
      expect(state.mode).toBe("forced-bottom");
      expect(decision.reasonCode).not.toBe("forced-retired-stable");
      t += STABLE_HEIGHT_WINDOW_MS;
    }
    // finalizing 结束后可稳态退役
    t += STABLE_HEIGHT_WINDOW_MS;
    for (let i = 0; i < STABLE_HEIGHT_MIN_SAMPLES + 2; i += 1) {
      const decision = reduceGeometry(
        state,
        observeDelta(state, {
          ...m,
          kind: "observe",
          finalizingPresentationActive: false,
        }),
        t,
      );
      state = decision.state;
      if (decision.reasonCode === "forced-retired-stable") {
        expect(state.mode).toBe("stick-bottom");
        return;
      }
      t += STABLE_HEIGHT_WINDOW_MS;
    }
    expect(state.mode).toBe("stick-bottom");
  });

  it("MIN_FORCED_HOLD stays short; finalizing is held by geometry flag not time budget", () => {
    // 不再绑 Codex 6s；最短保持覆盖发送后首包布局，仍远短于旧 6s
    expect(MIN_FORCED_HOLD_MS).toBeLessThanOrEqual(1_000);
    expect(MIN_FORCED_HOLD_MS).toBeGreaterThanOrEqual(300);
    expect(SAFETY_TIMEOUT_FORCED_MS).toBeGreaterThanOrEqual(MIN_FORCED_HOLD_MS);
    expect(SAFETY_TIMEOUT_FORCED_MS).toBeLessThanOrEqual(5_000);
  });

  it("safety-timeout forces final pin and retires", () => {
    const now = 1_000;
    let state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: true,
      now,
    });
    state = reduceIntent(state, { type: "turn-settle" }, now).state;
    const m = {
      scrollHeight: 5000,
      clientHeight: 720,
      scrollTop: 100,
    };
    // one sample only — not stable
    state = reduceGeometry(
      state,
      observeDelta(state, { ...m, kind: "content-grow" }),
      now + 10,
    ).state;

    const decision = reduceGeometry(
      state,
      observeDelta(state, { ...m, kind: "observe" }),
      now + SAFETY_TIMEOUT_FORCED_MS + 1,
    );
    expect(decision.reasonCode).toBe("settle-timeout-short-of-bottom");
    expect(decision.requestBottomPin).toBe(true);
    expect(decision.state.mode).toBe("stick-bottom");
  });

  it("canRetireForced holds when not at bottom", () => {
    // now 须 < safetyTimeout（ticket@0 + 3000），且 ≥ min hold
    const now = 800;
    const state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: true,
      now: 0,
    });
    const withTicket = reduceIntent(state, { type: "turn-settle" }, 0).state;
    // stabilize height samples without being at bottom
    const geometry = {
      ...withTicket.geometry,
      lastScrollHeight: 3000,
      lastScrollHeightChangeAt: now - STABLE_HEIGHT_WINDOW_MS - 10,
      sameHeightSampleCount: STABLE_HEIGHT_MIN_SAMPLES + 1,
    };
    expect(
      canRetireForced({
        ticket: withTicket.ticket,
        geometry,
        scrollHeight: 3000,
        clientHeight: 720,
        scrollTop: 0,
        now,
      }),
    ).toBe("hold");
  });

  it("isGeometryStable requires phase match and no pending remeasure", () => {
    const now = 10_000;
    expect(
      isGeometryStable(
        {
          lastScrollHeight: 100,
          lastScrollHeightChangeAt: now - 200,
          sameHeightSampleCount: 5,
          pendingVirtualRemeasureCount: 1,
          phase: "static",
          phaseDesired: "static",
          pendingMediaLoads: 0,
          finalizingPresentationActive: false,
        },
        now,
      ),
    ).toBe(false);
  });

  it("ticket applied ring matches program echo", () => {
    const ticket = reduceIntent(
      createInitialScrollAuthorityState({ liveAutoFollowEnabled: true, now: 0 }),
      { type: "turn-send" },
      0,
    ).state.ticket!;
    const withApplied = recordTicketAppliedScrollTop(ticket, 1680);
    expect(ticketMatchesAppliedScrollTop(withApplied, 1680, 0)).toBe(true);
    expect(ticketMatchesAppliedScrollTop(withApplied, 100, 0)).toBe(false);
  });

  it("browserClampProven requires shrink + overflow + clamp land", () => {
    expect(
      browserClampProven(
        { maxScrollTop: 5000, scrollTop: 4800 },
        { maxScrollTop: 1000, scrollTop: 1000 },
      ),
    ).toBe(true);
    expect(
      browserClampProven(
        { maxScrollTop: 1000, scrollTop: 500 },
        { maxScrollTop: 2000, scrollTop: 500 },
      ),
    ).toBe(false);
  });

  it("reduceFrame applies geometry before intents", () => {
    const now = 100;
    const state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: true,
      now,
    });
    const m = metricsAtBottom(1000);
    const decision = reduceFrame({
      state,
      geometries: [observeDelta(state, { ...m, kind: "observe" })],
      intents: [{ type: "turn-settle" }],
      now: now + 1,
    });
    expect(decision.state.mode).toBe("forced-bottom");
    expect(decision.requestBottomPin).toBe(true);
  });

  it("isExplicitUpwardUserScroll treats key as explicit", () => {
    expect(
      isExplicitUpwardUserScroll({
        explicitSource: "key",
        accumUpPx: 0,
        accumUpWindowStartedAt: null,
        now: 0,
      }).explicit,
    ).toBe(true);
  });

  it("turn-send enters forced and is independent of live auto-follow preference", () => {
    const now = 50;
    const state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: false,
      now,
    });
    const decision = reduceIntent(state, { type: "turn-send" }, now);
    expect(decision.state.mode).toBe("forced-bottom");
    expect(decision.requestBottomPin).toBe(true);
    expect(decision.state.liveAutoFollowEnabled).toBe(false);
  });

  it("keeps forced through micro noise then grows still requests pin", () => {
    const now = 100;
    let state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: true,
      now,
    });
    state = reduceIntent(state, { type: "turn-settle" }, now).state;
    state = reduceIntent(
      state,
      { type: "user-scroll", deltaY: -1, explicitSource: "wheel" },
      now + 1,
    ).state;
    expect(state.mode).toBe("forced-bottom");

    const m0 = metricsAtBottom(2000);
    state = reduceGeometry(
      state,
      observeDelta(state, { ...m0, kind: "observe" }),
      now + 2,
    ).state;
    const decision = reduceGeometry(
      state,
      observeDelta(state, {
        scrollHeight: 4000,
        clientHeight: 720,
        scrollTop: 2000 - 720,
        kind: "measure-late",
      }),
      now + 3,
    );
    expect(decision.state.mode).toBe("forced-bottom");
    expect(decision.requestBottomPin).toBe(true);
  });

  it("focus-follow-off during forced keeps forced mode", () => {
    const now = 10;
    let state = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: true,
      now,
    });
    state = reduceIntent(state, { type: "turn-settle" }, now).state;
    const decision = reduceIntent(state, { type: "focus-follow-off" }, now + 1);
    expect(decision.state.mode).toBe("forced-bottom");
    expect(decision.state.liveAutoFollowEnabled).toBe(false);
  });

  it("shouldContinuousPin only for forced and stick", () => {
    expect(shouldContinuousPin("forced-bottom")).toBe(true);
    expect(shouldContinuousPin("stick-bottom")).toBe(true);
    expect(shouldContinuousPin("free")).toBe(false);
    expect(shouldContinuousPin("jump-anchor")).toBe(false);
  });
});
