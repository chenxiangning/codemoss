/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  catalogManifestStub,
  listLocalLockfile,
  LOCAL_PLUGIN_STAGE_KEY,
  stageLocalPlugin,
  unstageLocalPlugin,
} from "./pluginLocalStage";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(currentDir, "../../..");

describe("pluginLocalStage", () => {
  it("stages a local package after install preview without activating Host", () => {
    localStorage.clear();
    const result = stageLocalPlugin("com.mossx.notes");
    expect(result.ok).toBe(true);
    expect(result.pluginId).toBe("com.mossx.notes");
    expect(result.staged).toBe(true);
    expect(result.previewed).toBe(true);
    expect(result.activatedHost).toBe(false);
    expect(result.version).toBe("1.0.0");
    expect(result.artifactHash).toMatch(/^local-/);
    const notesHash = catalogManifestStub("com.mossx.notes")
      ? listLocalLockfile()[0]?.artifactHash
      : undefined;
    expect(listLocalLockfile()).toEqual([
      { pluginId: "com.mossx.notes", version: "1.0.0", artifactHash: notesHash },
    ]);
    expect(notesHash).toMatch(/^local-/);
    const stub = catalogManifestStub("com.mossx.notes");
    expect(stub?.entries).toEqual([]);
    expect(stub?.capabilities.map((item) => item.id)).toEqual([
      "mossx.ui.slot.workspace.main",
      "mossx.storage.readwrite",
    ]);
    const registry = readFileSync(join(repoRoot, "src-tauri/src/command_registry.rs"), "utf8");
    expect(registry).toContain("get_plugin_rack_snapshot");
    expect(registry).not.toContain("activate_plugin");
    expect(registry).not.toContain("install_plugin");
  });

  it("unstages without deleting product source", () => {
    localStorage.clear();
    stageLocalPlugin("com.mossx.kanban");
    const result = unstageLocalPlugin("com.mossx.kanban");
    expect(result.staged).toBe(false);
    expect(listLocalLockfile()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(LOCAL_PLUGIN_STAGE_KEY) ?? "[]")).toEqual([]);
    expect(readFileSync(join(repoRoot, "src/features/kanban/types.ts"), "utf8")).toContain("KanbanTaskStatus");
  });

  it("rejects undeclared capabilities without writing a lockfile row", () => {
    localStorage.clear();
    const result = stageLocalPlugin("com.mossx.notes", ["mossx.filesystem.raw"]);
    expect(result.ok).toBe(false);
    expect(result.previewed).toBe(true);
    expect(result.staged).toBe(false);
    expect(listLocalLockfile()).toEqual([]);
  });

  it("rejects a conflicting artifactHash for the same pluginId+version", () => {
    localStorage.clear();
    const first = stageLocalPlugin("com.mossx.notes");
    const conflict = stageLocalPlugin("com.mossx.notes", [], "local-deadbeef");
    expect(first.ok).toBe(true);
    expect(conflict.ok).toBe(false);
    expect(listLocalLockfile()).toEqual([
      { pluginId: "com.mossx.notes", version: "1.0.0", artifactHash: first.artifactHash },
    ]);
  });

  it("rejects an unknown pluginId without writing a lockfile row", () => {
    localStorage.clear();
    const result = stageLocalPlugin("com.unknown.plugin");
    expect(result.ok).toBe(false);
    expect(result.staged).toBe(false);
    expect(listLocalLockfile()).toEqual([]);
  });
});
