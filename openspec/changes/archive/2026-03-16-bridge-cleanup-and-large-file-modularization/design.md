## Context

CodeMoss currently has multiple single files exceeding 3000 lines across frontend (TS/TSX), backend (Rust), styles (CSS), and localization (i18n).  
This creates concentrated merge-conflict hotspots, weakens review quality, and increases regression probability for Bridge-critical and panel-critical flows.

As of 2026-03-15, 13 files exceed the threshold, with the highest-risk cluster in:
- Core UI entry and panel composition (`App.tsx`, `GitHistoryPanel.tsx`, `SpecHub.tsx`, `SettingsView.tsx`)
- Rust Bridge command/service layer (`src-tauri/src/git/mod.rs`, `src-tauri/src/backend/app_server.rs`, `src-tauri/src/engine/commands.rs`, `src-tauri/src/engine/claude.rs`)
- Large style and locale files (`settings.css`, `git-history.css`, `composer.css`, `en.ts`, `zh.ts`)

Constraints:
- Keep existing user-visible behavior and command contracts compatible.
- Respect existing quality gates (typecheck/tests/build) and concurrency/file-lock conventions in Rust.
- Execute incrementally to avoid high-risk big-bang rewrites.

Stakeholders:
- Frontend and Rust maintainers
- QA and release owners
- Contributors working on Git History / Spec Hub / Settings / Bridge workflows

## Goals / Non-Goals

**Goals:**
- Introduce a stable large-file governance model (`>3000` threshold + priority tiers + CI sentry).
- Split high-risk monolith files into domain modules while preserving behavior.
- Harden Bridge boundaries (command registration, error mapping, concurrency/file-lock usage).
- Provide an implementation sequence that is reversible and merge-friendly.

**Non-Goals:**
- No new product features or UX redesign.
- No one-shot rewrite of all large files in a single PR.
- No breaking change to external command APIs or persisted data format.

## Decisions

### Decision 1: Use progressive strangler modularization, not big-bang rewrite
- Decision: Keep each original entry file as a temporary facade and extract domain-focused modules in batches.
- Rationale: Minimizes regression and enables checkpoint-based rollback.
- Alternative considered:
  - Big-bang rewrite: faster apparent cleanup but unacceptable integration and verification risk.

### Decision 2: Govern by threshold and risk tiers
- Decision: Keep `>3000` as hard governance threshold and classify queue as P0/P1/P2.
- Rationale: Converts ad-hoc cleanup into repeatable engineering governance.
- Alternative considered:
  - Lower threshold (`>2000`) immediately: too much concurrent surface for current capacity.
  - No threshold, only manual review: historically drifts and fails to prevent relapse.

### Decision 3: Bridge hardening with explicit contract boundaries
- Decision: Separate Bridge command handlers, domain services, and shared adapters; standardize error envelopes and concurrency guards.
- Rationale: Prevents command drift and hidden coupling, improves observability and retry safety.
- Alternative considered:
  - Keep mixed command+business logic in one file: short-term convenience, long-term high entropy.

### Decision 4: Split style and locale files by domain namespace
- Decision: Partition giant CSS/i18n files into feature-scoped modules with stable import order.
- Rationale: Improves ownership and lowers conflict frequency without changing UI semantics.
- Alternative considered:
  - Keep single global files with sections only: low implementation cost but no structural conflict reduction.

### Decision 5: Add non-blocking CI sentry first, then hard gate
- Decision: Start with warning mode for new/changed oversized files, then upgrade to gate mode after migration baseline.
- Rationale: Reduces disruption while building migration momentum.
- Alternative considered:
  - Immediate hard fail: likely blocks unrelated delivery before migration scaffolding is ready.

## Risks / Trade-offs

- [Risk] Hidden behavior drift during extraction  
  → Mitigation: behavior-parity checklist, targeted regression tests, staged PR rollout.

- [Risk] Cross-PR merge conflicts while splitting shared files  
  → Mitigation: capability matrix per PR, semantic merge policy, smaller batch size.

- [Risk] Rust Bridge refactor can break command wiring  
  → Mitigation: command registry smoke tests + strict compile/type checks + rollback path.

- [Risk] Style split may cause ordering regressions  
  → Mitigation: define deterministic import order and visual regression spot checks.

- [Trade-off] Progressive migration takes longer than rewrite  
  → Mitigation: prioritize P0 files and enforce continuous queue burn-down.

## Migration Plan

1. Establish baseline inventory and publish P0/P1/P2 queue from current scan.
2. Implement Bridge boundary scaffolding and command contract tests first (stability anchor).
3. Split P0 TSX/Rust files by domain modules behind facade entry files.
4. Split P1 CSS and P2 i18n files with deterministic namespace/import rules.
5. Enable CI sentry warning mode for `>3000` deltas.
6. After queue baseline is reduced and process is stable, switch sentry to hard gate.

Rollback strategy:
- Keep facade files and compatible exports during each batch.
- Revert batch by batch (single capability scope), not monolithic rollback.
- If command contract fails, restore previous registry/service module wiring immediately.

## Open Questions

- Should i18n split be key-prefix based or feature-folder based as the default strategy?
- What is the exact deadline to switch CI sentry from warning mode to hard gate?
- Do we require automated visual snapshot checks for CSS split in Git History/Settings critical flows?
