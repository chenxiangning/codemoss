import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const inventoryPath = path.join(
  root,
  "docs/architecture/plugin-platform/inventory/ownership.json",
);
const schemaPath = path.join(
  root,
  "docs/architecture/plugin-platform/inventory/ownership.schema.json",
);

const PRODUCTION_ROOTS = [
  "src/app-shell",
  "src/app-shell-parts",
  "src/features",
  "src/services",
  "src/bootstrapApp.tsx",
  "src/bootstrap.ts",
  "src/main.tsx",
  "src/App.tsx",
  "src/router.tsx",
  "src-tauri/src",
];

const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".rs"]);

function fail(message) {
  throw new Error(`[core-shell-boundary] ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walkFiles(target, files = []) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walkFiles(path.join(target, entry.name), files);
    }
    return files;
  }
  if (TEXT_EXT.has(path.extname(target))) files.push(target);
  return files;
}

function collectProductionFiles() {
  const files = [];
  for (const rel of PRODUCTION_ROOTS) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    walkFiles(abs, files);
  }
  return files;
}

function posixRel(abs) {
  return path.relative(root, abs).split(path.sep).join("/");
}

function ownerMatchesPath(ownerPath, fileRel) {
  if (fileRel === ownerPath) return true;
  return fileRel.startsWith(`${ownerPath.replace(/\/$/, "")}/`);
}

function validateInventoryShape(inventory) {
  if (inventory.version !== 1) fail("inventory.version must be 1");
  if (!Array.isArray(inventory.owners) || inventory.owners.length === 0) {
    fail("inventory.owners must be a non-empty array");
  }
  const classes = new Set(["core", "pilot", "later-plugin", "retired-unreferenced"]);
  const ids = new Set();
  for (const owner of inventory.owners) {
    if (!owner.id || ids.has(owner.id)) fail(`duplicate or missing owner id: ${owner.id}`);
    ids.add(owner.id);
    if (!classes.has(owner.ownerClass)) fail(`${owner.id} has invalid ownerClass`);
    if (!owner.path) fail(`${owner.id} missing path`);
    if (!fs.existsSync(path.join(root, owner.path)) && owner.ownerClass !== "retired-unreferenced") {
      fail(`${owner.id} path does not exist: ${owner.path}`);
    }
  }
}

function assertFeatureAndEngineCoverage(inventory) {
  const featureDirs = fs
    .readdirSync(path.join(root, "src/features"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `src/features/${entry.name}`);
  const engineNames = fs.readdirSync(path.join(root, "src-tauri/src/engine"));
  const paths = new Set(inventory.owners.map((owner) => owner.path));
  for (const dir of featureDirs) {
    if (!paths.has(dir)) fail(`missing feature directory in inventory: ${dir}`);
  }
  for (const name of engineNames) {
    if (!paths.has(`src-tauri/src/engine/${name}`)) {
      fail(`missing engine module in inventory: src-tauri/src/engine/${name}`);
    }
  }
}

function assertPilotIdentities(inventory) {
  const claude = inventory.owners.filter((owner) => owner.targetPluginId === "com.mossx.engine.claude");
  const notes = inventory.owners.filter((owner) => owner.targetPluginId === "com.mossx.notes");
  if (claude.length < 1) fail("inventory must include com.mossx.engine.claude");
  if (notes.length < 1) fail("inventory must include com.mossx.notes");
}

function scanReferences(files, ownerPath) {
  const needle = ownerPath.replace(/^src\//, "").replace(/^src-tauri\/src\//, "");
  const hits = [];
  const importLike = new RegExp(
    `(?:(?:from|import)\\s+["'][^"']*${escapeRegExp(needle)}|mod\\s+${escapeRegExp(path.basename(ownerPath, path.extname(ownerPath)))}\\s*;)`,
  );
  for (const file of files) {
    const rel = posixRel(file);
    if (ownerMatchesPath(ownerPath, rel)) continue;
    const text = fs.readFileSync(file, "utf8");
    if (text.includes(needle) && importLike.test(text)) {
      hits.push(rel);
    }
  }
  return hits;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rustModuleName(ownerPath) {
  const base = path.basename(ownerPath, path.extname(ownerPath));
  return base.replace(/-/g, "_");
}

try {
  if (!fs.existsSync(inventoryPath)) fail(`missing ${path.relative(root, inventoryPath)}`);
  if (!fs.existsSync(schemaPath)) fail(`missing ${path.relative(root, schemaPath)}`);
  const inventory = readJson(inventoryPath);
  validateInventoryShape(inventory);
  assertFeatureAndEngineCoverage(inventory);
  assertPilotIdentities(inventory);

  const productionFiles = collectProductionFiles();
  const hardFailures = [];
  const softWarnings = [];

  for (const owner of inventory.owners) {
    if (owner.ownerClass === "retired-unreferenced") {
      const hits = scanReferences(productionFiles, owner.path);
      const rustHits = productionFiles.filter((file) => {
        if (!file.endsWith(".rs")) return false;
        const rel = posixRel(file);
        if (ownerMatchesPath(owner.path, rel)) return false;
        const text = fs.readFileSync(file, "utf8");
        return new RegExp(`\\bmod\\s+${escapeRegExp(rustModuleName(owner.path))}\\s*;`).test(text);
      });
      const allHits = [...new Set([...hits, ...rustHits.map(posixRel)])];
      if (allHits.length > 0) {
        hardFailures.push(
          `${owner.path} is retired-unreferenced but still referenced by: ${allHits.join(", ")}`,
        );
      }
    }

    if (owner.ownerClass === "later-plugin") {
      const appShellFiles = productionFiles.filter((file) =>
        posixRel(file).startsWith("src/app-shell/"),
      );
      const hits = scanReferences(appShellFiles, owner.path);
      if (hits.length > 0) {
        softWarnings.push(
          `AppShell imports later-plugin ${owner.path}: ${hits.join(", ")}`,
        );
      }
    }
  }

  for (const warning of softWarnings) {
    process.stderr.write(`[core-shell-boundary] soft: ${warning}\n`);
  }
  if (hardFailures.length > 0) {
    fail(hardFailures.join("\n"));
  }

  const retired = inventory.owners.filter((owner) => owner.ownerClass === "retired-unreferenced").length;
  process.stdout.write(
    `[core-shell-boundary] ok (${inventory.owners.length} owners, ${retired} retired, ${softWarnings.length} soft)\n`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
