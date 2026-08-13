import type { ConversationItem } from "../../../types";
import type {
  HistoryLoader,
  NormalizedHistorySnapshot,
} from "../contracts/conversationCurtainContracts";
import { normalizeHistorySnapshot } from "../contracts/conversationCurtainContracts";
import { normalizeSharedSessionEngine } from "../../shared-session/utils/sharedSessionEngines";
import {
  isSharedProjectionDataSourceEnabled,
  resolveSharedConversationItems,
} from "../../messages/presentation/sharedProjection/dataSource";
import type { SharedProjectionItem } from "../../messages/presentation/sharedProjection/types";
import {
  findCanonicalAgentRunId,
  registerAgentConversationEvidence,
} from "../../multi-agent/store/agentStore";
import {
  hydrateSharedTargetState,
  getSharedTargetState,
  getPersistGeneration,
  isSharedTargetPersistInFlight,
} from "../../shared-session/target/targetStore";
import {
  isResolvedExecutionTarget,
  normalizePersistedExecutionTarget,
} from "../../shared-session/target/types";
import { mergeHistoryProjectionItems } from "../assembly/conversationAssembler";
import {
  buildSharedHistoryFinalizeProgress,
  buildSharedHistoryMergeProgress,
  buildSharedHistoryPrepareProgress,
  buildSharedHistoryProjectionProgress,
  buildSharedHistorySessionProgress,
  normalizeHistoryLoadingProgress,
  type HistoryLoadingProgressListener,
} from "../utils/historyLoadingProgress";

/** Soft wait for projection on open; after this, return V0 and finish merge in background. */
export const DEFAULT_SHARED_PROJECTION_TIMEOUT_MS = 12_000;

type SharedHistoryLoaderOptions = {
  workspaceId: string;
  loadSharedSession: (
    workspaceId: string,
    threadId: string,
  ) => Promise<Record<string, unknown> | null>;
  loadSharedProjection: (
    workspaceId: string,
    threadId: string,
  ) => Promise<SharedProjectionItem[]>;
  onProgress?: HistoryLoadingProgressListener;
  /** Override soft timeout (ms). Tests inject short values. */
  projectionTimeoutMs?: number;
  /**
   * Projection finished after Phase-A returned (timeout path).
   * Caller MUST guard with resume generation / active thread and avoid
   * clobbering an in-flight live turn.
   */
  onProjectionMerged?: (snapshot: NormalizedHistorySnapshot) => void;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Wait for work up to timeoutMs. On timeout, resolve with pending promise still running
 * so caller can attach background handlers without cancelling IPC.
 */
async function raceWithSoftTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<
  | { kind: "done"; value: T }
  | { kind: "timeout"; pending: Promise<T> }
> {
  let settled = false;
  const pending = work.then(
    (value) => {
      settled = true;
      return value;
    },
    (error) => {
      settled = true;
      throw error;
    },
  );
  const raced = await Promise.race([
    pending.then((value) => ({ kind: "done" as const, value })),
    sleep(timeoutMs).then(() => ({ kind: "timeout" as const })),
  ]);
  if (raced.kind === "done") {
    return raced;
  }
  if (settled) {
    // Finished in the same tick as timeout — prefer the result.
    return { kind: "done", value: await pending };
  }
  return { kind: "timeout", pending };
}

export function createSharedHistoryLoader({
  workspaceId,
  loadSharedSession,
  loadSharedProjection,
  onProgress,
  projectionTimeoutMs = DEFAULT_SHARED_PROJECTION_TIMEOUT_MS,
  onProjectionMerged,
}: SharedHistoryLoaderOptions): HistoryLoader {
  const report: HistoryLoadingProgressListener = (progress) => {
    onProgress?.(normalizeHistoryLoadingProgress(progress));
  };

  return {
    engine: "codex",
    async load(threadId: string) {
      report(buildSharedHistoryPrepareProgress());
      report(buildSharedHistorySessionProgress("start"));
      // 记录加载前代次，用于检测加载期间是否有 in-flight persist 写入。
      const generationBeforeLoad = getPersistGeneration(
        workspaceId,
        threadId,
      );
      const response = await loadSharedSession(workspaceId, threadId);
      const persistedTarget = normalizePersistedExecutionTarget(
        response?.selectedTarget,
      );
      const resolvedPersistedTarget = isResolvedExecutionTarget(persistedTarget)
        ? persistedTarget
        : null;
      // 写序保护（fix-shared-session-target-race-and-merge T4）：
      // 1) 加载期间 generation 前进 → 跳过
      // 2) persist 仍 in-flight → 跳过（堵住代次未再递增窗口）
      // 3) persisted 不完整且 store 已有完整 target → 不降级
      const generationAfterLoad = getPersistGeneration(
        workspaceId,
        threadId,
      );
      const skipStaleHydrate =
        generationAfterLoad > generationBeforeLoad ||
        isSharedTargetPersistInFlight(workspaceId, threadId);
      if (skipStaleHydrate) {
        // 保留 store 中的乐观/最新值。
      } else if (resolvedPersistedTarget) {
        hydrateSharedTargetState(
          workspaceId,
          threadId,
          resolvedPersistedTarget,
        );
      } else {
        const existingState = getSharedTargetState(workspaceId, threadId);
        if (
          !existingState.selectedNextTarget ||
          !isResolvedExecutionTarget(existingState.selectedNextTarget)
        ) {
          hydrateSharedTargetState(workspaceId, threadId, null);
        }
      }
      const selectedEngine = asString(response?.selectedEngine).trim().toLowerCase();
      const normalizedSelectedEngine =
        resolvedPersistedTarget?.engine ??
        normalizeSharedSessionEngine(
          selectedEngine === "codex" || selectedEngine === "claude"
            ? selectedEngine
            : undefined,
        );
      const legacyItems = Array.isArray(response?.items)
        ? (response?.items as ConversationItem[])
        : [];
      report(buildSharedHistorySessionProgress("done", legacyItems.length));

      const buildSnapshot = (items: ConversationItem[]) =>
        normalizeHistorySnapshot({
          engine: normalizedSelectedEngine,
          workspaceId,
          threadId,
          items,
          meta: {
            workspaceId,
            threadId,
            engine: normalizedSelectedEngine,
            activeTurnId: null,
            isThinking: false,
            heartbeatPulse: null,
            historyRestoredAtMs: Date.now(),
          },
        });

      const phaseASnapshot = buildSnapshot(legacyItems);

      if (!isSharedProjectionDataSourceEnabled()) {
        report(buildSharedHistoryProjectionProgress("skip"));
        report(buildSharedHistoryMergeProgress("done", legacyItems.length));
        report(buildSharedHistoryFinalizeProgress());
        return phaseASnapshot;
      }

      const runProjectionMerge = async (): Promise<NormalizedHistorySnapshot> => {
        report(buildSharedHistoryProjectionProgress("start"));
        const sharedProjectionRaw = await loadSharedProjection(
          workspaceId,
          threadId,
        );
        const sharedProjection = Array.isArray(sharedProjectionRaw)
          ? sharedProjectionRaw
          : [];
        // Squad evidence must come from canonical rows only — presentation-only
        // / prose must not invent agentRun bindings (parity with canvas fidelity).
        const agentRunId = findCanonicalAgentRunId(
          sharedProjection.filter(
            (item) =>
              (item as { fidelity?: string }).fidelity !== "presentation-only",
          ),
        );
        if (agentRunId) {
          registerAgentConversationEvidence(
            workspaceId,
            threadId,
            agentRunId,
          );
        }
        const projectedItems =
          resolveSharedConversationItems(sharedProjection) ?? [];
        report(
          buildSharedHistoryProjectionProgress("done", projectedItems.length),
        );
        report(buildSharedHistoryMergeProgress("start"));
        const items =
          legacyItems.length > 0
            ? mergeHistoryProjectionItems(legacyItems, projectedItems, {
                workspaceId,
                threadId,
                engine: normalizedSelectedEngine,
              })
            : projectedItems;
        report(buildSharedHistoryMergeProgress("done", items.length));
        report(buildSharedHistoryFinalizeProgress());
        return buildSnapshot(items);
      };

      // Empty V0: wait for projection within soft timeout; fail closed if missing.
      if (legacyItems.length === 0) {
        try {
          const hard = await raceWithSoftTimeout(
            runProjectionMerge(),
            projectionTimeoutMs,
          );
          if (hard.kind === "done") {
            return hard.value;
          }
          void hard.pending.catch(() => undefined);
          throw new Error(
            `shared-projection timed out after ${projectionTimeoutMs}ms with empty V0 for ${threadId}`,
          );
        } catch (error) {
          console.warn(
            `[shared-projection] load failed; no V0 snapshot available for ${threadId}`,
            error,
          );
          throw error;
        }
      }

      // Non-empty V0: wait up to soft timeout; then unblock with V0 and merge later.
      try {
        const raced = await raceWithSoftTimeout(
          runProjectionMerge(),
          projectionTimeoutMs,
        );
        if (raced.kind === "done") {
          return raced.value;
        }
        console.warn(
          `[shared-projection] soft-timeout ${projectionTimeoutMs}ms; using V0 for ${threadId} (background merge continues)`,
        );
        // Phase-A ready: finish curtain progress without waiting for projection.
        report(buildSharedHistoryFinalizeProgress());
        void raced.pending
          .then((merged) => {
            onProjectionMerged?.(merged);
          })
          .catch((error) => {
            console.warn(
              `[shared-projection] background load failed after V0 ready for ${threadId}`,
              error,
            );
          });
        return phaseASnapshot;
      } catch (error) {
        console.warn(
          `[shared-projection] load failed; using V0 snapshot for ${threadId}`,
          error,
        );
        report(buildSharedHistoryMergeProgress("done", legacyItems.length));
        report(buildSharedHistoryFinalizeProgress());
        return phaseASnapshot;
      }
    },
  };
}
