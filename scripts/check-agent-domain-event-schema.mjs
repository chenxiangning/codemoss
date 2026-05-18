#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const REQUIRED_EVENT_TYPES = [
  "session.started",
  "session.ended",
  "turn.started",
  "turn.completed",
  "turn.failed",
  "message.delta.appended",
  "message.completed",
  "tool.started",
  "tool.completed",
  "usage.updated",
];

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const eventTypesSource = read("src/features/threads/domain-events/eventTypes.ts");
const domainEventSources = [
  eventTypesSource,
  read("src/features/threads/domain-events/events/session.ts"),
  read("src/features/threads/domain-events/events/turn.ts"),
  read("src/features/threads/domain-events/events/message.ts"),
  read("src/features/threads/domain-events/events/tool.ts"),
  read("src/features/threads/domain-events/events/usage.ts"),
].join("\n");
const factoriesSource = read("src/features/threads/domain-events/eventFactories.ts");
const derivationSource = read("src/features/threads/domain-events/eventDerivationFixtures.ts");
const reducerSources = [
  "src/features/threads/hooks/useThreadsReducer.ts",
  "src/features/threads/hooks/threadReducerNormalizedRealtime.ts",
  "src/features/threads/hooks/threadReducerTypes.ts",
].map(read);

const errors = [];

for (const type of REQUIRED_EVENT_TYPES) {
  if (!domainEventSources.includes(type)) {
    errors.push(`domain event type definitions missing ${type}`);
  }
  if (!factoriesSource.includes(type)) {
    errors.push(`eventFactories.ts missing ${type}`);
  }
}

if (eventTypesSource.match(/\| .*Event/g)?.length !== REQUIRED_EVENT_TYPES.length) {
  errors.push("AgentDomainEvent union does not expose exactly ten event variants.");
}

for (const source of reducerSources) {
  if (source.includes("domain-events") || source.includes("createSessionStartedEvent")) {
    errors.push("Reducer runtime imports or calls domain event factory.");
  }
}

if (/useSyncExternalStore|EventBus|ring buffer|append-only log/i.test(derivationSource)) {
  errors.push("Domain event schema introduced runtime container language.");
}

if (!factoriesSource.includes("Object.freeze")) {
  errors.push("Factories do not provide dev-mode Object.freeze.");
}

if (errors.length > 0) {
  console.error("[agent-domain-event-schema] violations detected:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("[agent-domain-event-schema] OK");
