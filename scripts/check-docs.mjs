#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DOCS_ROOT = join(ROOT, "docs");
const DOCS_INDEX = join(DOCS_ROOT, "README.md");
const MARKDOWN_EXT = ".md";
const PUBLISHED_LIFECYCLES = new Set([
  "active",
  "implemented",
  "historical",
  "superseded",
  "deprecated",
  "generated",
]);

const ROOT_FILE_ALLOWLIST = new Set([
  "GOVERNANCE.md",
  "README.md",
  "banner.png",
  "chat-canvas-conversation-curtain-contracts.md",
  "codex-collaboration-mode-enforcement-runbook.md",
  "curated-skill-onboarding.md",
  "markdown-doc1-claude-chat-canvas-rendering.md",
  "markdown-doc2-codex-chat-canvas-rendering.md",
  "openspec-trellis-playbook.md",
  "openspec-playbook.md",
]);

const CURRENT_SECTION_DIRS = [
  "docs/analysis",
  "docs/architecture",
  "docs/guides",
  "docs/guides/ui",
  "docs/guides/workflow",
  "docs/perf",
  "docs/perf/history",
  "docs/plans",
  "docs/plans/archived",
  "docs/reference",
  "docs/reference/conversation",
  "docs/reports",
  "docs/research",
  "dev-guidelines/backend",
  "dev-guidelines/frontend",
  "dev-guidelines/guides",
];

const errors = [];
const documentMetadata = new Map();

function normalizePath(filePath) {
  return filePath.split(sep).join("/");
}

function relativeToRoot(filePath) {
  return normalizePath(relative(ROOT, filePath));
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(entryPath));
    } else {
      files.push(entryPath);
    }
  }
  return files;
}

function stripCodeFences(markdown) {
  return markdown.replace(/^\`\`\`[\s\S]*?^\`\`\`\s*$/gm, "");
}

function extractDocumentMetadata(markdown) {
  const frontMatterMatch = markdown.match(
    /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/,
  );
  if (!frontMatterMatch) {
    return { hasFrontMatter: false, types: [], statuses: [] };
  }

  const fields = { type: [], status: [] };
  const fieldPattern =
    /^(type|status)\s*:\s*(?:"([^"]*)"|'([^']*)'|([^#\r\n]*?))(?:\s+#.*)?\s*$/gm;
  for (const fieldMatch of frontMatterMatch[1].matchAll(fieldPattern)) {
    fields[fieldMatch[1]].push(
      (fieldMatch[2] ?? fieldMatch[3] ?? fieldMatch[4]).trim(),
    );
  }

  return {
    hasFrontMatter: true,
    types: fields.type,
    statuses: fields.status,
  };
}

function extractLocalTargets(filePath, content) {
  const searchable = filePath.endsWith(MARKDOWN_EXT) ? stripCodeFences(content) : content;
  const targets = [];
  const patterns = [
    /\[[^\]]*\]\(([^)]+)\)/g,
    /(?:href|src)\s*=\s*["']([^"']+)["']/gi,
  ];

  for (const pattern of patterns) {
    for (const match of searchable.matchAll(pattern)) {
      let target = match[1].trim().replace(/^<|>$/g, "");
      if (pattern === patterns[0]) {
        target = target.split(/\s+["']/)[0];
      }
      if (!target || /^(?:[a-z][a-z0-9+.-]*:|#|\/\/|\/)/i.test(target)) {
        continue;
      }
      const pathPart = target.split("#", 1)[0].split("?", 1)[0];
      if (!pathPart) {
        continue;
      }
      try {
        targets.push({
          raw: target,
          absolute: resolve(dirname(filePath), decodeURIComponent(pathPart)),
        });
      } catch {
        errors.push(`${relativeToRoot(filePath)}: invalid encoded link ${target}`);
      }
    }
  }
  return targets;
}

function canonicalNavigationTarget(targetPath) {
  if (!existsSync(targetPath) || !statSync(targetPath).isDirectory()) {
    return targetPath;
  }
  const readme = join(targetPath, "README.md");
  const index = join(targetPath, "index.md");
  if (existsSync(readme)) return readme;
  if (existsSync(index)) return index;
  return targetPath;
}

const docsFiles = walk(DOCS_ROOT);
const proseFiles = docsFiles.filter((filePath) => /\.(?:md|html)$/i.test(filePath));
const markdownFiles = docsFiles.filter((filePath) => filePath.endsWith(MARKDOWN_EXT));
const graph = new Map();

for (const filePath of proseFiles) {
  const content = readFileSync(filePath, "utf8");
  if (filePath.endsWith(MARKDOWN_EXT)) {
    const metadata = extractDocumentMetadata(content);
    documentMetadata.set(filePath, metadata);

    if (!metadata.hasFrontMatter) {
      errors.push(`${relativeToRoot(filePath)}: missing YAML front matter`);
    }
    if (metadata.types.length === 0) {
      errors.push(`${relativeToRoot(filePath)}: missing YAML type`);
    } else if (metadata.types.length > 1) {
      errors.push(`${relativeToRoot(filePath)}: duplicate YAML type`);
    } else if (!metadata.types[0]) {
      errors.push(`${relativeToRoot(filePath)}: YAML type must not be empty`);
    }
    if (metadata.statuses.length === 0) {
      errors.push(`${relativeToRoot(filePath)}: missing YAML status`);
    } else if (metadata.statuses.length > 1) {
      errors.push(`${relativeToRoot(filePath)}: duplicate YAML status`);
    } else if (!PUBLISHED_LIFECYCLES.has(metadata.statuses[0])) {
      errors.push(
        `${relativeToRoot(filePath)}: invalid YAML status ${metadata.statuses[0] || "<empty>"}; allowed: ${[
          ...PUBLISHED_LIFECYCLES,
        ].join(", ")}`,
      );
    }
  }

  const resolvedTargets = [];
  for (const target of extractLocalTargets(filePath, content)) {
    if (!existsSync(target.absolute)) {
      errors.push(`${relativeToRoot(filePath)}: broken local link ${target.raw}`);
      continue;
    }
    resolvedTargets.push(canonicalNavigationTarget(target.absolute));
  }
  graph.set(filePath, resolvedTargets);
}

for (const filePath of docsFiles.filter((entry) => entry.endsWith(".json"))) {
  try {
    JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${relativeToRoot(filePath)}: invalid JSON (${error.message})`);
  }
}

const reachable = new Set([DOCS_INDEX]);
const pending = [DOCS_INDEX];
while (pending.length > 0) {
  const source = pending.shift();
  for (const target of graph.get(source) ?? []) {
    if (!target.startsWith(`${DOCS_ROOT}${sep}`) || reachable.has(target)) {
      continue;
    }
    reachable.add(target);
    if (graph.has(target)) pending.push(target);
  }
}

for (const filePath of markdownFiles) {
  if (!reachable.has(filePath)) {
    errors.push(`${relativeToRoot(filePath)}: not reachable from docs/README.md`);
  }
}

for (const filePath of docsFiles.filter((entry) => entry.endsWith(`${sep}.DS_Store`))) {
  errors.push(`${relativeToRoot(filePath)}: forbidden runtime artifact`);
}

for (const section of CURRENT_SECTION_DIRS) {
  const sectionPath = join(ROOT, section);
  const navigationName = section.startsWith("dev-guidelines/") ? "index.md" : "README.md";
  if (!existsSync(join(sectionPath, navigationName))) {
    errors.push(`${section}: missing ${navigationName}`);
  }
}

const archiveRoot = join(DOCS_ROOT, "archive");
for (const filePath of walk(archiveRoot).filter(
  (entry) => entry.endsWith(MARKDOWN_EXT) && !entry.endsWith(`${sep}README.md`),
)) {
  if (documentMetadata.get(filePath)?.statuses[0] !== "historical") {
    errors.push(`${relativeToRoot(filePath)}: archive document must have YAML status historical`);
  }
}

for (const entry of readdirSync(DOCS_ROOT, { withFileTypes: true })) {
  if (entry.isFile() && !ROOT_FILE_ALLOWLIST.has(entry.name)) {
    errors.push(`docs/${entry.name}: root file is not allowlisted`);
  }
}

if (errors.length > 0) {
  console.error(`Docs governance check failed (${errors.length} issue${errors.length === 1 ? "" : "s"}):\n`);
  for (const error of errors.sort()) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Docs governance check passed: ${proseFiles.length} prose files, `
    + `${docsFiles.filter((entry) => entry.endsWith(".json")).length} JSON artifacts.`,
);
