#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
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
const requiredFiles = [
  "src/features/status-panel/utils/policies/policyTypes.ts",
  "src/features/status-panel/utils/policies/corePolicy.ts",
  "src/features/status-panel/utils/policies/policyRegistry.ts",
  "src/features/status-panel/utils/policies/validationPolicies.ts",
  "src/features/status-panel/utils/policies/policyRegistry.test.ts",
];

for (const file of requiredFiles) {
  if (!exists(file)) {
    errors.push(`missing policy chain file ${file}`);
  }
}

const policyTypes = read("src/features/status-panel/utils/policies/policyTypes.ts");
for (const marker of ["appliesTo", "evaluate", "PolicyDecision", "CheckpointAuditEntry"]) {
  if (!policyTypes.includes(marker)) {
    errors.push(`policy type contract missing ${marker}`);
  }
}

const registry = read("src/features/status-panel/utils/policies/policyRegistry.ts");
for (const marker of [
  "corePolicy",
  "composePolicyVerdict",
  "CHECKPOINT_POLICY_AUDIT_LIMIT = 50",
  "entries.shift()",
]) {
  if (!registry.includes(marker)) {
    errors.push(`policy registry missing ${marker}`);
  }
}

const validationPolicies = read("src/features/status-panel/utils/policies/validationPolicies.ts");
for (const marker of [
  "lintValidationPolicy",
  "typecheckValidationPolicy",
  "testsValidationPolicy",
  "verdictContribution: \"needs_review\"",
]) {
  if (!validationPolicies.includes(marker)) {
    errors.push(`validation policy missing ${marker}`);
  }
}
if (validationPolicies.includes("verdictContribution: \"blocked\"")) {
  errors.push("first-batch optional policies must not contribute blocked");
}

const checkpoint = read("src/features/status-panel/utils/checkpoint.ts");
if (checkpoint.includes("policies/")) {
  errors.push("non-UI first slice must not reroute existing checkpoint runtime through policy chain");
}

const checkpointPanel = read("src/features/status-panel/components/CheckpointPanel.tsx");
if (checkpointPanel.includes("policy log") || checkpointPanel.includes("statusPanel.policy.")) {
  errors.push("UI policy log must remain deferred in this slice");
}

if (errors.length > 0) {
  console.error("[checkpoint-policy-chain] violations detected:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("[checkpoint-policy-chain] OK");
