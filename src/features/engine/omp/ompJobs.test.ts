import { describe, expect, it } from "vitest";
import {
  applyOmpJobFrame,
  createOmpJobsController,
  EMPTY_OMP_JOBS_STATE,
  parseOmpJobFrame,
  requestOmpJobCancel,
  requestOmpJobJoin,
  type OmpJobsState,
} from "./ompJobs";
import type { OmpAdminOwner } from "./ompAdminBoundary";

const owner: OmpAdminOwner = {
  engine: "omp",
  workspaceId: "ws-1",
  runtimeProfileId: "rt-1",
  providerProfileId: "pp-1",
  nativeSessionId: "native-1",
};

const startedFrame = (jobId: string, extra: Record<string, unknown> = {}) => ({
  type: "job_started",
  job_id: jobId,
  kind: "background_job",
  owner,
  ...extra,
});

describe("OMP P9 job frame parsing", () => {
  it("parses job_started/job_updated/job_completed with stable id, owner and kind", () => {
    const started = parseOmpJobFrame(startedFrame("job-1"));
    expect(started.status).toBe("known");
    if (started.status !== "known") return;
    expect(started.frame.kind).toBe("started");
    expect(started.frame.jobId).toBe("job-1");
    expect(started.frame.jobKind).toBe("background-job");
    expect(started.frame.owner).toEqual(owner);

    const updated = parseOmpJobFrame({ type: "job_updated", job_id: "job-1", state: "running" });
    expect(updated.status).toBe("known");
    if (updated.status !== "known") return;
    expect(updated.frame.kind).toBe("updated");
    expect(updated.frame.stateHint).toBe("running");

    const completed = parseOmpJobFrame({ type: "job_completed", job_id: "job-1" });
    expect(completed.status).toBe("known");
    if (completed.status !== "known") return;
    expect(completed.frame.kind).toBe("completed");
  });

  it("marks non-job control frames and id-less job frames as explicit unknown", () => {
    const notJob = parseOmpJobFrame({ type: "ready" });
    expect(notJob.status).toBe("unknown");

    const missingId = parseOmpJobFrame({ type: "job_started" });
    expect(missingId.status).toBe("unknown");
    if (missingId.status !== "unknown") return;
    expect(missingId.reason).toBe("missing-job-id");
  });

  it("keeps recognized frames with unclassified kind as kind unknown instead of dropping them", () => {
    const parsed = parseOmpJobFrame({ type: "job_started", job_id: "job-9", kind: "mystery" });
    expect(parsed.status).toBe("known");
    if (parsed.status !== "known") return;
    expect(parsed.frame.jobKind).toBe("unknown");
  });
});

describe("OMP P9 job lifecycle state machine", () => {
  const start = (state: OmpJobsState, jobId: string, extra: Record<string, unknown> = {}) => {
    const parsed = parseOmpJobFrame(startedFrame(jobId, extra));
    return applyOmpJobFrame(state, parsed);
  };

  it("tracks queued -> running -> awaiting_join -> terminal via job frames", () => {
    let state = start(EMPTY_OMP_JOBS_STATE, "job-1");
    expect(state.jobs["job-1"]?.state).toBe("queued");

    state = applyOmpJobFrame(
      state,
      parseOmpJobFrame({ type: "job_updated", job_id: "job-1", state: "running" }),
    );
    expect(state.jobs["job-1"]?.state).toBe("running");

    state = requestOmpJobJoin(state, "job-1", "turn-7");
    expect(state.jobs["job-1"]?.state).toBe("awaiting_join");
    expect(state.jobs["job-1"]?.joinedByTurnId).toBe("turn-7");

    state = applyOmpJobFrame(state, parseOmpJobFrame({ type: "job_completed", job_id: "job-1" }));
    expect(state.jobs["job-1"]?.state).toBe("terminal");
  });

  it("keeps terminal and cancelled absorbing: late frames never resurrect a settled job", () => {
    let state = start(EMPTY_OMP_JOBS_STATE, "job-1");
    state = applyOmpJobFrame(state, parseOmpJobFrame({ type: "job_completed", job_id: "job-1" }));
    const settled = state.jobs["job-1"];
    state = applyOmpJobFrame(
      state,
      parseOmpJobFrame({ type: "job_updated", job_id: "job-1", state: "running" }),
    );
    expect(state.jobs["job-1"]).toEqual(settled);

    state = start(state, "job-1");
    expect(state.jobs["job-1"]?.state).toBe("terminal");

    state = requestOmpJobCancel(state, "job-1");
    expect(state.jobs["job-1"]?.state).toBe("terminal");
  });

  it("cancel settles live jobs and is a no-op for unknown jobs", () => {
    let state = start(EMPTY_OMP_JOBS_STATE, "job-1");
    state = requestOmpJobCancel(state, "job-1");
    expect(state.jobs["job-1"]?.state).toBe("cancelled");

    const before = state;
    state = requestOmpJobCancel(state, "job-missing");
    expect(state).toBe(before);
  });

  it("join is only valid for live jobs and records the joining turn", () => {
    let state = start(EMPTY_OMP_JOBS_STATE, "job-1");
    state = requestOmpJobJoin(state, "job-1", "turn-1");
    expect(state.jobs["job-1"]?.state).toBe("awaiting_join");

    state = applyOmpJobFrame(state, parseOmpJobFrame({ type: "job_completed", job_id: "job-1" }));
    const before = state;
    state = requestOmpJobJoin(state, "job-1", "turn-2");
    expect(state).toBe(before);

    state = requestOmpJobJoin(state, "job-missing", "turn-3");
    expect(state.jobs["job-missing"]).toBeUndefined();
  });

  it("never lets background job settlement overwrite the foreground turn", () => {
    let state: OmpJobsState = { ...EMPTY_OMP_JOBS_STATE, foregroundTurnId: "turn-fg" };
    state = start(state, "job-1");
    state = applyOmpJobFrame(state, parseOmpJobFrame({ type: "job_completed", job_id: "job-1" }));
    expect(state.jobs["job-1"]?.state).toBe("terminal");
    expect(state.foregroundTurnId).toBe("turn-fg");
  });

  it("records unknown frames explicitly instead of dropping them", () => {
    let state = start(EMPTY_OMP_JOBS_STATE, "job-1");
    state = applyOmpJobFrame(state, parseOmpJobFrame({ type: "mystery_frame" }));
    state = applyOmpJobFrame(state, parseOmpJobFrame({ type: "job_started" }));
    expect(state.unknownFrames).toHaveLength(2);
    expect(state.unknownFrames[0]?.status).toBe("unknown");
  });
});

describe("OMP P9 jobs controller is feature-local and event-driven", () => {
  it("notifies subscribers only on observable change", () => {
    const controller = createOmpJobsController({ foregroundTurnId: "turn-fg" });
    const seen: OmpJobsState[] = [];
    const unsubscribe = controller.subscribe((state) => seen.push(state));

    controller.dispatch(startedFrame("job-1"));
    controller.dispatch({ type: "job_updated", job_id: "job-1", state: "running" });
    // 无效转换（running -> queued）不应触发通知
    controller.dispatch({ type: "job_updated", job_id: "job-1", state: "queued" });
    expect(seen).toHaveLength(2);

    controller.cancel("job-1");
    expect(seen).toHaveLength(3);
    expect(seen.at(-1)?.jobs["job-1"]?.state).toBe("cancelled");

    unsubscribe();
    controller.dispatch({ type: "job_completed", job_id: "job-1" });
    expect(seen).toHaveLength(3);
    // cancelled 是终态，completed 不得覆盖
    expect(controller.getState().jobs["job-1"]?.state).toBe("cancelled");
    expect(controller.getState().foregroundTurnId).toBe("turn-fg");
  });

  it("returns the frame projection so callers can surface unknown frames", () => {
    const controller = createOmpJobsController();
    const projection = controller.dispatch({ type: "job_started" });
    expect(projection.status).toBe("unknown");
    expect(controller.getState().unknownFrames).toHaveLength(1);
  });
});
describe("OMP P9 review findings regression", () => {
  const freshOwner = (): OmpAdminOwner => ({
    engine: "omp",
    workspaceId: "ws-1",
    runtimeProfileId: "rt-1",
    providerProfileId: "pp-1",
    nativeSessionId: "native-1",
  });

  it("treats a duplicate started frame with a fresh but equal owner object as no-change", () => {
    // parseOwner 每次新建 owner 对象：短路判断必须结构化相等，
    // 否则重复 job_started 会造成伪 revision 与 listener 误通知。
    const first = applyOmpJobFrame(
      EMPTY_OMP_JOBS_STATE,
      parseOmpJobFrame({ type: "job_started", job_id: "job-dup", owner: freshOwner() }),
    );
    const second = applyOmpJobFrame(
      first,
      parseOmpJobFrame({ type: "job_started", job_id: "job-dup", owner: freshOwner() }),
    );
    expect(second).toBe(first);
    expect(second.jobs["job-dup"]?.revision).toBe(0);
  });

  it("ignores updated/completed frames whose owner conflicts with the record owner", () => {
    const foreignOwner: OmpAdminOwner = { ...freshOwner(), nativeSessionId: "native-2" };
    let state = applyOmpJobFrame(
      EMPTY_OMP_JOBS_STATE,
      parseOmpJobFrame({ type: "job_started", job_id: "job-own", owner: freshOwner() }),
    );
    state = applyOmpJobFrame(
      state,
      parseOmpJobFrame({ type: "job_updated", job_id: "job-own", state: "running", owner: foreignOwner }),
    );
    expect(state.jobs["job-own"]?.state).toBe("queued");
    state = applyOmpJobFrame(
      state,
      parseOmpJobFrame({ type: "job_completed", job_id: "job-own", owner: foreignOwner }),
    );
    expect(state.jobs["job-own"]?.state).toBe("queued");
  });

  it("does not silently replace owner when a conflicting started frame arrives", () => {
    const foreignOwner: OmpAdminOwner = { ...freshOwner(), nativeSessionId: "native-2" };
    const first = applyOmpJobFrame(
      EMPTY_OMP_JOBS_STATE,
      parseOmpJobFrame({ type: "job_started", job_id: "job-swap", owner: freshOwner() }),
    );
    const second = applyOmpJobFrame(
      first,
      parseOmpJobFrame({ type: "job_started", job_id: "job-swap", owner: foreignOwner, detail: "hijack" }),
    );
    expect(second).toBe(first);
    expect(second.jobs["job-swap"]?.owner?.nativeSessionId).toBe("native-1");
  });

  it("evicts the oldest settled jobs beyond the retention cap while live jobs survive", () => {
    let state: OmpJobsState = EMPTY_OMP_JOBS_STATE;
    state = applyOmpJobFrame(
      state,
      parseOmpJobFrame({ type: "job_started", job_id: "job-live", owner: freshOwner() }),
    );
    for (let index = 0; index < 105; index += 1) {
      state = applyOmpJobFrame(
        state,
        parseOmpJobFrame({ type: "job_started", job_id: `job-settled-${index}` }),
      );
      state = applyOmpJobFrame(
        state,
        parseOmpJobFrame({ type: "job_completed", job_id: `job-settled-${index}` }),
      );
    }
    const settledCount = Object.values(state.jobs).filter(
      (record) => record.state === "terminal" || record.state === "cancelled",
    ).length;
    expect(settledCount).toBe(100);
    expect(state.jobs["job-settled-0"]).toBeUndefined();
    expect(state.jobs["job-settled-104"]).toBeDefined();
    expect(state.jobs["job-live"]?.state).toBe("queued");
  });
});
