import {
  recordStartupTaskTrace,
  type StartupCancellationMode,
  type StartupFallbackReason,
  type StartupPhase,
  type StartupWorkspaceScope,
} from "./startupTrace";

export type StartupCancelPolicy =
  | "none"
  | "soft-ignore"
  | "yield-only"
  | "cooperative-abort"
  | "hard-abort";

export type StartupTaskContext = {
  signal: AbortSignal;
  generation: number;
  isStale: () => boolean;
};

export type StartupTaskDescriptor<T> = {
  id: string;
  phase: StartupPhase;
  priority: number;
  dedupeKey: string;
  concurrencyKey: string;
  timeoutMs: number;
  workspaceScope: StartupWorkspaceScope;
  cancelPolicy: StartupCancelPolicy;
  traceLabel: string;
  commandLabel?: string;
  run: (context: StartupTaskContext) => Promise<T>;
  fallback: (reason: StartupFallbackReason) => T | Promise<T>;
};

export type StartupOrchestratorOptions = {
  phaseConcurrency?: Partial<Record<StartupPhase, number>>;
  heavyCommandConcurrency?: Partial<Record<string, number>>;
  idleSliceBudgetMs?: number;
};

const DEFAULT_PHASE_CONCURRENCY: Record<StartupPhase, number> = {
  critical: 1,
  "first-paint": 1,
  "active-workspace": 2,
  "idle-prewarm": 1,
  "on-demand": 2,
};

type QueuedTask<T> = {
  descriptor: StartupTaskDescriptor<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  queuedAt: number;
  generation: number;
};

type RunningTask = {
  abortController: AbortController;
  descriptor: StartupTaskDescriptor<unknown>;
  generation: number;
  startedAt: number;
  /** Settles the waiter with cancelled fallback; idempotent once released. */
  settleCancelled: (reason: StartupFallbackReason) => void;
  concurrencyReleased: boolean;
};

function nowMs() {
  return Date.now();
}

function phaseRank(phase: StartupPhase) {
  switch (phase) {
    case "critical":
      return 0;
    case "first-paint":
      return 1;
    case "active-workspace":
      return 2;
    case "idle-prewarm":
      return 3;
    case "on-demand":
      return 4;
  }
}

function toCancellationMode(policy: StartupCancelPolicy): StartupCancellationMode {
  return policy;
}

function yieldToLaterTask() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 1);
  });
}

export class StartupOrchestrator {
  private readonly phaseConcurrency: Record<StartupPhase, number>;
  private readonly heavyCommandConcurrency: Partial<Record<string, number>>;
  private readonly idleSliceBudgetMs: number;
  private readonly queue: QueuedTask<unknown>[] = [];
  private readonly inFlightByDedupeKey = new Map<string, Promise<unknown>>();
  private readonly runningByDedupeKey = new Map<string, RunningTask>();
  private readonly runningCountByPhase = new Map<StartupPhase, number>();
  private readonly runningCountByConcurrencyKey = new Map<string, number>();
  private readonly cancelledGenerations = new Set<number>();
  private lastIdleSliceStartedAt: number | null = null;
  private idleDrainResumedAfterYield = false;
  private idleResumeScheduled = false;
  private generation = 0;

  constructor(options: StartupOrchestratorOptions = {}) {
    this.phaseConcurrency = {
      ...DEFAULT_PHASE_CONCURRENCY,
      ...options.phaseConcurrency,
    };
    this.heavyCommandConcurrency = options.heavyCommandConcurrency ?? {};
    this.idleSliceBudgetMs = options.idleSliceBudgetMs ?? 16;
  }

  run<T>(descriptor: StartupTaskDescriptor<T>): Promise<T> {
    const existing = this.inFlightByDedupeKey.get(descriptor.dedupeKey);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = new Promise<T>((resolve, reject) => {
      this.queue.push({
        descriptor,
        resolve: (value: unknown) => resolve(value as T),
        reject,
        queuedAt: nowMs(),
        generation: ++this.generation,
      });
      recordStartupTaskTrace({
        type: "task",
        taskId: descriptor.id,
        phase: descriptor.phase,
        traceLabel: descriptor.traceLabel,
        workspaceScope: descriptor.workspaceScope,
        lifecycleState: "queued",
        durationMs: null,
        fallbackReason: null,
        cancellationMode: null,
        commandLabel: descriptor.commandLabel ?? null,
      });
      this.drainQueue();
    });

    this.inFlightByDedupeKey.set(descriptor.dedupeKey, promise);
    const releaseInFlight = () => {
      if (this.inFlightByDedupeKey.get(descriptor.dedupeKey) === promise) {
        this.inFlightByDedupeKey.delete(descriptor.dedupeKey);
      }
    };
    promise.then(
      releaseInFlight,
      releaseInFlight,
    );
    return promise;
  }

  cancelWorkspaceTasks(workspaceId: string, reason: StartupFallbackReason = "stale") {
    for (const queuedTask of [...this.queue]) {
      if (!this.matchesWorkspace(queuedTask.descriptor.workspaceScope, workspaceId)) {
        continue;
      }
      this.cancelQueuedTask(queuedTask, reason);
    }

    for (const [dedupeKey, runningTask] of [
      ...this.runningByDedupeKey.entries(),
    ]) {
      if (!this.matchesWorkspace(runningTask.descriptor.workspaceScope, workspaceId)) {
        continue;
      }
      this.cancelRunningTask(dedupeKey, runningTask, reason);
    }
    this.drainQueue();
  }

  cancelTask(dedupeKey: string, reason: StartupFallbackReason = "stale") {
    let cancelled = false;
    const queuedTask = this.queue.find(
      (task) => task.descriptor.dedupeKey === dedupeKey,
    );
    if (queuedTask) {
      this.cancelQueuedTask(queuedTask, reason);
      cancelled = true;
    }
    const runningTask = this.runningByDedupeKey.get(dedupeKey);
    if (runningTask) {
      this.cancelRunningTask(dedupeKey, runningTask, reason);
      cancelled = true;
    }
    if (cancelled) {
      this.drainQueue();
    }
    return cancelled;
  }

  /**
   * Abort every queued/running startup task (force-enter / emergency unmask).
   * Orphan IPC bodies still finish but isStale skips setThreads commits.
   *
   * Default reason is `stale` (not `cancelled`): thread-list hydration fallback
   * only maps `stale` → `{ applied: false, stale: true }`. Other reasons resolve
   * as undefined and are treated as soft-success in finally blocks.
   */
  cancelAllTasks(reason: StartupFallbackReason = "stale") {
    for (const queuedTask of [...this.queue]) {
      this.cancelQueuedTask(queuedTask, reason);
    }
    for (const [dedupeKey, runningTask] of [
      ...this.runningByDedupeKey.entries(),
    ]) {
      this.cancelRunningTask(dedupeKey, runningTask, reason);
    }
  }

  getQueuedTaskCount() {
    return this.queue.length;
  }

  private drainQueue() {
    this.queue.sort((left, right) => {
      const phaseDelta = phaseRank(left.descriptor.phase) - phaseRank(right.descriptor.phase);
      if (phaseDelta !== 0) {
        return phaseDelta;
      }
      const priorityDelta = right.descriptor.priority - left.descriptor.priority;
      return priorityDelta !== 0 ? priorityDelta : left.queuedAt - right.queuedAt;
    });

    for (const task of [...this.queue]) {
      if (!this.canStart(task.descriptor)) {
        continue;
      }
      if (this.shouldYieldIdleTask(task.descriptor)) {
        void this.resumeIdleDrainLater();
        return;
      }
      this.removeQueuedTask(task);
      void this.startTask(task);
    }
  }

  private canStart(descriptor: StartupTaskDescriptor<unknown>) {
    const phaseCount = this.runningCountByPhase.get(descriptor.phase) ?? 0;
    if (phaseCount >= this.phaseConcurrency[descriptor.phase]) {
      return false;
    }
    const concurrencyLimit = this.heavyCommandConcurrency[descriptor.concurrencyKey];
    if (
      typeof concurrencyLimit === "number" &&
      (this.runningCountByConcurrencyKey.get(descriptor.concurrencyKey) ?? 0) >=
        concurrencyLimit
    ) {
      return false;
    }
    return true;
  }

  private async startTask<T>(task: QueuedTask<T>) {
    const descriptor = task.descriptor;
    const abortController = new AbortController();
    const startedAt = nowMs();
    let settled = false;
    const settleOnce = async (
      reason: StartupFallbackReason,
      lifecycleState: "cancelled" | "degraded",
    ) => {
      if (settled) {
        return;
      }
      settled = true;
      await this.settleWithFallback(task, reason, lifecycleState, startedAt);
    };
    const runningTask: RunningTask = {
      abortController,
      descriptor: descriptor as StartupTaskDescriptor<unknown>,
      generation: task.generation,
      startedAt,
      concurrencyReleased: false,
      settleCancelled: (reason) => {
        void settleOnce(reason, "cancelled");
      },
    };
    this.runningByDedupeKey.set(descriptor.dedupeKey, runningTask);
    this.incrementRunning(descriptor);
    recordStartupTaskTrace({
      type: "task",
      taskId: descriptor.id,
      phase: descriptor.phase,
      traceLabel: descriptor.traceLabel,
      workspaceScope: descriptor.workspaceScope,
      lifecycleState: "started",
      durationMs: null,
      fallbackReason: null,
      cancellationMode: null,
      commandLabel: descriptor.commandLabel ?? null,
    });

    try {
      const result = await this.runWithTimeout(descriptor, {
        signal: abortController.signal,
        generation: task.generation,
        isStale: () => this.cancelledGenerations.has(task.generation),
      });
      if (this.cancelledGenerations.has(task.generation)) {
        await settleOnce("stale", "cancelled");
        return;
      }
      if (settled) {
        return;
      }
      settled = true;
      recordStartupTaskTrace({
        type: "task",
        taskId: descriptor.id,
        phase: descriptor.phase,
        traceLabel: descriptor.traceLabel,
        workspaceScope: descriptor.workspaceScope,
        lifecycleState: "completed",
        durationMs: nowMs() - startedAt,
        fallbackReason: null,
        cancellationMode: null,
        commandLabel: descriptor.commandLabel ?? null,
      });
      task.resolve(result);
    } catch (error) {
      if (error instanceof StartupTaskTimeoutError) {
        recordStartupTaskTrace({
          type: "task",
          taskId: descriptor.id,
          phase: descriptor.phase,
          traceLabel: descriptor.traceLabel,
          workspaceScope: descriptor.workspaceScope,
          lifecycleState: "timed-out",
          durationMs: nowMs() - startedAt,
          fallbackReason: "timeout",
          cancellationMode: null,
          commandLabel: descriptor.commandLabel ?? null,
        });
        await settleOnce("timeout", "degraded");
        return;
      }
      if (this.cancelledGenerations.has(task.generation) || settled) {
        await settleOnce("stale", "cancelled");
        return;
      }
      if (settled) {
        return;
      }
      settled = true;
      recordStartupTaskTrace({
        type: "task",
        taskId: descriptor.id,
        phase: descriptor.phase,
        traceLabel: descriptor.traceLabel,
        workspaceScope: descriptor.workspaceScope,
        lifecycleState: "failed",
        durationMs: nowMs() - startedAt,
        fallbackReason: "failure",
        cancellationMode: null,
        commandLabel: descriptor.commandLabel ?? null,
      });
      task.reject(error);
    } finally {
      if (!runningTask.concurrencyReleased) {
        runningTask.concurrencyReleased = true;
        this.runningByDedupeKey.delete(descriptor.dedupeKey);
        this.decrementRunning(descriptor);
        this.drainQueue();
      }
      this.cancelledGenerations.delete(task.generation);
    }
  }

  private async runWithTimeout<T>(
    descriptor: StartupTaskDescriptor<T>,
    context: StartupTaskContext,
  ) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        descriptor.run(context),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new StartupTaskTimeoutError());
          }, descriptor.timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async settleWithFallback<T>(
    task: QueuedTask<T>,
    reason: StartupFallbackReason,
    lifecycleState: "cancelled" | "degraded",
    startedAt?: number,
  ) {
    try {
      const fallbackValue = await task.descriptor.fallback(reason);
      recordStartupTaskTrace({
        type: "task",
        taskId: task.descriptor.id,
        phase: task.descriptor.phase,
        traceLabel: task.descriptor.traceLabel,
        workspaceScope: task.descriptor.workspaceScope,
        lifecycleState,
        durationMs: typeof startedAt === "number" ? nowMs() - startedAt : null,
        fallbackReason: reason,
        cancellationMode:
          lifecycleState === "cancelled"
            ? toCancellationMode(task.descriptor.cancelPolicy)
            : null,
        commandLabel: task.descriptor.commandLabel ?? null,
      });
      task.resolve(fallbackValue);
    } catch (fallbackError) {
      task.reject(fallbackError);
    }
  }

  private incrementRunning(descriptor: StartupTaskDescriptor<unknown>) {
    this.runningCountByPhase.set(
      descriptor.phase,
      (this.runningCountByPhase.get(descriptor.phase) ?? 0) + 1,
    );
    this.runningCountByConcurrencyKey.set(
      descriptor.concurrencyKey,
      (this.runningCountByConcurrencyKey.get(descriptor.concurrencyKey) ?? 0) + 1,
    );
  }

  private decrementRunning(descriptor: StartupTaskDescriptor<unknown>) {
    this.runningCountByPhase.set(
      descriptor.phase,
      Math.max(0, (this.runningCountByPhase.get(descriptor.phase) ?? 0) - 1),
    );
    this.runningCountByConcurrencyKey.set(
      descriptor.concurrencyKey,
      Math.max(0, (this.runningCountByConcurrencyKey.get(descriptor.concurrencyKey) ?? 0) - 1),
    );
  }

  private removeQueuedTask(task: QueuedTask<unknown>) {
    const index = this.queue.indexOf(task);
    if (index >= 0) {
      this.queue.splice(index, 1);
    }
  }

  private cancelQueuedTask(
    task: QueuedTask<unknown>,
    reason: StartupFallbackReason,
  ) {
    this.removeQueuedTask(task);
    this.inFlightByDedupeKey.delete(task.descriptor.dedupeKey);
    void this.settleWithFallback(task, reason, "cancelled");
  }

  private cancelRunningTask(
    dedupeKey: string,
    task: RunningTask,
    reason: StartupFallbackReason,
  ) {
    task.abortController.abort();
    this.cancelledGenerations.add(task.generation);
    task.settleCancelled(reason);
    if (task.concurrencyReleased) {
      return;
    }
    task.concurrencyReleased = true;
    this.inFlightByDedupeKey.delete(dedupeKey);
    this.runningByDedupeKey.delete(dedupeKey);
    this.decrementRunning(task.descriptor);
  }

  private matchesWorkspace(scope: StartupWorkspaceScope, workspaceId: string) {
    return typeof scope === "object" && scope.workspaceId === workspaceId;
  }

  private shouldYieldIdleTask(descriptor: StartupTaskDescriptor<unknown>) {
    if (descriptor.phase !== "idle-prewarm") {
      return false;
    }
    if (this.idleDrainResumedAfterYield) {
      this.idleDrainResumedAfterYield = false;
      this.lastIdleSliceStartedAt = nowMs();
      return false;
    }
    if (this.lastIdleSliceStartedAt === null) {
      this.lastIdleSliceStartedAt = nowMs();
      return false;
    }
    if (nowMs() - this.lastIdleSliceStartedAt < this.idleSliceBudgetMs) {
      return false;
    }
    this.lastIdleSliceStartedAt = nowMs();
    return true;
  }

  private async resumeIdleDrainLater() {
    if (this.idleResumeScheduled) {
      return;
    }
    this.idleResumeScheduled = true;
    await yieldToLaterTask();
    this.idleResumeScheduled = false;
    this.idleDrainResumedAfterYield = true;
    this.drainQueue();
  }

  getIdleSliceBudgetMs() {
    return this.idleSliceBudgetMs;
  }
}

class StartupTaskTimeoutError extends Error {
  constructor() {
    super("Startup task timed out");
    this.name = "StartupTaskTimeoutError";
  }
}

/**
 * Global orchestrator defaults tuned for cold-start interactivity:
 * - active-workspace phase concurrency 1: thread list + model catalog no longer
 *   race each other into the same AppShell commit window
 * - thread-session-scan heavy cap 1: never run two full-catalog list_threads
 *   (active + idle-prewarm / second workspace) at the same time
 *
 * Regression context: after 0.7.15, cold-start list hydration became mandatory
 * and overlapping scans made the UI unresponsive to any click until the
 * sidebar session list finished refreshing.
 */
export const startupOrchestrator = new StartupOrchestrator({
  phaseConcurrency: {
    "active-workspace": 1,
  },
  heavyCommandConcurrency: {
    "thread-session-scan": 1,
  },
});
