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

for (const file of [
  "src/features/threads/contracts/realtimeBatchingContract.ts",
  "src/features/threads/contracts/realtimeBatchingContract.test.ts",
]) {
  if (!exists(file)) {
    errors.push(`missing realtime batching contract file ${file}`);
  }
}

const contract = read("src/features/threads/contracts/realtimeBatchingContract.ts");
for (const marker of [
  "first-token",
  "terminal",
  "planRealtimeBatchDeliveries",
  "flattenRealtimeBatchDeliveries",
]) {
  if (!contract.includes(marker)) {
    errors.push(`batching contract missing marker ${marker}`);
  }
}

if (/NormalizedThreadEvent|EventBus|domain-events/.test(contract)) {
  errors.push("batching contract must not redefine canonical runtime events or introduce EventBus");
}

const test = read("src/features/threads/contracts/realtimeBatchingContract.test.ts");
for (const marker of [
  "first visible assistant delta",
  "preserves order",
  "terminal completion",
  "dedup replay semantics",
]) {
  if (!test.includes(marker)) {
    errors.push(`batching tests missing scenario marker ${marker}`);
  }
}

if (errors.length > 0) {
  console.error("[realtime-event-batching] violations detected:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("[realtime-event-batching] OK");
