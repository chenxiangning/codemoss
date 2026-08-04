# Finish Work - Pre-Commit Checklist

Before submitting or committing, use this checklist to ensure work completeness.

**Timing**: After code is written and tested, before commit

---

## Checklist

### 1. Code Quality

```bash
# Must pass
npm run lint
npm run typecheck
npm run test
```

- [ ] `npm run lint` passes with 0 errors?
- [ ] `npm run typecheck` passes with no type errors?
- [ ] Tests pass?
- [ ] No `console.log` statements (use logger)?
- [ ] No non-null assertions (the `x!` operator)?
- [ ] No `any` types?

### 1.5. Test Coverage

Check whether your change needs new or updated tests against the current project sources:

- Frontend: `.trellis/spec/frontend/quality-guidelines.md` and colocated Vitest patterns
- Backend: `.trellis/spec/backend/quality-guidelines.md` and colocated Rust tests

- [ ] New pure function → unit test added?
- [ ] Bug fix → regression test added in `test/regression.test.ts`?
- [ ] Changed init/update behavior → integration test added/updated?
- [ ] No logic change (text/data only) → no test needed

### 2. Code-Spec Sync

**Code-Spec Docs**:
- [ ] Does `.trellis/spec/backend/` need updates?
  - New patterns, new modules, new conventions
- [ ] Does `.trellis/spec/frontend/` need updates?
  - New components, new hooks, new patterns
- [ ] Does `.trellis/spec/guides/` need updates?
  - New cross-layer flows, lessons from bugs

**Key Question**: 
> "If I fixed a bug or discovered something non-obvious, should I document it so future me (or others) won't hit the same issue?"

If YES -> Update the relevant code-spec doc.

### 2.5. Code-Spec Hard Block (Infra/Cross-Layer)

If this change touches infra or cross-layer contracts, this is a blocking checklist:

- [ ] Spec content is executable (real signatures/contracts), not principle-only text
- [ ] Includes file path + command/API name + payload field names
- [ ] Includes validation and error matrix
- [ ] Includes Good/Base/Bad cases
- [ ] Includes required tests and assertion points

**Block Rule**:
In pipeline mode, the finish agent will automatically detect and execute spec updates when gaps are found.
If running this checklist manually, ensure spec sync is complete before committing — run `/trellis:update-spec` if needed.

### 2.6. ADR Calibration Writeback (Multi-CLI Foundation)

Canonical rule: `AGENTS.md` 全局 Gate「ADR 校准回写 Gate」。

- [ ] 本次变更是否命中基石文档更新触发器（engine registry / Shared 支持集合 / provider binding / canonical fact schema / context compiler / terminal·ACK contract / recovery exit·abandon）？
- [ ] 若命中 → `docs/research/mossx-multi-cli-provider-session-foundation-design.md` 的「最近校准」标注与「零、当前实现校准」表已同步刷新？
- [ ] 新增校准行带 repo-relative 文件路径或 OpenSpec change id（不只写概念）？

**Block Rule**: 命中触发器但未回写的 OpenSpec change 不得收口 / 归档。

### 3. API Changes

If you modified API endpoints:

- [ ] Input schema updated?
- [ ] Output schema updated?
- [ ] API documentation updated?
- [ ] Client code updated to match?

### 4. Database Changes

If you modified database schema:

- [ ] Migration file created?
- [ ] Schema file updated?
- [ ] Related queries updated?
- [ ] Seed data updated (if applicable)?

### 5. Cross-Layer Verification

If the change spans multiple layers:

- [ ] Data flows correctly through all layers?
- [ ] Error handling works at each boundary?
- [ ] Types are consistent across layers?
- [ ] Loading states handled?

### 6. Manual Testing

- [ ] Feature works in browser/app?
- [ ] Edge cases tested?
- [ ] Error states tested?
- [ ] Works after page refresh?

---

## Quick Check Flow

```bash
# 1. Code checks
npm run lint && npm run typecheck

# 2. View changes
git status
git diff --name-only

# 3. Based on changed files, check relevant items above
```

---

## Common Oversights

| Oversight | Consequence | Check |
|-----------|-------------|-------|
| Code-spec docs not updated | Others don't know the change | Check .trellis/spec/ |
| Spec text is abstract only | Easy regressions in infra/cross-layer changes | Require signature/contract/matrix/cases/tests |
| Migration not created | Schema out of sync | Check db/migrations/ |
| Types not synced | Runtime errors | Check shared types |
| Tests not updated | False confidence | Run full test suite |
| Console.log left in | Noisy production logs | Search for console.log |

---

## Relationship to Other Commands

```
Development Flow:
  Write code -> Test -> /trellis:finish-work -> git commit -> /trellis:record-session
                          |                              |
                   Ensure completeness              Record progress
                   
Debug Flow:
  Hit bug -> Fix -> /trellis:break-loop -> Knowledge capture
                       |
                  Deep analysis
```

- `/trellis:finish-work` - Check work completeness (this command)
- `/trellis:record-session` - Record session and commits
- `/trellis:break-loop` - Deep analysis after debugging

---

## Core Principle

> **Delivery includes not just code, but also documentation, verification, and knowledge capture.**

Complete work = Code + Docs + Tests + Verification
