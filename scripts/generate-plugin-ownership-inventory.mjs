import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const outPath = path.join(
  root,
  "docs/architecture/plugin-platform/inventory/ownership.json",
);

const PILOT = {
  "src/features/note-cards": {
    ownerClass: "pilot",
    targetPluginId: "com.mossx.notes",
    deleteGate: "after-pilot-disable",
  },
  "src-tauri/src/note_cards.rs": {
    ownerClass: "pilot",
    targetPluginId: "com.mossx.notes",
    deleteGate: "after-pilot-disable",
  },
  "src-tauri/src/engine/claude.rs": {
    ownerClass: "pilot",
    targetPluginId: "com.mossx.engine.claude",
    deleteGate: "after-pilot-disable",
  },
  "src-tauri/src/engine/claude": {
    ownerClass: "pilot",
    targetPluginId: "com.mossx.engine.claude",
    deleteGate: "after-pilot-disable",
  },
};

const CORE_FRONTEND = new Set([
  "app",
  "commons",
  "composer",
  "engine",
  "engine-task-output",
  "extensions",
  "files",
  "git",
  "home",
  "layout",
  "markdown",
  "messages",
  "notifications",
  "search",
  "session-activity",
  "session-side-effects",
  "settings",
  "startup-orchestration",
  "theme",
  "threads",
  "update",
  "workspaces",
]);

const LATER_FRONTEND = {
  "browser-agent": "com.mossx.browser",
  "intent-canvas": "com.mossx.intent-canvas",
  "project-map": "com.mossx.project-map",
  "project-memory": "com.mossx.project-map",
  "codex": "com.mossx.engine.codex",
  "opencode": "com.mossx.engine.opencode",
  "git-history": "com.mossx.git-history",
  "kanban": "com.mossx.kanban",
  "spec": "com.mossx.spec",
  "multi-agent": "com.mossx.multi-agent",
  "collaboration": "com.mossx.collaboration",
  "shared-session": "com.mossx.shared-session",
  "computer-use": "com.mossx.computer-use",
  "dictation": "com.mossx.dictation",
  "agent-catalog": "com.mossx.agent-catalog",
  "curated-skills": "com.mossx.skills",
  "skills": "com.mossx.skills",
  "vendors": "com.mossx.vendors",
  "models": "com.mossx.models",
  "runtime-log": "com.mossx.runtime-log",
  "status-panel": "com.mossx.status",
};

const CORE_RUST_TOP = new Set([
  "app_paths.rs",
  "backend",
  "backend_budget.rs",
  "client_error_log.rs",
  "client_storage.rs",
  "command_registry.rs",
  "diagnostics_bundle.rs",
  "engine_policy.rs",
  "event_sink.rs",
  "files",
  "git",
  "git_utils.rs",
  "input_history.rs",
  "lib.rs",
  "linux_startup_guard.rs",
  "main.rs",
  "menu.rs",
  "renderer_stability.rs",
  "runtime",
  "session_index",
  "session_management.rs",
  "session_management_archive_delete_tests.rs",
  "session_management_archive_evidence.rs",
  "session_management_attribution_tests.rs",
  "session_management_batch_assign.rs",
  "session_management_catalog_helpers.rs",
  "session_management_catalog_projection.rs",
  "session_management_folder_assignment_tests.rs",
  "session_management_folder_counts.rs",
  "session_management_folder_tests.rs",
  "session_management_metadata_provider_tests.rs",
  "session_management_projection_tests.rs",
  "session_management_provider_binding_tests.rs",
  "session_management_provider_continuation_tests.rs",
  "session_management_related.rs",
  "session_management_test_support.rs",
  "session_management_tests.rs",
  "session_management_types.rs",
  "session_management_workspace_scope_tests.rs",
  "settings",
  "snapshot_throttle.rs",
  "startup_guard.rs",
  "state.rs",
  "storage.rs",
  "system_notification.rs",
  "text_encoding.rs",
  "types.rs",
  "utils.rs",
  "window.rs",
  "workspaces",
]);

const LATER_RUST = {
  "browser_agent": "com.mossx.browser",
  "note_cards.rs": "com.mossx.notes",
  "project_canvas.rs": "com.mossx.intent-canvas",
  "project_map.rs": "com.mossx.project-map",
  "project_map_api_contracts.rs": "com.mossx.project-map",
  "project_map_api_contracts_identity.rs": "com.mossx.project-map",
  "project_map_api_contracts_schema_sources.rs": "com.mossx.project-map",
  "project_map_api_contracts_tests.rs": "com.mossx.project-map",
  "project_map_api_contracts_types.rs": "com.mossx.project-map",
  "project_map_relations": "com.mossx.project-map",
  "project_map_relations.rs": "com.mossx.project-map",
  "project_memory": "com.mossx.project-map",
  "computer_use": "com.mossx.computer-use",
  "dictation": "com.mossx.dictation",
  "email": "com.mossx.email",
  "web_service": "com.mossx.web-service",
  "agent_catalog.rs": "com.mossx.agent-catalog",
  "curated_skills.rs": "com.mossx.skills",
  "skills.rs": "com.mossx.skills",
  "skills_hub.rs": "com.mossx.skills",
  "vendors": "com.mossx.vendors",
  "tokentracker.rs": "com.mossx.status",
  "local_usage.rs": "com.mossx.status",
  "local_usage": "com.mossx.status",
  "runtime_log": "com.mossx.runtime-log",
};

const ENGINE_CORE = new Set([
  "adapter_registry.rs",
  "agent_event_bus.rs",
  "capability_matrix.rs",
  "capability_matrix.generated.rs",
  "commands.rs",
  "commands_parse_helpers.rs",
  "commands_tests.rs",
  "error_mapper.rs",
  "events.rs",
  "lifecycle.rs",
  "manager.rs",
  "mod.rs",
  "remote_bridge.rs",
  "rewind_commands.rs",
  "session_directory_grant.rs",
  "session_history_commands.rs",
  "status.rs",
  "task_output.rs",
  "user_input.rs",
  "cli_image_input.rs",
]);

const ENGINE_PILOT = {
  "claude.rs": "com.mossx.engine.claude",
  "claude": "com.mossx.engine.claude",
  "claude_forwarder.rs": "com.mossx.engine.claude",
  "claude_history.rs": "com.mossx.engine.claude",
  "claude_history_delete_tests.rs": "com.mossx.engine.claude",
  "claude_history_entries.rs": "com.mossx.engine.claude",
  "claude_history_filter_tests.rs": "com.mossx.engine.claude",
  "claude_history_fork_tests.rs": "com.mossx.engine.claude",
  "claude_history_inline_tests.rs": "com.mossx.engine.claude",
  "claude_history_issue529_tests.rs": "com.mossx.engine.claude",
  "claude_history_large_payload.rs": "com.mossx.engine.claude",
  "claude_history_large_payload_tests.rs": "com.mossx.engine.claude",
  "claude_history_list_budget_tests.rs": "com.mossx.engine.claude",
  "claude_history_subagents.rs": "com.mossx.engine.claude",
  "claude_message_content.rs": "com.mossx.engine.claude",
  "claude_stream_helpers.rs": "com.mossx.engine.claude",
};

const ENGINE_LATER = {
  "codex_adapter.rs": "com.mossx.engine.codex",
  "codex_prompt_service.rs": "com.mossx.engine.codex",
  "gemini.rs": "com.mossx.engine.gemini",
  "gemini_event_parsing.rs": "com.mossx.engine.gemini",
  "gemini_history.rs": "com.mossx.engine.gemini",
  "gemini_proxy_guard.rs": "com.mossx.engine.gemini",
  "gemini_tests.rs": "com.mossx.engine.gemini",
  "grok.rs": "com.mossx.engine.grok",
  "grok_history.rs": "com.mossx.engine.grok",
  "grok_provider_profile.rs": "com.mossx.engine.grok",
  "kimi.rs": "com.mossx.engine.kimi",
  "kimi_history.rs": "com.mossx.engine.kimi",
  "kimi_provider_profile.rs": "com.mossx.engine.kimi",
  "opencode.rs": "com.mossx.engine.opencode",
  "opencode_provider_profile.rs": "com.mossx.engine.opencode",
  "commands_opencode.rs": "com.mossx.engine.opencode",
  "commands_opencode_helpers.rs": "com.mossx.engine.opencode",
  "pi.rs": "com.mossx.engine.pi",
  "pi_auth.rs": "com.mossx.engine.pi",
  "pi_history.rs": "com.mossx.engine.pi",
  "pi_provider_profile.rs": "com.mossx.engine.pi",
};

function listNames(relDir) {
  return fs
    .readdirSync(path.join(root, relDir), { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function owner({ id, layer, path: ownerPath, ownerClass, targetPluginId = null, deleteGate, notes }) {
  return {
    id,
    layer,
    path: ownerPath,
    ownerClass,
    targetPluginId,
    commands: [],
    stores: [],
    dataPaths: [],
    deleteGate,
    notes,
  };
}

function classifyFrontend(name) {
  const rel = `src/features/${name}`;
  if (PILOT[rel]) return { ...PILOT[rel], notes: "Wave 4 Feature Pilot" };
  if (CORE_FRONTEND.has(name)) {
    return { ownerClass: "core", targetPluginId: null, deleteGate: "never", notes: "Core product foundation" };
  }
  if (LATER_FRONTEND[name]) {
    return {
      ownerClass: "later-plugin",
      targetPluginId: LATER_FRONTEND[name],
      deleteGate: "after-pilot-disable",
      notes: "Stay in tree until its own Wave",
    };
  }
  return {
    ownerClass: "later-plugin",
    targetPluginId: `com.mossx.${name}`,
    deleteGate: "after-pilot-disable",
    notes: "Default later-plugin until a dedicated Wave reclassifies it",
  };
}

function classifyRustTop(name) {
  const rel = `src-tauri/src/${name}`;
  if (PILOT[rel]) return { ...PILOT[rel], notes: "Wave 4 Feature Pilot" };
  if (CORE_RUST_TOP.has(name)) {
    return { ownerClass: "core", targetPluginId: null, deleteGate: "never", notes: "Core host / session / workspace" };
  }
  if (LATER_RUST[name]) {
    return {
      ownerClass: "later-plugin",
      targetPluginId: LATER_RUST[name],
      deleteGate: "after-pilot-disable",
      notes: "Stay in tree until its own Wave",
    };
  }
  if (name.startsWith("claude_")) {
    return {
      ownerClass: "pilot",
      targetPluginId: "com.mossx.engine.claude",
      deleteGate: "after-pilot-disable",
      notes: "Claude compatibility surface outside engine/",
    };
  }
  if (name.startsWith("codex")) {
    return {
      ownerClass: "later-plugin",
      targetPluginId: "com.mossx.engine.codex",
      deleteGate: "after-pilot-disable",
      notes: "Codex-specific rust owner",
    };
  }
  return {
    ownerClass: "later-plugin",
    targetPluginId: null,
    deleteGate: "after-pilot-disable",
    notes: "Unclassified rust top-level; treat as later-plugin until Wave review",
  };
}

function classifyEngine(name) {
  const rel = `src-tauri/src/engine/${name}`;
  if (ENGINE_CORE.has(name)) {
    return { ownerClass: "core", targetPluginId: null, deleteGate: "never", notes: "Engine Contract / control plane" };
  }
  if (ENGINE_PILOT[name]) {
    return {
      ownerClass: "pilot",
      targetPluginId: ENGINE_PILOT[name],
      deleteGate: "after-pilot-disable",
      notes: "Wave 3 Engine Pilot",
    };
  }
  if (ENGINE_LATER[name]) {
    return {
      ownerClass: "later-plugin",
      targetPluginId: ENGINE_LATER[name],
      deleteGate: "after-pilot-disable",
      notes: "Concrete CLI; do not copy back into Core after extraction",
    };
  }
  if (PILOT[rel]) return { ...PILOT[rel], notes: "Wave 3 Engine Pilot" };
  return {
    ownerClass: "later-plugin",
    targetPluginId: null,
    deleteGate: "after-pilot-disable",
    notes: "Unclassified engine module",
  };
}

const owners = [];

for (const name of listNames("src/features")) {
  const classified = classifyFrontend(name);
  owners.push(
    owner({
      id: `frontend.${name}`,
      layer: "frontend",
      path: `src/features/${name}`,
      ...classified,
    }),
  );
}

owners.push(
  owner({
    id: "frontend.app-shell",
    layer: "frontend",
    path: "src/app-shell",
    ownerClass: "core",
    targetPluginId: null,
    deleteGate: "never",
    notes: "App Shell assembly; plugins must not import internals",
  }),
);

for (const name of listNames("src-tauri/src")) {
  if (name === "engine" || name === "bin") continue;
  const classified = classifyRustTop(name);
  owners.push(
    owner({
      id: `rust.${name.replace(/\./g, "_")}`,
      layer: "rust",
      path: `src-tauri/src/${name}`,
      ...classified,
    }),
  );
}

for (const name of listNames("src-tauri/src/engine")) {
  const classified = classifyEngine(name);
  owners.push(
    owner({
      id: `rust.engine.${name.replace(/\./g, "_")}`,
      layer: "rust",
      path: `src-tauri/src/engine/${name}`,
      ...classified,
    }),
  );
}

const claudeCount = owners.filter((row) => row.targetPluginId === "com.mossx.engine.claude").length;
const notesCount = owners.filter((row) => row.targetPluginId === "com.mossx.notes").length;
if (claudeCount < 1 || notesCount < 1) {
  throw new Error(`pilot identity missing: claude=${claudeCount} notes=${notesCount}`);
}

const payload = {
  version: 1,
  generatedFrom: "feature/plugin-mossx-0.8.9 working tree",
  notes:
    "Wave 0A inventory. Product code stays. retired-unreferenced is empty. Soft later-plugin imports do not fail CI yet.",
  owners,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
process.stdout.write(
  `wrote ${owners.length} owners (${claudeCount} claude rows, ${notesCount} notes rows) -> ${path.relative(root, outPath)}\n`,
);
