import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MOSSX_CAPABILITIES } from "./catalog";
import { parseManifestV1 } from "./parseManifestV1";
import type { ManifestErrorCode, ParseManifestOptions } from "./types";
import notesMinimal from "../../packages/plugin-contract/fixtures/valid/notes-minimal.json";
import notesPilot from "../../packages/plugin-contract/fixtures/valid/notes-pilot.json";
import claudeEngine from "../../packages/plugin-contract/fixtures/valid/claude-engine.json";
import projectMapPilot from "../../packages/plugin-contract/fixtures/valid/project-map-pilot.json";
import kanbanPlugin from "../../packages/plugin-kanban/.mossx-plugin/plugin.json";
import notesPlugin from "../../packages/plugin-notes/.mossx-plugin/plugin.json";
import projectMapPlugin from "../../packages/plugin-project-map/.mossx-plugin/plugin.json";
import browserPlugin from "../../packages/plugin-browser/.mossx-plugin/plugin.json";
import intentCanvasPlugin from "../../packages/plugin-intent-canvas/.mossx-plugin/plugin.json";
import codexPlugin from "../../packages/plugin-engine-codex/.mossx-plugin/plugin.json";
import geminiPlugin from "../../packages/plugin-engine-gemini/.mossx-plugin/plugin.json";
import grokPlugin from "../../packages/plugin-engine-grok/.mossx-plugin/plugin.json";
import kimiPlugin from "../../packages/plugin-engine-kimi/.mossx-plugin/plugin.json";
import opencodePlugin from "../../packages/plugin-engine-opencode/.mossx-plugin/plugin.json";
import piPlugin from "../../packages/plugin-engine-pi/.mossx-plugin/plugin.json";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const contractRoot = join(fixtureDir, "../../packages/plugin-contract");

const systemOpts: ParseManifestOptions = {
  trustTier: "system",
  currentPlatform: "darwin-arm64",
  coreContract: "1.0.0",
  startupAllowlist: ["com.mossx.notes"],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("parseManifestV1", () => {
  it("accepts the claude engine pilot manifest", () => {
    const result = parseManifestV1(claudeEngine, systemOpts);
    expect(result.ok).toBe(true);
    expect(result.manifest?.pluginId).toBe("com.mossx.engine.claude");
    expect(result.manifest?.contributions.some((item) => item.type === "mossx.engine.provider")).toBe(true);
    expect(result.manifest?.activationUnits[0]?.events.some((event) => event.type === "onEngine")).toBe(true);
    expect(JSON.stringify(claudeEngine)).not.toMatch(/onStartup|trusted-react/);
  });

  it("accepts the in-repo kanban package layer without installing it", () => {
    const result = parseManifestV1(kanbanPlugin, systemOpts);
    expect(result.ok).toBe(true);
    expect(result.manifest?.pluginId).toBe("com.mossx.kanban");
    expect(result.manifest?.contributions.some((item) => item.id === "kanban.main")).toBe(true);
    const boot = readFileSync(join(fixtureDir, "../../src-tauri/src/plugin_runtime/boot.rs"), "utf8");
    expect(boot).not.toContain("plugin-kanban");
    expect(boot).not.toContain("com.mossx.kanban");
  });

  it("accepts the in-repo notes package layer without migrating product data", () => {
    const result = parseManifestV1(notesPlugin, systemOpts);
    expect(result.ok).toBe(true);
    expect(result.manifest?.pluginId).toBe("com.mossx.notes");
    expect(result.manifest?.contributions.some((item) => item.id === "notes.main")).toBe(true);
    const boot = readFileSync(join(fixtureDir, "../../src-tauri/src/plugin_runtime/boot.rs"), "utf8");
    expect(boot).not.toContain("plugin-notes");
    expect(existsSync(join(fixtureDir, "../../src-tauri/src/note_cards.rs"))).toBe(true);
  });

  it("accepts remaining later-plugin package layers without adding them to boot or the Host rack", () => {
    const remaining = [
      "about",
      "git-history",
      "spec",
      "terminal",
      "skills",
      "web-service",
    ];
    const boot = readFileSync(join(fixtureDir, "../../src-tauri/src/plugin_runtime/boot.rs"), "utf8");
    const rack = readFileSync(join(fixtureDir, "../../src-tauri/src/plugin_rack.rs"), "utf8");
    for (const slug of remaining) {
      const manifest = JSON.parse(
        readFileSync(join(fixtureDir, `../../packages/plugin-${slug}/.mossx-plugin/plugin.json`), "utf8"),
      );
      const result = parseManifestV1(manifest, systemOpts);
      expect(result.ok).toBe(true);
      expect(result.manifest?.pluginId).toBe(`com.mossx.${slug}`);
      expect(boot).not.toContain(`plugin-${slug}`);
      expect(rack).not.toContain(`com.mossx.${slug}`);
    }
  });

  it("accepts later feature package layers without installing them", () => {
    const later = [
      { manifest: projectMapPlugin, pluginId: "com.mossx.project-map" },
      { manifest: browserPlugin, pluginId: "com.mossx.browser" },
      { manifest: intentCanvasPlugin, pluginId: "com.mossx.intent-canvas" },
    ];
    const laterEngines = [
      { manifest: codexPlugin, pluginId: "com.mossx.engine.codex" },
      { manifest: geminiPlugin, pluginId: "com.mossx.engine.gemini" },
      { manifest: grokPlugin, pluginId: "com.mossx.engine.grok" },
      { manifest: kimiPlugin, pluginId: "com.mossx.engine.kimi" },
      { manifest: opencodePlugin, pluginId: "com.mossx.engine.opencode" },
      { manifest: piPlugin, pluginId: "com.mossx.engine.pi" },
    ];
    const boot = readFileSync(join(fixtureDir, "../../src-tauri/src/plugin_runtime/boot.rs"), "utf8");
    for (const item of [...later, ...laterEngines]) {
      const result = parseManifestV1(item.manifest, systemOpts);
      expect(result.ok).toBe(true);
      expect(result.manifest?.pluginId).toBe(item.pluginId);
      expect(boot).not.toContain(item.pluginId);
    }
  });

  it("rejects templated engine providers on the claude fixture", () => {
    const templated = clone(claudeEngine) as Record<string, unknown>;
    templated.contributionTemplates = [
      {
        id: "engines",
        type: "mossx.engine.provider",
        entryId: "claude-worker",
        keyPrefix: "com.mossx.engine.claude.extra.",
        scopes: ["global"],
        maxInstances: 2,
      },
    ];
    expect(parseManifestV1(templated, systemOpts).errors.some((error) => error.code === "template-type-forbidden")).toBe(
      true,
    );
  });

  it("accepts the notes pilot inventory manifest", () => {
    const result = parseManifestV1(notesPilot, systemOpts);
    expect(result.ok).toBe(true);
    expect(result.manifest?.pluginId).toBe("com.mossx.notes");
    const commandIds = (result.manifest?.contributions ?? [])
      .filter((item) => item.type === "mossx.command")
      .map((item) => item.commandId);
    expect(commandIds).toEqual([
      "note_card_list",
      "note_card_get",
      "note_card_create",
      "note_card_update",
      "note_card_archive",
      "note_card_restore",
      "note_card_delete",
    ]);
    expect(result.manifest?.contributions.some((item) => item.type === "mossx.ui.view")).toBe(true);
    expect(result.manifest?.contributions.some((item) => item.type === "mossx.engine.provider")).toBe(false);
    expect(JSON.stringify(notesPilot)).not.toMatch(/onStartup/);
  });

  it("rejects templated notes commands", () => {
    const templated = clone(notesPilot) as Record<string, unknown>;
    templated.contributionTemplates = [
      {
        id: "notes-commands",
        type: "mossx.command",
        entryId: "notes-worker",
        keyPrefix: "com.mossx.notes.extra.",
        scopes: ["global"],
        maxInstances: 2,
      },
    ];
    expect(
      parseManifestV1(templated, systemOpts).errors.some((error) => error.code === "template-type-forbidden"),
    ).toBe(true);
  });

  it("accepts the project-map pilot inventory manifest", () => {
    const result = parseManifestV1(projectMapPilot, systemOpts);
    expect(result.ok).toBe(true);
    expect(result.manifest?.pluginId).toBe("com.mossx.project-map");
    const commandIds = (result.manifest?.contributions ?? [])
      .filter((item) => item.type === "mossx.command")
      .map((item) => item.commandId);
    expect(commandIds).toEqual([
      "project_map_read",
      "project_map_write_snapshot",
      "project_map_relationship_scan",
      "project_map_relationship_read",
      "project_map_relationship_write_snapshot",
      "project_map_relationship_clear",
      "project_memory_get_settings",
      "project_memory_update_settings",
      "project_memory_list",
      "project_memory_get",
      "project_memory_create",
      "project_memory_update",
      "project_memory_delete",
      "project_memory_diagnostics",
      "project_memory_reconcile",
      "project_memory_capture_auto",
      "project_memory_embed_health",
      "project_memory_embed_text",
      "project_memory_embed_download",
      "project_memory_embed_remove",
      "project_memory_embed_index_list",
      "project_memory_embed_index_upsert",
      "project_memory_embed_index_delete",
      "project_memory_embed_index_clear",
    ]);
    expect(result.manifest?.contributions.some((item) => item.id === "project-map.main" && item.type === "mossx.ui.view")).toBe(
      true,
    );
    expect(
      result.manifest?.contributions.some((item) => item.id === "project-map.memory" && item.type === "mossx.ui.panel"),
    ).toBe(true);
    expect(result.manifest?.contributions.some((item) => item.type === "mossx.engine.provider")).toBe(false);
    expect(JSON.stringify(projectMapPilot)).not.toMatch(/onStartup|memoryPick|memory-pick/);
  });

  it("rejects templated project-map commands", () => {
    const templated = clone(projectMapPilot) as Record<string, unknown>;
    templated.contributionTemplates = [
      {
        id: "project-map-commands",
        type: "mossx.command",
        entryId: "project-map-worker",
        keyPrefix: "com.mossx.project-map.extra.",
        scopes: ["global"],
        maxInstances: 2,
      },
    ];
    expect(
      parseManifestV1(templated, systemOpts).errors.some((error) => error.code === "template-type-forbidden"),
    ).toBe(true);
  });

  it("keeps the project-map package facade as a one-view door", () => {
    const facadeCommands = (projectMapPlugin.contributions ?? []).filter(
      (item: { type?: string }) => item.type === "mossx.command",
    );
    expect(projectMapPlugin.contributions).toHaveLength(1);
    expect(projectMapPlugin.contributions[0]).toMatchObject({
      id: "project-map.main",
      type: "mossx.ui.view",
    });
    expect(facadeCommands).toHaveLength(0);
    expect(projectMapPlugin.contributions.some((item: { id?: string }) => item.id === "project-map.memory")).toBe(
      false,
    );
  });

  it("accepts the notes minimal manifest", () => {
    const result = parseManifestV1(notesMinimal, systemOpts);
    expect(result.ok).toBe(true);
    expect(result.manifest?.pluginId).toBe("com.mossx.notes");
    expect(result.manifest?.requiredClosureByUnit["notes-main"]).toEqual(
      expect.arrayContaining(["notes-worker", "notes-ui"]),
    );
  });

  it("treats displayName as non-identity", () => {
    const renamed = clone(notesMinimal);
    renamed.displayName = "便签";
    const left = parseManifestV1(notesMinimal, systemOpts);
    const right = parseManifestV1(renamed, systemOpts);
    expect(left.manifest?.pluginId).toBe(right.manifest?.pluginId);
  });

  it("rejects unknown top-level fields", () => {
    const bad = clone(notesMinimal) as Record<string, unknown>;
    bad.extraHook = true;
    const result = parseManifestV1(bad, systemOpts);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.code === "unknown-field")).toBe(true);
  });

  it("rejects unbounded coreApi", () => {
    const bad = clone(notesMinimal);
    bad.compatibility.coreApi = "*";
    expect(parseManifestV1(bad, systemOpts).errors.some((error) => error.code === "unbounded-core-api")).toBe(true);
  });

  it("rejects unknown kind and event", () => {
    const kind = clone(notesMinimal);
    kind.entries[0].kind = "sidecar";
    expect(parseManifestV1(kind, systemOpts).errors.some((error) => error.code === "unknown-kind")).toBe(true);

    const event = clone(notesMinimal);
    event.activationUnits[0].events[0].type = "onFile";
    expect(parseManifestV1(event, systemOpts).errors.some((error) => error.code === "unknown-event")).toBe(true);
  });

  it("rejects cycles, dangling ids, and migration in units", () => {
    const cycle = clone(notesMinimal);
    cycle.entries[0].dependsOn = [{ entryId: "notes-ui", criticality: "required" }];
    expect(parseManifestV1(cycle, systemOpts).errors.some((error) => error.code === "cyclic-depends-on")).toBe(true);

    const dangling = clone(notesMinimal);
    dangling.activationUnits[0].entries.push("missing-entry");
    expect(parseManifestV1(dangling, systemOpts).errors.some((error) => error.code === "dangling-entry-id")).toBe(true);

    const migration = clone(notesMinimal);
    migration.activationUnits[0].entries.push("schema-v2");
    expect(parseManifestV1(migration, systemOpts).errors.some((error) => error.code === "migration-in-unit")).toBe(true);
  });

  it("rejects onStartup unless allowlisted system", () => {
    const bad = clone(notesMinimal);
    (bad.activationUnits[0].events as Array<{ type: string }>).push({ type: "onStartup" });
    const local = parseManifestV1(bad, { ...systemOpts, trustTier: "local", startupAllowlist: [] });
    expect(local.errors.some((error) => error.code === "on-startup-not-allowlisted")).toBe(true);
  });

  it("rejects trusted-react for non-system and engine templates", () => {
    const trusted = parseManifestV1(notesMinimal, { ...systemOpts, trustTier: "verified" });
    expect(trusted.errors.some((error) => error.code === "trusted-react-not-system")).toBe(true);

    const templated = clone(notesMinimal) as Record<string, unknown>;
    templated.contributionTemplates = [
      {
        id: "engines",
        type: "mossx.engine.provider",
        entryId: "notes-worker",
        keyPrefix: "com.mossx.notes.engine.",
        scopes: ["global"],
        maxInstances: 2,
      },
    ];
    expect(
      parseManifestV1(templated, systemOpts).errors.some((error) => error.code === "template-type-forbidden"),
    ).toBe(true);
  });

  it("rejects unknown mossx capability and foreign private capability", () => {
    const unknown = clone(notesMinimal);
    unknown.capabilities.push({ id: "mossx.filesystem.raw", role: "consumer" });
    expect(parseManifestV1(unknown, systemOpts).errors.some((error) => error.code === "unknown-capability")).toBe(true);

    const foreign = clone(notesMinimal);
    foreign.capabilities.push({ id: "com.other.plugin.private.x", role: "consumer" });
    expect(
      parseManifestV1(foreign, systemOpts).errors.some((error) => error.code === "foreign-private-capability"),
    ).toBe(true);
  });

  it("rejects hash conflicts for the same pluginId+version", () => {
    const result = parseManifestV1(notesMinimal, {
      ...systemOpts,
      artifactHash: "bbb",
      knownHashes: { "com.mossx.notes@1.0.0": "aaa" },
    });
    expect(result.errors.some((error) => error.code === "hash-conflict")).toBe(true);
  });

  it("does not import filesystem APIs in the parser module", () => {
    const source = readFileSync(join(fixtureDir, "parseManifestV1.ts"), "utf8");
    expect(source).not.toMatch(/node:fs|readFileSync|fs\.promises/);
    const asString = readFileSync(join(contractRoot, "fixtures/valid/notes-minimal.json"), "utf8");
    expect(parseManifestV1(asString, systemOpts).ok).toBe(true);
  });

  it("rejects each contract invalid fixture with a stable code", () => {
    const expected: Record<string, ManifestErrorCode> = {
      "unknown-field": "unknown-field",
      "unknown-event": "unknown-event",
      "unknown-kind": "unknown-kind",
      cycle: "cyclic-depends-on",
      "dangling-entry-id": "dangling-entry-id",
      "unbounded-core-api": "unbounded-core-api",
      "on-startup-not-allowlisted": "on-startup-not-allowlisted",
      "trusted-react-local": "trusted-react-not-system",
      "template-type-forbidden": "template-type-forbidden",
      "template-overlap": "template-overlap",
      "foreign-private-capability": "foreign-private-capability",
      "missing-platform": "missing-platform",
      "migration-in-unit": "migration-in-unit",
    };
    const names = readdirSync(join(contractRoot, "fixtures/invalid"))
      .filter((name) => name.endsWith(".json"))
      .map((name) => name.replace(/\.json$/, ""));
    expect(names.sort()).toEqual(Object.keys(expected).sort());
    for (const name of names) {
      const fixture = JSON.parse(
        readFileSync(join(contractRoot, "fixtures/invalid", `${name}.json`), "utf8"),
      ) as unknown;
      const opts =
        name === "trusted-react-local" || name === "on-startup-not-allowlisted"
          ? { ...systemOpts, trustTier: "local" as const, startupAllowlist: [] }
          : systemOpts;
      const result = parseManifestV1(fixture, opts);
      expect(result.ok, name).toBe(false);
      expect(result.errors.some((error) => error.code === expected[name]), name).toBe(true);
    }
  });

  it("keeps the capability catalog aligned with contract ids", () => {
    const catalog = JSON.parse(
      readFileSync(join(contractRoot, "schemas/capabilities/ids.v1.json"), "utf8"),
    ) as { capabilities: Array<{ id: string }> };
    expect(catalog.capabilities.map((item) => item.id)).toEqual([...MOSSX_CAPABILITIES]);
  });
});
