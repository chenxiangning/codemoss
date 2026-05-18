#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function exists(relativePath) {
  return existsSync(path.join(repoRoot, relativePath));
}

const errors = [];

const fixtureFiles = [
  "src/features/context-ledger/pricing/fixtures/claude.ts",
  "src/features/context-ledger/pricing/fixtures/codex.ts",
  "src/features/context-ledger/pricing/fixtures/gemini.ts",
  "src/features/context-ledger/pricing/fixtures/opencode.ts",
];

for (const file of fixtureFiles) {
  if (!exists(file)) {
    errors.push(`missing per-engine pricing fixture ${file}`);
    continue;
  }
  const size = statSync(path.join(repoRoot, file)).size;
  if (size > 20_000) {
    errors.push(`pricing fixture is too large for first slice: ${file}`);
  }
}

const pricingTypes = read("src/features/context-ledger/pricing/pricingTypes.ts");
for (const sourceKind of ["fixture", "config", "remote"]) {
  if (!pricingTypes.includes(`"${sourceKind}"`)) {
    errors.push(`PricingSource kind missing ${sourceKind}`);
  }
}

const registry = read("src/features/context-ledger/pricing/pricingRegistry.ts");
for (const engine of ["claude", "codex", "gemini", "opencode"]) {
  if (!registry.includes(`${engine}:`)) {
    errors.push(`pricing registry missing engine ${engine}`);
  }
}
if (!registry.includes("return null")) {
  errors.push("pricing lookup must return null for missing pricing");
}

const projectCost = read("src/features/context-ledger/cost/projectCost.ts");
if (/ContextLedgerBlock|estimate\.value/.test(projectCost)) {
  errors.push("cost projection must not consume ContextLedgerBlock estimate values");
}
for (const marker of [
  "pricing-unavailable",
  "pricing-stale",
  "block-level-not-supported",
  "amount: null",
]) {
  if (!projectCost.includes(marker)) {
    errors.push(`cost projection missing invariant marker ${marker}`);
  }
}

const budgetThresholds = read("src/features/context-ledger/budget/budgetThresholds.ts");
for (const tier of ["info", "warn", "block"]) {
  if (!budgetThresholds.includes(tier)) {
    errors.push(`budget thresholds missing tier ${tier}`);
  }
}
if (!budgetThresholds.includes("shouldInterruptRuntime: false")) {
  errors.push("budget block tier must not interrupt runtime in this capability");
}

const spec = read(
  "openspec/changes/evolve-context-ledger-to-cost-budget/specs/context-ledger-cost-budget/spec.md",
);
for (const requirement of [
  "ThreadTokenUsage",
  "Pricing Source MUST Be Traceable",
  "Unknown Pricing MUST Produce Degraded Cost State",
  "Session Budget MUST Support Three Threshold Tiers",
]) {
  if (!spec.includes(requirement)) {
    errors.push(`spec missing requirement marker ${requirement}`);
  }
}

if (errors.length > 0) {
  console.error("[context-ledger-cost-budget] violations detected:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("[context-ledger-cost-budget] OK");
