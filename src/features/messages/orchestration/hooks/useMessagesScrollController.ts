import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type MutableRefObject,
} from "react";
import {
  SETTLE_REPIN_WINDOW_MS,
} from "../../constants/messagesConstants";
import { isEditableShortcutTarget } from "../../../../utils/shortcuts";
import { SCROLL_THRESHOLD_PX } from "../../utils/messagesRenderUtils";
import { isMessagesScrollNearBottom } from "../presentation/messagesViewModel";
import {
  resolveConversationScrollEdgeTarget,
  startConversationScrollConvergence,
  type ConversationScrollEdge,
  type ConversationScrollMotion,
} from "../scrolling/messagesScrollConvergence";
import {
  createInitialScrollAuthorityState,
  isAtTrueBottom,
  reduceGeometry,
  reduceIntent,
  shouldContinuousPin,
} from "../scrolling/scrollAuthorityMachine";
import type { ScrollAuthorityState } from "../scrolling/scrollAuthorityTypes";
import { recordTicketAppliedScrollTop } from "../scrolling/scrollWriteTicket";
import {
  isRecentUserScrollIntent,
  isScrollIntentKey,
  PROGRAMMATIC_SCROLL_ECHO_TOLERANCE_PX,
  readScrollGeometrySnapshot,
  recordProgrammaticScrollFingerprint,
  resolveClampedScrollTop,
  type ProgrammaticScrollFingerprint,
  type ScrollGeometrySnapshot,
} from "../scrolling/messagesScrollEcho";

/**
 * live-follow：无定时 recheck，只靠 ResizeObserver（避免幽灵拽底）。
 * turn-send / turn-settle / history-open：短 recheck 盖住乐观气泡与首包测高，
 * 解决「第二次发送不回底 / 工具折叠后卡住中部」——长延迟数组已砍。
 */
const LIVE_FOLLOW_RECHECK_DELAYS_MS = [] as const;
const TURN_BOUNDARY_RECHECK_DELAYS_MS = [80, 250, 700] as const;
const PROGRAMMATIC_SCROLL_ECHO_LIMIT = 32;
/** 与 convergence 模块同阈值：已在目标边 ±1px 视为到位，避免无意义二次写。 */
const ACTIVE_CONVERGENCE_EDGE_TOLERANCE_PX = 1;
/** 拖条离底时合成 user-scroll intent 的 delta（须 ≥ USER_SCROLL_MIN_DELTA_Y） */
const USER_SCROLL_RELEASE_DELTA_Y = 16;

type ConversationScrollIntent =
  | "history-open"
  | "live-follow"
  | "turn-send"
  | "turn-settle"
  | "explicit-control";

/**
 * 权威回底原因：与 ScrollControl「回到底部」共用同一 pin 通道。
 * - explicit：按钮（smooth）
 * - turn-send / turn-settle：回合边界（instant + forced）
 * - history-open：打开会话
 * - history-restore：尾窗回全量 / 虚拟化 handoff 后的二次贴底（instant + 再入 forced）
 * - focus-rearm：焦点跟随重新打开
 */
type PinCanvasToBottomReason =
  | "explicit"
  | "turn-send"
  | "turn-settle"
  | "history-open"
  | "history-restore"
  | "focus-rearm";

function isFocusFollowScrollIntent(intent: ConversationScrollIntent | null) {
  return intent === "live-follow";
}

function isTurnBoundaryScrollIntent(intent: ConversationScrollIntent | null) {
  return intent === "turn-send" || intent === "turn-settle";
}

type UseMessagesScrollControllerInput = {
  clearPendingJumpMessage: () => void;
  isThinking: boolean;
  /**
   * Claude/Codex finalizing 窗（Claude 320ms / Codex 6s；Grok 等为 false）：
   * staged MD、file-change、测高等会继续改高度。挡住假稳退役，起止再 pin。
   */
  isAssistantFinalizing?: boolean;
  liveAutoFollowEnabledRef: MutableRefObject<boolean>;
  rawScrollKey: string;
  renderScopeKey: string;
};

export function useMessagesScrollController({
  clearPendingJumpMessage,
  isThinking,
  isAssistantFinalizing = false,
  liveAutoFollowEnabledRef,
  rawScrollKey,
  renderScopeKey,
}: UseMessagesScrollControllerInput) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomDeadlineRef = useRef(0);
  const stickToBottomIntentRef = useRef<
    "history-open" | "turn-send" | "turn-settle" | null
  >(null);
  const autoScrollRef = useRef(true);
  const activeScrollConvergenceCancelRef = useRef<(() => void) | null>(null);
  const activeProgrammaticScrollEdgeRef = useRef<ConversationScrollEdge | null>(null);
  const activeProgrammaticScrollMotionRef = useRef<ConversationScrollMotion | null>(null);
  const activeScrollIntentRef = useRef<ConversationScrollIntent | null>(null);
  const programmaticScrollTopEchoRef = useRef<ProgrammaticScrollFingerprint[]>([]);
  const lastUserScrollIntentAtRef = useRef<number | null>(null);
  const scrollGeometrySnapshotRef = useRef<ScrollGeometrySnapshot | null>(null);
  const initialBottomPinScopeRef = useRef<string | null>(null);
  const [scrollKey, setScrollKey] = useState(rawScrollKey);
  const [, startScrollKeyTransition] = useTransition();
  const scrollThrottleRef = useRef<number>(0);
  const liveFollowCoalesceRafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  /** Scroll Ownership 权威状态（纯机）；与 legacy deadline/autoScroll 双跑一期 */
  const scrollAuthorityRef = useRef<ScrollAuthorityState>(
    createInitialScrollAuthorityState({
      liveAutoFollowEnabled: liveAutoFollowEnabledRef.current,
      now: typeof performance !== "undefined" ? performance.now() : Date.now(),
    }),
  );
  const scopeGenerationRef = useRef(0);
  const previousAssistantFinalizingRef = useRef(isAssistantFinalizing);
  const isAssistantFinalizingRef = useRef(isAssistantFinalizing);
  isAssistantFinalizingRef.current = isAssistantFinalizing;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (liveFollowCoalesceRafRef.current !== null) {
        window.cancelAnimationFrame(liveFollowCoalesceRafRef.current);
        liveFollowCoalesceRafRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (scrollThrottleRef.current) {
      window.clearTimeout(scrollThrottleRef.current);
    }
    scrollThrottleRef.current = window.setTimeout(() => {
      if (!mountedRef.current || typeof window === "undefined") {
        return;
      }
      startScrollKeyTransition(() => {
        setScrollKey((current) => (current === rawScrollKey ? current : rawScrollKey));
      });
    }, isThinking ? 120 : 0);
    return () => {
      if (scrollThrottleRef.current) {
        window.clearTimeout(scrollThrottleRef.current);
      }
    };
  }, [isThinking, rawScrollKey, startScrollKeyTransition]);

  const isNearBottom = useCallback(
    (node: HTMLDivElement) => isMessagesScrollNearBottom(node, SCROLL_THRESHOLD_PX),
    [],
  );
  const hasRecentUserScrollIntent = useCallback(
    () =>
      isRecentUserScrollIntent(
        lastUserScrollIntentAtRef.current,
        performance.now(),
      ),
    [],
  );
  const clearUserScrollIntent = useCallback(() => {
    lastUserScrollIntentAtRef.current = null;
  }, []);
  const recordCurrentScrollGeometry = useCallback((container: HTMLDivElement) => {
    scrollGeometrySnapshotRef.current = readScrollGeometrySnapshot(container);
  }, []);
  const recordProgrammaticScrollEcho = useCallback(
    (fingerprint: ProgrammaticScrollFingerprint) => {
      recordProgrammaticScrollFingerprint(
        programmaticScrollTopEchoRef.current,
        fingerprint,
        PROGRAMMATIC_SCROLL_ECHO_LIMIT,
      );
    },
    [],
  );
  const cancelLiveFollowCoalesce = useCallback(() => {
    if (liveFollowCoalesceRafRef.current !== null) {
      window.cancelAnimationFrame(liveFollowCoalesceRafRef.current);
      liveFollowCoalesceRafRef.current = null;
    }
  }, []);
  const cancelScrollConvergence = useCallback(() => {
    cancelLiveFollowCoalesce();
    activeScrollConvergenceCancelRef.current?.();
    activeScrollConvergenceCancelRef.current = null;
    activeProgrammaticScrollEdgeRef.current = null;
    activeProgrammaticScrollMotionRef.current = null;
    activeScrollIntentRef.current = null;
  }, [cancelLiveFollowCoalesce]);
  const cancelFocusFollowConvergence = useCallback(() => {
    cancelLiveFollowCoalesce();
    if (isFocusFollowScrollIntent(activeScrollIntentRef.current)) {
      // 只清 live-follow owner；不要走 cancelScrollConvergence 以免误清非 follow 的 coalesce 语义外的状态。
      activeScrollConvergenceCancelRef.current?.();
      activeScrollConvergenceCancelRef.current = null;
      activeProgrammaticScrollEdgeRef.current = null;
      activeProgrammaticScrollMotionRef.current = null;
      activeScrollIntentRef.current = null;
    }
  }, [cancelLiveFollowCoalesce]);
  const requestScrollConvergence = useCallback(
    (
      edge: ConversationScrollEdge,
      motion: ConversationScrollMotion,
      intent: ConversationScrollIntent,
      options?: {
        recheckDelaysMs?: readonly number[];
        shouldContinue?: () => boolean;
      },
    ) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      if (
        intent !== "explicit-control" &&
        !isTurnBoundaryScrollIntent(intent) &&
        activeScrollIntentRef.current === "explicit-control" &&
        activeProgrammaticScrollMotionRef.current === "smooth"
      ) {
        return;
      }
      // shouldContinue 可能在首个同步 frame 就失败（例如 user-intent lease 已建立）。
      // start 后再失败会让同步 onComplete 早于 cancel handle 赋值，留下 stale owner。
      if (options?.shouldContinue && !options.shouldContinue()) {
        return;
      }
      const isSameActiveRun =
        activeScrollConvergenceCancelRef.current !== null &&
        activeScrollIntentRef.current === intent &&
        activeProgrammaticScrollEdgeRef.current === edge &&
        activeProgrammaticScrollMotionRef.current === motion;
      if (isSameActiveRun) {
        // 已在追同一条 edge：禁止 cancel/restart。
        // 快速流式下每次 delta/Resize 若都拆掉 recheck 并新建 pulse，会同步连写 scrollTop → 幕布抖。
        // active rAF 每帧会重读 target；recheck 间隙用 instant 单次 nudge 补高度增长。
        if (motion === "instant") {
          const target = resolveConversationScrollEdgeTarget(container, edge);
          const observedScrollTop = container.scrollTop;
          if (
            Math.abs(target - observedScrollTop) > ACTIVE_CONVERGENCE_EDGE_TOLERANCE_PX
          ) {
            container.scrollTop = target;
            if (container.scrollTop !== observedScrollTop) {
              recordProgrammaticScrollEcho({
                recordedAt: performance.now(),
                scrollTop: container.scrollTop,
                source: "write",
              });
            }
          }
        }
        return;
      }
      cancelScrollConvergence();
      activeProgrammaticScrollEdgeRef.current = edge;
      activeProgrammaticScrollMotionRef.current = motion;
      activeScrollIntentRef.current = intent;
      let cancelCurrentRun: (() => void) | null = null;
      cancelCurrentRun = startConversationScrollConvergence(container, {
        edge,
        motion,
        recheckDelaysMs: options?.recheckDelaysMs,
        shouldContinue: options?.shouldContinue,
        onFrameObservation: (observedScrollTop, appliedScrollTop) => {
          if (appliedScrollTop === observedScrollTop) {
            return;
          }
          recordProgrammaticScrollEcho({
            recordedAt: performance.now(),
            scrollTop: appliedScrollTop,
            source: "write",
          });
          const authority = scrollAuthorityRef.current;
          if (authority.ticket) {
            scrollAuthorityRef.current = {
              ...authority,
              ticket: recordTicketAppliedScrollTop(authority.ticket, appliedScrollTop),
            };
          }
        },
        onComplete: () => {
          if (activeScrollConvergenceCancelRef.current !== cancelCurrentRun) {
            return;
          }
          activeScrollConvergenceCancelRef.current = null;
          activeProgrammaticScrollEdgeRef.current = null;
          activeProgrammaticScrollMotionRef.current = null;
          activeScrollIntentRef.current = null;
        },
      });
      activeScrollConvergenceCancelRef.current = cancelCurrentRun;
    },
    [cancelScrollConvergence, recordProgrammaticScrollEcho],
  );

  useLayoutEffect(() => {
    cancelScrollConvergence();
    initialBottomPinScopeRef.current = null;
    autoScrollRef.current = true;
    // fingerprint 属于 render scope；旧会话位置不得被新会话 write 重新续活。
    programmaticScrollTopEchoRef.current = [];
    lastUserScrollIntentAtRef.current = null;
    scrollGeometrySnapshotRef.current = null;
    stickToBottomDeadlineRef.current = 0;
    stickToBottomIntentRef.current = null;
    scopeGenerationRef.current += 1;
    scrollAuthorityRef.current = createInitialScrollAuthorityState({
      liveAutoFollowEnabled: liveAutoFollowEnabledRef.current,
      scopeGeneration: scopeGenerationRef.current,
      now: performance.now(),
    });
  }, [cancelScrollConvergence, liveAutoFollowEnabledRef, renderScopeKey]);
  useEffect(() => cancelScrollConvergence, [cancelScrollConvergence]);

  // 焦点跟随 stick-to-bottom：仅 mode∈{stick-bottom, forced-bottom} 可 continuous pin。
  // forced 不依赖 autoScroll：内容长高假离底不得掐死发送/settle 强制追底。
  // 全砍：禁止 free+autoScroll 旁路追底。
  const canContinueFocusFollowStick = useCallback(() => {
    if (hasRecentUserScrollIntent()) {
      return false;
    }
    const authorityMode = scrollAuthorityRef.current.mode;
    if (authorityMode === "forced-bottom") {
      return true;
    }
    if (!autoScrollRef.current) {
      return false;
    }
    if (!liveAutoFollowEnabledRef.current) {
      return false;
    }
    return shouldContinuousPin(authorityMode);
  }, [hasRecentUserScrollIntent, liveAutoFollowEnabledRef]);
  const flushLiveFollowStick = useCallback(() => {
    if (!canContinueFocusFollowStick() || !containerRef.current) {
      return;
    }
    requestScrollConvergence("bottom", "instant", "live-follow", {
      recheckDelaysMs: LIVE_FOLLOW_RECHECK_DELAYS_MS,
      shouldContinue: canContinueFocusFollowStick,
    });
  }, [canContinueFocusFollowStick, requestScrollConvergence]);
  // 同帧内 scrollKey + ResizeObserver + 工具块 onRequestAutoScroll 会连打；合并到下一帧
  // 再落位，避免同一布局周期多次 cancel/restart。
  const requestAutoScroll = useCallback(() => {
    if (!canContinueFocusFollowStick() || !containerRef.current) {
      return;
    }
    if (typeof window === "undefined") {
      flushLiveFollowStick();
      return;
    }
    if (liveFollowCoalesceRafRef.current !== null) {
      return;
    }
    liveFollowCoalesceRafRef.current = window.requestAnimationFrame(() => {
      liveFollowCoalesceRafRef.current = null;
      flushLiveFollowStick();
    });
  }, [canContinueFocusFollowStick, flushLiveFollowStick]);
  /**
   * 权威回底原语（与 ScrollControl「回到底部」同一通道）。
   * 全砍：history-restore 不再清 user intent / 不再无条件再入 forced；
   * 仅 forced 或已武装 stick 时 nudge，避免读历史被二次拽回。
   */
  const pinCanvasToBottom = useCallback(
    (reason: PinCanvasToBottomReason, motionOverride?: ConversationScrollMotion) => {
      const now = performance.now();
      const motion: ConversationScrollMotion =
        motionOverride ?? (reason === "explicit" ? "smooth" : "instant");
      const armDeadline = () => {
        stickToBottomDeadlineRef.current = Date.now() + SETTLE_REPIN_WINDOW_MS;
      };
      const liveFollow = liveAutoFollowEnabledRef.current;

      // history-restore：布局迟到（尾窗回全量 / 虚拟化 handoff / finalizing 结束）。
      // 不 clearUserScrollIntent；用户已 free 则完全停手；已 stick/forced 只 nudge。
      if (reason === "history-restore") {
        if (hasRecentUserScrollIntent()) {
          return;
        }
        const mode = scrollAuthorityRef.current.mode;
        if (mode === "free" || mode === "history-head" || mode === "jump-anchor") {
          if (!autoScrollRef.current) {
            return;
          }
          // autoScroll 仍 true 但 mode 已 free：只在真 stick 语义下回 stick，不 forced
          if (!liveFollow) {
            return;
          }
          const rearm = reduceIntent(
            {
              ...scrollAuthorityRef.current,
              liveAutoFollowEnabled: true,
            },
            { type: "focus-follow-on" },
            now,
          );
          scrollAuthorityRef.current = rearm.state;
          requestScrollConvergence("bottom", motion, "live-follow", {
            recheckDelaysMs: LIVE_FOLLOW_RECHECK_DELAYS_MS,
            shouldContinue: () =>
              autoScrollRef.current &&
              !hasRecentUserScrollIntent() &&
              liveAutoFollowEnabledRef.current &&
              shouldContinuousPin(scrollAuthorityRef.current.mode),
          });
          return;
        }
        if (mode === "forced-bottom") {
          const keepTurn: "turn-send" | "turn-settle" =
            stickToBottomIntentRef.current === "turn-send" ? "turn-send" : "turn-settle";
          requestScrollConvergence("bottom", motion, keepTurn, {
            recheckDelaysMs: TURN_BOUNDARY_RECHECK_DELAYS_MS,
            shouldContinue: () =>
              !hasRecentUserScrollIntent() &&
              scrollAuthorityRef.current.mode === "forced-bottom",
          });
          return;
        }
        // stick-bottom：只 nudge，不再入 forced
        requestScrollConvergence("bottom", motion, "live-follow", {
          recheckDelaysMs: LIVE_FOLLOW_RECHECK_DELAYS_MS,
          shouldContinue: () =>
            autoScrollRef.current &&
            !hasRecentUserScrollIntent() &&
            liveAutoFollowEnabledRef.current &&
            shouldContinuousPin(scrollAuthorityRef.current.mode),
        });
        return;
      }

      // 发送 / settle / 打开会话 / 按钮 / 焦点 rearm：清干扰 + 武装跟随 + 清 jump
      clearUserScrollIntent();
      autoScrollRef.current = true;
      clearPendingJumpMessage();
      cancelLiveFollowCoalesce();

      let convergenceIntent: ConversationScrollIntent = "explicit-control";

      if (reason === "explicit") {
        // 按钮：explicit-bottom 武装 stick；短 forced 仅用于 RO 追当帧迟到测高（不再绑 6s）
        let decision = reduceIntent(
          {
            ...scrollAuthorityRef.current,
            liveAutoFollowEnabled: liveFollow,
          },
          { type: "explicit-bottom" },
          now,
        );
        decision = reduceIntent(
          {
            ...decision.state,
            liveAutoFollowEnabled: liveFollow,
          },
          { type: "turn-settle" },
          now,
        );
        scrollAuthorityRef.current = decision.state;
        stickToBottomIntentRef.current = "turn-settle";
        armDeadline();
        convergenceIntent = "explicit-control";
      } else if (reason === "turn-send" || reason === "turn-settle") {
        stickToBottomIntentRef.current = reason;
        armDeadline();
        const decision = reduceIntent(
          {
            ...scrollAuthorityRef.current,
            liveAutoFollowEnabled: liveFollow,
          },
          { type: reason },
          now,
        );
        scrollAuthorityRef.current = decision.state;
        convergenceIntent = reason;
      } else if (reason === "history-open") {
        stickToBottomIntentRef.current = "history-open";
        armDeadline();
        const decision = reduceIntent(
          {
            ...scrollAuthorityRef.current,
            liveAutoFollowEnabled: liveFollow,
          },
          { type: "open-thread" },
          now,
        );
        scrollAuthorityRef.current = decision.state;
        convergenceIntent = "history-open";
      } else {
        // focus-rearm
        const decision = reduceIntent(
          {
            ...scrollAuthorityRef.current,
            liveAutoFollowEnabled: true,
          },
          { type: "focus-follow-on" },
          now,
        );
        scrollAuthorityRef.current = decision.state;
        convergenceIntent = "live-follow";
      }

      const pinnedConvergenceIntent = convergenceIntent;
      const isTurnOrHistoryBoundary =
        pinnedConvergenceIntent === "turn-send" ||
        pinnedConvergenceIntent === "turn-settle" ||
        pinnedConvergenceIntent === "history-open" ||
        pinnedConvergenceIntent === "explicit-control";
      requestScrollConvergence("bottom", motion, pinnedConvergenceIntent, {
        recheckDelaysMs: isTurnOrHistoryBoundary
          ? TURN_BOUNDARY_RECHECK_DELAYS_MS
          : LIVE_FOLLOW_RECHECK_DELAYS_MS,
        shouldContinue: () => {
          // 用户明确上滚：立刻停。forced 期间不得被「假离底」的 autoScroll=false 掐死。
          if (hasRecentUserScrollIntent()) {
            return false;
          }
          if (scrollAuthorityRef.current.mode === "forced-bottom") {
            return true;
          }
          if (!autoScrollRef.current) {
            return false;
          }
          if (pinnedConvergenceIntent === "explicit-control") {
            return shouldContinuousPin(scrollAuthorityRef.current.mode);
          }
          if (pinnedConvergenceIntent === "live-follow") {
            return (
              liveAutoFollowEnabledRef.current &&
              shouldContinuousPin(scrollAuthorityRef.current.mode)
            );
          }
          if (shouldContinuousPin(scrollAuthorityRef.current.mode)) {
            return true;
          }
          return (
            pinnedConvergenceIntent === "history-open" &&
            Date.now() <= stickToBottomDeadlineRef.current
          );
        },
      });
    },
    [
      cancelLiveFollowCoalesce,
      clearPendingJumpMessage,
      clearUserScrollIntent,
      hasRecentUserScrollIntent,
      liveAutoFollowEnabledRef,
      requestScrollConvergence,
    ],
  );

  const rearmAutoFollowToBottom = useCallback(() => {
    pinCanvasToBottom("focus-rearm", "instant");
  }, [pinCanvasToBottom]);

  /**
   * scroll 事件到达真底：武装 autoScroll，并把 free → stick（不写 scrollTop，仅状态）。
   * 与「120 近底 re-arm」切割：调用方必须先确认 distance ≤ 1px。
   */
  const noteViewportAtTrueBottom = useCallback(() => {
    autoScrollRef.current = true;
    if (!liveAutoFollowEnabledRef.current) {
      return;
    }
    if (shouldContinuousPin(scrollAuthorityRef.current.mode)) {
      return;
    }
    if (scrollAuthorityRef.current.mode === "forced-bottom") {
      return;
    }
    const now = performance.now();
    const decision = reduceIntent(
      {
        ...scrollAuthorityRef.current,
        liveAutoFollowEnabled: true,
      },
      { type: "focus-follow-on" },
      now,
    );
    // focus-follow-on 会 requestBottomPin；此处只同步 mode，不立刻 pin
    // （避免 scroll 回调里二次写顶；后续 RO / scrollKey 自然追）
    scrollAuthorityRef.current = {
      ...decision.state,
      // 保持 stick；清掉可能被 focus-follow-on 带上的 forced 语义（它本身是 stick）
    };
  }, [liveAutoFollowEnabledRef]);

  /**
   * 用户离底（拖条 / 上滚后 scroll 确认）：解除 autoScroll；
   * stick → free。forced 仅由 wheel 路径打断，避免内容假离底误杀 forced。
   */
  const noteViewportLeftBottom = useCallback(() => {
    autoScrollRef.current = false;
    stickToBottomIntentRef.current = null;
    stickToBottomDeadlineRef.current = 0;
    const mode = scrollAuthorityRef.current.mode;
    if (mode !== "stick-bottom" && mode !== "forced-bottom") {
      return;
    }
    const now = performance.now();
    const decision = reduceIntent(
      {
        ...scrollAuthorityRef.current,
        liveAutoFollowEnabled: liveAutoFollowEnabledRef.current,
      },
      { type: "user-scroll", deltaY: -USER_SCROLL_RELEASE_DELTA_Y },
      now,
    );
    scrollAuthorityRef.current = decision.state;
  }, [liveAutoFollowEnabledRef]);

  const requestHistoryBottomConvergence = useCallback(() => {
    pinCanvasToBottom("history-open", "instant");
  }, [pinCanvasToBottom]);

  /**
   * 已武装时继续追底（Resize / recheck 路径）。
   * 不得 clearUserScrollIntent / 不得完整 re-arm，否则会吞掉用户上滚。
   */
  const continueBottomPinIfArmed = useCallback(() => {
    if (hasRecentUserScrollIntent()) {
      return;
    }
    // forced：不依赖 autoScroll（内容长高假离底不得掐死发送/settle）
    if (scrollAuthorityRef.current.mode === "forced-bottom") {
      const intent =
        stickToBottomIntentRef.current === "turn-send" ? "turn-send" : "turn-settle";
      requestScrollConvergence("bottom", "instant", intent, {
        recheckDelaysMs: TURN_BOUNDARY_RECHECK_DELAYS_MS,
        shouldContinue: () =>
          !hasRecentUserScrollIntent() &&
          scrollAuthorityRef.current.mode === "forced-bottom",
      });
      return;
    }
    if (!autoScrollRef.current) {
      return;
    }
    const boundary = stickToBottomIntentRef.current;
    const boundaryActive =
      isTurnBoundaryScrollIntent(boundary) &&
      Date.now() <= stickToBottomDeadlineRef.current;
    if (boundaryActive) {
      const intent =
        isTurnBoundaryScrollIntent(boundary) && boundary
          ? boundary
          : "turn-settle";
      requestScrollConvergence("bottom", "instant", intent, {
        recheckDelaysMs: TURN_BOUNDARY_RECHECK_DELAYS_MS,
        shouldContinue: () => {
          if (hasRecentUserScrollIntent() || !autoScrollRef.current) {
            return false;
          }
          if (scrollAuthorityRef.current.mode === "forced-bottom") {
            return true;
          }
          return (
            isTurnBoundaryScrollIntent(stickToBottomIntentRef.current) &&
            Date.now() <= stickToBottomDeadlineRef.current
          );
        },
      });
      return;
    }
    // turn 边界意图的 settle 死线已过：清掉残留意图。否则旧逻辑会让该分支永真、
    // shouldContinue 永假，下面的 live-follow 通道被永久短路——回合结束后
    // 容器收缩 / 迟到测高（虚拟化回填、Markdown 全量渲染）将再也无人追底。
    if (isTurnBoundaryScrollIntent(boundary)) {
      stickToBottomIntentRef.current = null;
    }
    if (liveAutoFollowEnabledRef.current) {
      flushLiveFollowStick();
    } else if (
      stickToBottomIntentRef.current === "history-open" &&
      Date.now() <= stickToBottomDeadlineRef.current
    ) {
      requestScrollConvergence("bottom", "instant", "history-open", {
        recheckDelaysMs: TURN_BOUNDARY_RECHECK_DELAYS_MS,
        shouldContinue: () =>
          autoScrollRef.current &&
          !hasRecentUserScrollIntent() &&
          Date.now() <= stickToBottomDeadlineRef.current,
      });
    }
  }, [
    flushLiveFollowStick,
    hasRecentUserScrollIntent,
    liveAutoFollowEnabledRef,
    requestScrollConvergence,
  ]);

  const requestTimelineLayoutBottomConvergence = useCallback(() => {
    // 虚拟化/static handoff、尾窗回全量：仅 forced 或仍 armed 时 nudge。
    // 禁止「deadline 还在 + 用户已 free」旁路强 pin（读历史被二次拽回 / 测试卡中部）。
    if (hasRecentUserScrollIntent()) {
      return;
    }
    const forced = scrollAuthorityRef.current.mode === "forced-bottom";
    if (!forced && !autoScrollRef.current) {
      return;
    }
    pinCanvasToBottom("history-restore", "instant");
  }, [hasRecentUserScrollIntent, pinCanvasToBottom]);

  const beginTurnBoundaryBottomConvergence = useCallback(
    (intent: "turn-send" | "turn-settle") => {
      pinCanvasToBottom(intent, "instant");
    },
    [pinCanvasToBottom],
  );

  // Claude/Codex finalizing 生命周期（共用钩子，非引擎 if 分叉 pin 实现）：
  // - 开始：标 finalizingPresentationActive + turn-settle pin（再入 forced）
  // - 进行中：保持 flag，canRetireForced 禁止稳态退役
  // - 结束：清 flag + history-restore pin（与回到底部同通道）
  useLayoutEffect(() => {
    const wasFinalizing = previousAssistantFinalizingRef.current;
    previousAssistantFinalizingRef.current = isAssistantFinalizing;
    const now = performance.now();
    if (wasFinalizing && !isAssistantFinalizing) {
      scrollAuthorityRef.current = {
        ...scrollAuthorityRef.current,
        geometry: {
          ...scrollAuthorityRef.current.geometry,
          finalizingPresentationActive: false,
          lastScrollHeightChangeAt: now,
          sameHeightSampleCount: 0,
        },
      };
      pinCanvasToBottom("history-restore", "instant");
      return;
    }
    if (!wasFinalizing && isAssistantFinalizing) {
      scrollAuthorityRef.current = {
        ...scrollAuthorityRef.current,
        geometry: {
          ...scrollAuthorityRef.current.geometry,
          finalizingPresentationActive: true,
          lastScrollHeightChangeAt: now,
          sameHeightSampleCount: 0,
        },
      };
      pinCanvasToBottom("turn-settle", "instant");
      return;
    }
    if (isAssistantFinalizing) {
      scrollAuthorityRef.current = {
        ...scrollAuthorityRef.current,
        geometry: {
          ...scrollAuthorityRef.current.geometry,
          finalizingPresentationActive: true,
        },
      };
    }
  }, [isAssistantFinalizing, pinCanvasToBottom]);

  // 内容高度与输入事件共同决定 follow ownership。所有 listener/observer 由 controller
  // 持有，避免 component 再维护第二套 convergence side effect。
  useEffect(() => {
    const container = containerRef.current;
    const content = container?.querySelector<HTMLElement>(".messages-timeline-root");
    if (!container) {
      return undefined;
    }
    let activePointerId: number | null = null;
    let pointerInside = container.matches(":hover");
    const markUserScrollIntent = () => {
      lastUserScrollIntentAtRef.current = performance.now();
      cancelScrollConvergence();
    };
    /** 用户明确离底：解除 armed、清 turn 边界死线，禁止 deadline 旁路再 pin */
    const releaseFollowForUserScroll = () => {
      markUserScrollIntent();
      autoScrollRef.current = false;
      stickToBottomIntentRef.current = null;
      stickToBottomDeadlineRef.current = 0;
    };
    const applyAuthorityUserScroll = (
      partial: {
        deltaY?: number;
        explicitSource?: "wheel" | "key" | "touch" | "pointer";
      },
    ) => {
      const now = performance.now();
      const decision = reduceIntent(
        {
          ...scrollAuthorityRef.current,
          liveAutoFollowEnabled: liveAutoFollowEnabledRef.current,
        },
        {
          type: "user-scroll",
          deltaY: partial.deltaY,
          explicitSource: partial.explicitSource,
        },
        now,
      );
      scrollAuthorityRef.current = decision.state;
      if (decision.reasonCode === "forced-interrupted-by-user-scroll") {
        releaseFollowForUserScroll();
        return;
      }
      if (decision.reasonCode === "forced-ignored-noise-scroll") {
        // forced 期内噪声：不解除 autoScroll、不 cancel（§3.4.1）
        return;
      }
      if (partial.deltaY !== undefined && partial.deltaY < 0) {
        releaseFollowForUserScroll();
        return;
      }
      if (partial.explicitSource && partial.explicitSource !== "wheel") {
        // key/touch/pointer：先记租约；是否离底由后续 scroll 几何判定
        markUserScrollIntent();
      }
    };
    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) {
        return;
      }
      applyAuthorityUserScroll({
        deltaY: event.deltaY,
        explicitSource: "wheel",
      });
    };
    const handleTouchIntent = () => {
      applyAuthorityUserScroll({ explicitSource: "touch" });
    };
    const handlePointerEnter = () => {
      pointerInside = true;
    };
    const handlePointerLeave = () => {
      pointerInside = false;
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.target !== container) {
        return;
      }
      activePointerId = event.pointerId;
      applyAuthorityUserScroll({ explicitSource: "pointer" });
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId === activePointerId) {
        applyAuthorityUserScroll({ explicitSource: "pointer" });
      }
    };
    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId === activePointerId) {
        activePointerId = null;
      }
    };
    const handleScrollKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        !isScrollIntentKey(event.key) ||
        isEditableShortcutTarget(event.target) ||
        isEditableShortcutTarget(document.activeElement)
      ) {
        return;
      }
      const eventTargetInside =
        event.target instanceof Node && container.contains(event.target);
      const activeElementInside =
        document.activeElement instanceof Node &&
        container.contains(document.activeElement);
      if (!eventTargetInside && !activeElementInside && !pointerInside) {
        return;
      }
      applyAuthorityUserScroll({ explicitSource: "key" });
    };
    const removeInputListeners = () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchIntent);
      container.removeEventListener("touchmove", handleTouchIntent);
      container.removeEventListener("pointerenter", handlePointerEnter);
      container.removeEventListener("pointerleave", handlePointerLeave);
      container.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("keydown", handleScrollKey);
      activePointerId = null;
    };
    container.addEventListener("wheel", handleWheel, { passive: true });
    container.addEventListener("touchstart", handleTouchIntent, { passive: true });
    container.addEventListener("touchmove", handleTouchIntent, { passive: true });
    container.addEventListener("pointerenter", handlePointerEnter);
    container.addEventListener("pointerleave", handlePointerLeave);
    container.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("keydown", handleScrollKey);
    recordCurrentScrollGeometry(container);
    if (typeof ResizeObserver === "undefined") {
      return removeInputListeners;
    }
    const observer = new ResizeObserver(() => {
      const now = performance.now();
      const currentGeometry = readScrollGeometrySnapshot(container);
      const clampedScrollTop = resolveClampedScrollTop(
        scrollGeometrySnapshotRef.current,
        currentGeometry,
        PROGRAMMATIC_SCROLL_ECHO_TOLERANCE_PX,
      );
      if (clampedScrollTop !== null) {
        recordProgrammaticScrollEcho({
          recordedAt: now,
          scrollTop: clampedScrollTop,
          source: "clamp",
        });
      }
      scrollGeometrySnapshotRef.current = currentGeometry;

      const prevHeight = scrollAuthorityRef.current.geometry.lastScrollHeight;
      const geoDecision = reduceGeometry(
        {
          ...scrollAuthorityRef.current,
          liveAutoFollowEnabled: liveAutoFollowEnabledRef.current,
        },
        {
          kind:
            currentGeometry.maxScrollTop >
            Math.max(0, prevHeight - container.clientHeight)
              ? "content-grow"
              : currentGeometry.maxScrollTop <
                  Math.max(0, prevHeight - container.clientHeight)
                ? "content-shrink"
                : "measure-late",
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight,
          maxScrollTop: currentGeometry.maxScrollTop,
          scrollTop: container.scrollTop,
          phase: "static",
          scopeGeneration: scopeGenerationRef.current,
          finalizingPresentationActive: isAssistantFinalizingRef.current,
        },
        now,
      );
      scrollAuthorityRef.current = geoDecision.state;

      // forced 退役后同步 legacy autoScroll 语义（只认真底，不用 120 近底）
      if (
        geoDecision.reasonCode === "forced-retired-stable" ||
        geoDecision.reasonCode === "settle-timeout-short-of-bottom"
      ) {
        if (geoDecision.state.mode === "stick-bottom") {
          autoScrollRef.current = true;
        } else if (geoDecision.state.mode === "free") {
          autoScrollRef.current = isAtTrueBottom({
            scrollHeight: container.scrollHeight,
            clientHeight: container.clientHeight,
            scrollTop: container.scrollTop,
          });
        }
        if (geoDecision.requestBottomPin) {
          // safety timeout：最后一次 nudge（history-restore 不 clear intent / 不强制 re-force）
          pinCanvasToBottom("history-restore", "instant");
        }
      }

      // 全砍：Resize 绝不 clearUserScrollIntent。
      // re-arm stick 只在真底（≤1px）且无用户租约时；禁止 120px 近底把 free 拽回 stick。
      const atTrueBottom = isAtTrueBottom({
        scrollHeight: container.scrollHeight,
        clientHeight: container.clientHeight,
        scrollTop: container.scrollTop,
      });
      if (
        atTrueBottom &&
        !hasRecentUserScrollIntent() &&
        liveAutoFollowEnabledRef.current &&
        autoScrollRef.current &&
        (scrollAuthorityRef.current.mode === "free" ||
          scrollAuthorityRef.current.mode === "history-head")
      ) {
        const rearm = reduceIntent(
          {
            ...scrollAuthorityRef.current,
            liveAutoFollowEnabled: true,
          },
          { type: "focus-follow-on" },
          now,
        );
        scrollAuthorityRef.current = rearm.state;
      }

      const mode = scrollAuthorityRef.current.mode;
      // forced 不依赖 autoScroll；stick 须 armed。用户租约一律停。
      const shouldContinuePin =
        !hasRecentUserScrollIntent() &&
        (mode === "forced-bottom" ||
          (autoScrollRef.current &&
            (shouldContinuousPin(mode) || Boolean(geoDecision.requestBottomPin))));

      if (shouldContinuePin) {
        continueBottomPinIfArmed();
      }
      // convergence 首次 pulse 同步写 scrollTop；snapshot 必须反映写后的真实位置。
      recordCurrentScrollGeometry(container);
    });
    // 观察容器自身 + 内容：Composer 运行态条（「已编辑 N 个文件」等）挂载或窗口 resize
    // 会压小 clientHeight，maxScrollTop 静默变大——scrollTop 不变、不派发 scroll 事件，
    // 仅观察内容永远感知不到（回合结束后视口滞留底部上方的主根因之一）。
    observer.observe(container);
    if (content) {
      observer.observe(content);
    }
    return () => {
      observer.disconnect();
      removeInputListeners();
      scrollGeometrySnapshotRef.current = null;
      lastUserScrollIntentAtRef.current = null;
    };
  }, [
    cancelScrollConvergence,
    continueBottomPinIfArmed,
    hasRecentUserScrollIntent,
    liveAutoFollowEnabledRef,
    pinCanvasToBottom,
    recordCurrentScrollGeometry,
    recordProgrammaticScrollEcho,
    renderScopeKey,
  ]);
  const handleScrollControlRequest = useCallback(
    (edge: ConversationScrollEdge) => {
      if (edge === "bottom") {
        // 回到底部按钮：权威 pin 原语（smooth + 再入 forced 追迟到长高）
        pinCanvasToBottom("explicit", "smooth");
        return;
      }
      autoScrollRef.current = false;
      clearPendingJumpMessage();
      const now = performance.now();
      const decision = reduceIntent(
        {
          ...scrollAuthorityRef.current,
          liveAutoFollowEnabled: liveAutoFollowEnabledRef.current,
        },
        { type: "explicit-top" },
        now,
      );
      scrollAuthorityRef.current = decision.state;
      requestScrollConvergence("top", "smooth", "explicit-control");
    },
    [
      clearPendingJumpMessage,
      liveAutoFollowEnabledRef,
      pinCanvasToBottom,
      requestScrollConvergence,
    ],
  );
  const getPendingScrollResourceCount = useCallback(
    () => (scrollThrottleRef.current ? 1 : 0),
    [],
  );

  /**
   * 内容高度阶跃导致的「假离底」：用户仍停在原 scrollTop，max 变大，
   * distance 瞬时变大但 scrollTop 几乎没动。不得据此解除 autoScroll。
   *
   * 与用户真上滚（scrollTop 明显减小）区分开。
   * 注意：不要求「之前 nearBottom」——工具折叠/MD 开渲后可能已假离底多帧，
   * 只要仍 armed 且 scrollTop 稳定 + 高度在变，就继续保护。
   */
  const isContentGrowthLagFromSnapshot = useCallback(
    (previous: ScrollGeometrySnapshot | null, current: ScrollGeometrySnapshot) => {
      if (!previous) {
        return false;
      }
      const scrollTopStable =
        Math.abs(current.scrollTop - previous.scrollTop) <=
        PROGRAMMATIC_SCROLL_ECHO_TOLERANCE_PX + 1;
      const maxChanged =
        Math.abs(current.maxScrollTop - previous.maxScrollTop) > 1;
      return scrollTopStable && maxChanged;
    },
    [],
  );

  /**
   * scroll 事件到来时：armed / forced / stick 下若是内容长高假离底则保护跟随。
   * 用户真上滚（wheel 租约或 scrollTop 明显上移）不保护。
   */
  const shouldProtectFollowOnScrollEvent = useCallback(
    (previous: ScrollGeometrySnapshot | null, current: ScrollGeometrySnapshot) => {
      const mode = scrollAuthorityRef.current.mode;
      const following =
        autoScrollRef.current ||
        mode === "forced-bottom" ||
        activeProgrammaticScrollEdgeRef.current === "bottom";
      if (!following) {
        return false;
      }
      return isContentGrowthLagFromSnapshot(previous, current);
    },
    [isContentGrowthLagFromSnapshot],
  );

  return {
    activeProgrammaticScrollEdgeRef,
    activeProgrammaticScrollMotionRef,
    autoScrollRef,
    beginTurnBoundaryBottomConvergence,
    cancelFocusFollowConvergence,
    cancelScrollConvergence,
    clearUserScrollIntent,
    containerRef,
    getPendingScrollResourceCount,
    handleScrollControlRequest,
    hasRecentUserScrollIntent,
    initialBottomPinScopeRef,
    isNearBottom,
    noteViewportAtTrueBottom,
    noteViewportLeftBottom,
    programmaticScrollTopEchoRef,
    rearmAutoFollowToBottom,
    recordCurrentScrollGeometry,
    requestAutoScroll,
    requestHistoryBottomConvergence,
    requestTimelineLayoutBottomConvergence,
    scrollGeometrySnapshotRef,
    scrollKey,
    shouldProtectFollowOnScrollEvent,
    stickToBottomDeadlineRef,
    stickToBottomIntentRef,
  };
}
