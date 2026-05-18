# Implementation Evidence

## Scope

This change implements the first non-runtime slice of the agent domain event schema:

- immutable TypeScript event contracts
- pure event factories with explicit `occurredAt`
- reducer derivation fixtures for the ten approved event types
- schema parity checks and CI entrypoints

It does not add EventBus, subscription, ring buffer, persistent audit log, runtime emission, or session-activity integration.

## Implemented Files

- `src/features/threads/domain-events/events/base.ts`
- `src/features/threads/domain-events/events/session.ts`
- `src/features/threads/domain-events/events/turn.ts`
- `src/features/threads/domain-events/events/message.ts`
- `src/features/threads/domain-events/events/tool.ts`
- `src/features/threads/domain-events/events/usage.ts`
- `src/features/threads/domain-events/eventTypes.ts`
- `src/features/threads/domain-events/eventFactories.ts`
- `src/features/threads/domain-events/eventDerivationFixtures.ts`
- `src/features/threads/domain-events/eventFactories.test.ts`
- `scripts/check-agent-domain-event-schema.mjs`

## Ten Event Types

- `session.started`
- `session.ended`
- `turn.started`
- `turn.completed`
- `turn.failed`
- `message.delta.appended`
- `message.completed`
- `tool.started`
- `tool.completed`
- `usage.updated`

## Validation Evidence

- `npm exec vitest run src/features/threads/domain-events/eventFactories.test.ts`
  - Pass: 1 file, 3 tests.
- `npm run check:agent-domain-event-schema`
  - Pass: required event types, factories, derivation fixtures, and non-runtime boundaries match.
- `npm run typecheck`
  - Pass.
- `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`
  - Pass: 15 tests.
- `npm run check:large-files:gate`
  - Pass: `found=0`.
- `openspec validate add-agent-domain-event-schema --strict --no-interactive`
  - Pass.

## Runtime Non-Touch Evidence

- `git diff --name-only src/features/threads/hooks src/features/session-activity src/features/threads/domain-events`
  - Only `src/features/threads/domain-events/**` appears.
- `scripts/check-agent-domain-event-schema.mjs` rejects reducer imports or calls into `domain-events`.
- No `useSyncExternalStore`, `EventBus`, ring buffer, append-only log, or subscription surface is introduced.

## Residual Risk And Follow-Up

- Full `npm run check:heavy-test-noise` was already run in this implementation session for `formalize-engine-runtime-contract`: 479 test files, 0 act warnings, 0 stdout/stderr payload lines. This change reran the parser tests and its own targeted tests.
- Local validation ran on macOS. CI owns the three-platform confirmation for Ubuntu, macOS, and Windows.
- Runtime event emission, subscription, persistent audit trail, and session-activity migration remain explicit follow-up changes.
