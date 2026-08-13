# Verification

## Status

Implementation and rebuilt-desktop manual verification completed. Strict OpenSpec artifact validation remains environment-blocked because neither the CLI nor the repository fallback validator is executable in this workspace.

## Regression Evidence

### RED: Markdown container prefix loss

Ordered-list `\\[...\\]` fixture originally normalized from:

```md
   \\[
   B_0,\\qquad B_{180}=R_\\pi B_0;
   \\]
```

to:

```md
   $$
B_0,\\qquad B_{180}=R_\\pi B_0;
$$
```

The message renderer produced an extra cross-paired math block and consumed later Chinese prose; file preview lost both list and blockquote prefixes.

### RED: nested parenthetical conversion

The focused regression proved that:

```md
\\[
(\\theta,t_x,t_y),
\\]
```

was normalized to:

```md
$$
$\\theta,t_x,t_y$,
$$
```

KaTeX then reported `Can't use function '$' in math mode`.

### GREEN

```text
npx vitest run \
  src/features/messages/components/Markdown.math-rendering.test.tsx \
  src/features/files/utils/fileMarkdownDocument.test.ts \
  src/features/files/components/FileMarkdownPreview.test.tsx

3 test files passed
43 tests passed
```

Coverage includes ordered-list prefix preservation, blockquote prefix preservation, unmatched delimiters, incompatible container prefixes, nested parenthetical protection, DOM KaTeX rendering, and file-preview line mapping.

## Real Codex Session Replay

Session UUID: `019f5fd5-25a4-7521-8949-12d9f6c466f3`

- Production `Markdown` component replay passed with zero `.katex-error` nodes.
- The previously failing tuple now normalizes as `$$ / (\\theta,t_x,t_y), / $$`, without nested single-dollar delimiters.
- AST inspection around the screenshot area contains bounded math nodes instead of one cross-paired node consuming prose:

```text
math 488-490 [x,y,...]
math 502-504 B_0,...
math 509-511 \\Delta=...
math 531-533 2qWH...
```

## Static Quality Gates

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run check:large-files`: exited 0; report mode listed six existing policy findings on latest `origin/main`, none touched by this change.
- `git diff --check`: passed.
- No API, backend, persistence, CSS, or streaming-state contract changed. The PR branch contains no dependency or manifest edit.

## Full Test Gate

`npm run test` was run outside the default sandbox restriction and reached batch 19, where `src/features/app/components/Sidebar.test.tsx` stopped the batch runner with three failures (`44/47` Sidebar tests passed):

1. runtime notice bottom action count: expected `4`, received `2`;
2. folder session creation test queried role `menuitem`, while the provider entry is exposed as `menuitemradio`;
3. catalog-backed pending folder intent test has the same `menuitem` / `menuitemradio` mismatch.

No Sidebar source, test, dependency, or shared provider-menu file differs from `origin/main` in this branch. A direct standalone rerun reproduced the same three assertions, so these are baseline failures rather than regressions introduced by the math normalizer.

## OpenSpec Validation

- `openspec validate fix-message-math-container-prefix --strict --no-interactive`: unavailable; `openspec` is not on PATH.
- Documented shell fallback failed because `zsh` is not installed.
- `python3 .claude/skills/osp-openspec-sync/scripts/validate-consistency.py --project-path . --full` failed because its upstream validator path `/home/yode/.claude/skills/osp-openspec-sync/scripts/validate-consistency.py` is absent.

The proposal, design, tasks, delta spec, and this verification artifact were manually reviewed for the expected change structure, but strict schema validation is not claimed.

## Manual Verification and Remaining Risk

- A rebuilt cc-gui opened the target UUID in the actual desktop WebView, and the previously failing formulas rendered correctly.
- The conservative `\\(q\\)` single-symbol heuristic remains intentionally unchanged; this change only fixes container-prefix loss and nested wrapping inside already established math ranges.

## Break-Loop Analysis

### 1. Root Cause Category

- **Category**: D + E — Test Coverage Gap / Implicit Assumption.
- **Specific Cause**: multi-pass normalizer implicitly assumed each regex saw only prose wrappers. In reality, an earlier pass can establish Markdown/math structure that a later pass must treat as immutable grammar rather than fresh text.

### 2. Why the First Fix Was Incomplete

1. Container-prefix preservation fixed the large cross-paired math node, but only exercised the list/blockquote structural failure.
2. Replaying the complete target UUID exposed a second composition failure: plain-parentheses normalization still ran inside the newly established display block.
3. Focused synthetic fixtures alone therefore did not fully represent the interaction among sequential normalization passes; production-component replay supplied the missing integration evidence.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|---|---|---|---|
| P0 | Architecture | line-aware delimiter replacement + established math-range guard | DONE |
| P0 | Test Coverage | list/blockquote/unmatched/cross-container/nested-wrapper DOM and pure assertions | DONE |
| P1 | Documentation | OpenSpec delta + Trellis frontend executable contract | DONE |
| P1 | Integration | production `Markdown` replay for the reported UUID | DONE |
| P2 | Manual QA | rebuilt desktop WebView visual check | DONE |

### 4. Systematic Expansion

- **Similar Issues**: any sequential Markdown normalizer can corrupt structure created by an earlier pass, especially alert/list normalization, dollar math repair, and prose heuristics.
- **Design Improvement**: new passes should declare which grammar regions they may mutate and use line/range-aware guards instead of unconstrained cross-line regex replacement.
- **Process Improvement**: bug fixes sourced from real sessions should combine minimal synthetic tests with one production-pipeline replay before completion.

### 5. Knowledge Capture

- [x] Updated OpenSpec proposal/design/spec/tasks/verification.
- [x] Updated `dev-guidelines/frontend/quality-guidelines.md` and index.
- [x] Added executable regression coverage.
- [ ] No `src/templates/markdown/spec/` tree exists in this repository, so template sync is not applicable.
- [x] Code commit and mandatory Trellis session record completed before PR publication.
