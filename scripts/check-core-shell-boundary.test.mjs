import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const script = path.join(here, "check-core-shell-boundary.mjs");

function runCheck(cwd) {
  return spawnSync(process.execPath, [script], {
    cwd,
    encoding: "utf8",
  });
}

test("current worktree passes the inventory-backed boundary check", () => {
  const result = runCheck(repoRoot);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /ok \(/);
});

function listNames(dir) {
  return fs.readdirSync(dir).filter((name) => !name.startsWith("."));
}

function owner(id, ownerPath, ownerClass, targetPluginId = null) {
  return {
    id,
    layer: ownerPath.startsWith("src/features") ? "frontend" : "rust",
    path: ownerPath,
    ownerClass,
    targetPluginId,
    commands: [],
    stores: [],
    dataPaths: [],
    deleteGate: ownerClass === "retired-unreferenced" ? "when-unreferenced" : "never",
    notes: "fixture",
  };
}

test("forged AppShell import of a retired owner fails hard", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "core-shell-boundary-"));
  for (const rel of ["src/features", "src-tauri/src/engine"]) {
    fs.cpSync(path.join(repoRoot, rel), path.join(tmp, rel), { recursive: true });
  }
  fs.mkdirSync(path.join(tmp, "docs/architecture/plugin-platform/inventory"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(repoRoot, "docs/architecture/plugin-platform/inventory/ownership.schema.json"),
    path.join(tmp, "docs/architecture/plugin-platform/inventory/ownership.schema.json"),
  );
  fs.mkdirSync(path.join(tmp, "scripts"), { recursive: true });
  fs.copyFileSync(script, path.join(tmp, "scripts/check-core-shell-boundary.mjs"));

  fs.mkdirSync(path.join(tmp, "src/app-shell/assembly"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "src/app-shell/assembly/AppShell.tsx"),
    'import "../../features/ghost-retired/index.ts";\nexport const AppShell = () => null;\n',
  );
  fs.mkdirSync(path.join(tmp, "src/features/ghost-retired"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src/features/ghost-retired/index.ts"), "export {}\n");

  const owners = [
    ...listNames(path.join(tmp, "src/features")).map((name) =>
      owner(
        `frontend.${name}`,
        `src/features/${name}`,
        name === "note-cards" ? "pilot" : name === "ghost-retired" ? "retired-unreferenced" : "later-plugin",
        name === "note-cards" ? "com.mossx.notes" : null,
      ),
    ),
    ...listNames(path.join(tmp, "src-tauri/src/engine")).map((name) =>
      owner(
        `rust.engine.${name}`,
        `src-tauri/src/engine/${name}`,
        name.startsWith("claude") ? "pilot" : "core",
        name.startsWith("claude") ? "com.mossx.engine.claude" : null,
      ),
    ),
  ];
  fs.writeFileSync(
    path.join(tmp, "docs/architecture/plugin-platform/inventory/ownership.json"),
    `${JSON.stringify({ version: 1, generatedFrom: "fixture", owners }, null, 2)}\n`,
  );

  const result = runCheck(tmp);
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, /retired-unreferenced/);
});
