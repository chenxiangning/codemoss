# Verification Report

**Change:** `spec-hub-session-switch-and-sidebar-entry-fix-2026-02-26`
**Date:** 2026-02-26
**Branch:** `codex/fix-openspec-flow-v0.1.9`

---

## Scope

This verification covers the **gate alignment refactoring** portion of the change — specifically the removal of
client-side verify-stage preflight blocking in favor of server-side handling.

### Modified Files (4)

| File                                          | Change                                                                          | Lines       |
|-----------------------------------------------|---------------------------------------------------------------------------------|-------------|
| `src/features/spec/hooks/useSpecHub.ts`       | Remove verify-stage preflight guard + unused import                             | 0 ↑ / 42 ↓  |
| `src/features/spec/hooks/useSpecHub.test.tsx` | Update test expectations: verify now proceeds despite preflight blockers        | 18 ↑ / 18 ↓ |
| `src/features/spec/runtime.test.ts`           | Update test expectations: verify/archive no longer blocked by `archiveBlockers` | 14 ↑ / 14 ↓ |
| `src/lib/spec-core/runtime.ts`                | Remove `archiveBlockers` propagation to verify/archive blocker arrays           | 0 ↑ / 2 ↓   |

**Net:** 32 insertions / 76 deletions (−44 lines)

### What Changed

1. **`useSpecHub.ts`** — Removed the `evaluateOpenSpecChangePreflight` call before `runSpecAction("verify")`.
   Previously, the hook would fetch fresh workspace files, run preflight, and block verify with a negative timeline
   event if blockers existed. This logic is now removed; verify always proceeds to `runSpecAction`.

2. **`runtime.ts` (`buildSpecActions`)** — Removed `archiveBlockers` from both the verify and archive blocker arrays.
   These were client-side preflight results injected into action availability; removing them decouples action
   availability from client-side preflight evaluation.

3. **Tests** — Both test files updated to assert the new behavior: verify proceeds (is called) even when preflight
   detects blockers; verify/archive actions remain available when only `archiveBlockers` exist.

---

## Checks Run

### Unit Tests

| Suite                                         | Tests     | Status |
|-----------------------------------------------|-----------|--------|
| `src/features/spec/runtime.test.ts`           | 40 passed | PASS   |
| `src/features/spec/hooks/useSpecHub.test.tsx` | 17 passed | PASS   |

### TypeScript Type Check

```
npx tsc --noEmit → 0 errors
```

### Key Test Cases Verified

| Test Case                                                               | Expected                                   | Actual           |
|-------------------------------------------------------------------------|--------------------------------------------|------------------|
| `runs verify even when preflight detects delta blockers`                | `runSpecAction` called with verify action  | PASS             |
| `keeps verify and archive available when only preflight blockers exist` | verify/archive available=true, blockers=[] | PASS             |
| `stops verify state transition when verify action throws`               | Error propagated, no state corruption      | PASS (unchanged) |
| All other existing tests (37 runtime + 16 hook)                         | No regression                              | PASS             |

---

## Results

### Behavior Change Summary

| Aspect                           | Before                                                 | After                                                              |
|----------------------------------|--------------------------------------------------------|--------------------------------------------------------------------|
| Verify with preflight blockers   | Blocked client-side; `runSpecAction` not called        | Proceeds to `runSpecAction`; server decides                        |
| `archiveBlockers` on verify      | Injected into verify `.blockers` → action unavailable  | Not injected → verify always available if artifacts complete       |
| `archiveBlockers` on archive     | Injected into archive `.blockers` → action unavailable | Not injected → archive gated only by verify pass + task completion |
| Preflight import in `useSpecHub` | `evaluateOpenSpecChangePreflight` imported             | Import removed (dead code eliminated)                              |

### Regression Analysis

- No other consumers of the removed `evaluateOpenSpecChangePreflight` call path in `useSpecHub.ts`
- The `evaluateOpenSpecChangePreflight` function itself is preserved in `runtime.ts` (used elsewhere)
- `archiveBlockers` field still exists on the type; only its propagation to blocker arrays is removed
- All 57 tests pass (40 runtime + 17 hook)

---

## Risks / Follow-ups

| Risk                                                                                                                                                   | Severity | Mitigation                                                                                                    |
|--------------------------------------------------------------------------------------------------------------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------|
| Verify no longer blocked by preflight client-side; relies on server-side handling being complete                                                       | Medium   | Verify server action already performs its own validation; this aligns with "single source of truth" principle |
| `archiveBlockers` field unused in `buildSpecActions` but still on type                                                                                 | Low      | Field may still be populated by data layer; safe to keep for now, clean up in future if confirmed unused      |
| Only gate alignment subset implemented in this diff; other proposal items (session switch, sidebar entry, i18n, tree grouping) not yet in working tree | Info     | Tasks marked complete in `tasks.md`; those changes may exist in prior commits or separate PRs                 |

---

## Verdict

All modified files compile, all 57 tests pass, and the behavioral change is intentional and well-tested. The diff is a
clean removal of client-side preflight gating, consistent with the design goal of moving gate evaluation to
server-side / earlier stages.

**Ready for strict validation.**
