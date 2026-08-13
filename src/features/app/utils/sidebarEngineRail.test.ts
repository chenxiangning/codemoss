// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { ThreadSummary } from "../../../types";
import {
  collectSidebarEngineRails,
  filterThreadsForEngineRail,
  resolveRailForActiveThreadChange,
  resolveSidebarRailId,
} from "./sidebarEngineRail";

function thread(
  overrides: Partial<ThreadSummary> & Pick<ThreadSummary, "id">,
): ThreadSummary {
  return {
    name: overrides.name ?? overrides.id,
    updatedAt: overrides.updatedAt ?? 1,
    engineSource: overrides.engineSource ?? "codex",
    threadKind: overrides.threadKind ?? "native",
    ...overrides,
  };
}

describe("sidebarEngineRail", () => {
  it("puts Shared first and omits empty engines", () => {
    const threads = [
      thread({ id: "codex-1", engineSource: "codex" }),
      thread({ id: "shared:1", threadKind: "shared", engineSource: "claude" }),
      thread({ id: "claude:1", engineSource: "claude" }),
    ];
    expect(collectSidebarEngineRails(threads)).toEqual(["shared", "claude", "codex"]);
    const remembered = collectSidebarEngineRails(
      [thread({ id: "pi:1", engineSource: "pi" })],
      "ws-remember",
    );
    expect(remembered).toEqual(["pi"]);
    expect(
      collectSidebarEngineRails(
        [thread({ id: "shared:1", threadKind: "shared" })],
        "ws-remember",
      ),
    ).toEqual(["shared"]);
    expect(
      collectSidebarEngineRails([], "ws-remember"),
    ).toEqual(["shared", "pi"]);
  });

  it("filters one rail without dropping same-engine children", () => {
    const threads = [
      thread({ id: "codex-parent", engineSource: "codex" }),
      thread({
        id: "codex-child",
        engineSource: "codex",
        parentThreadId: "codex-parent",
      }),
      thread({ id: "shared:1", threadKind: "shared" }),
    ];
    const codex = filterThreadsForEngineRail(threads, "codex");
    expect(codex.map((row) => row.id)).toEqual(["codex-parent", "codex-child"]);
  });

  it("keeps an unlabeled parent so a Claude child can stay indented", () => {
    const threads = [
      thread({ id: "thread-parent", name: "Parent" }),
      thread({
        id: "claude:child",
        engineSource: "claude",
        parentThreadId: "thread-parent",
      }),
    ];
    const claude = filterThreadsForEngineRail(threads, "claude");
    expect(claude.map((row) => row.id)).toEqual(["thread-parent", "claude:child"]);
  });

  it("follows a newly activated Codex pending thread onto the Codex rail", () => {
    const threads = [
      thread({ id: "shared:1", threadKind: "shared" }),
      thread({ id: "codex-pending-1", engineSource: "codex" }),
    ];
    expect(
      resolveRailForActiveThreadChange({
        previousActiveThreadId: "shared:1",
        nextActiveThreadId: "codex-pending-1",
        threads,
      }),
    ).toBe("codex");
    expect(
      resolveRailForActiveThreadChange({
        previousActiveThreadId: "codex-pending-1",
        nextActiveThreadId: "codex-pending-1",
        threads,
      }),
    ).toBeNull();
  });

  it("treats shared: prefix as Shared even if engineSource is native", () => {
    expect(
      resolveSidebarRailId(
        thread({ id: "shared:abc", engineSource: "codex", threadKind: "native" }),
      ),
    ).toBe("shared");
  });
});
