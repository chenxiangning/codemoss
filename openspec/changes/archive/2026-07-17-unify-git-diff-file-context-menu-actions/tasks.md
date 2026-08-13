## 1. Unified Context Menu Implementation

- [x] 1.1 [P0, depends: none] 输入现有 `RendererContextMenu` types 与 i18n keys，新增 focused pure builder，输出 section-aware `Git` submenu；用 TypeScript compile 与 component tests 验证 item order、plural labels、separator 和 danger tone。
- [x] 1.2 [P0, depends: 1.1] 输入 single-repository selected paths、clicked section 与 mutation callbacks，替换 inline hardcoded menu；输出 same-section Stage / Unstage / Discard actions，并用 `GitDiffPanel.test.tsx` 验证 flat/tree、same-path staged/unstaged 与 disabled mutation。
- [x] 1.3 [P0, depends: 1.1] 输入 multi-repository row owner 的 `repositoryRoot + path + section`，替换两处 no-op callback；输出 scoped mutation、single refresh 与 existing discard confirmation，并用 multi component/integration tests 验证同名 path 和 `repositoryRoot === ""`。

## 2. Regression Coverage And Contracts

- [x] 2.1 [P0, depends: 1.2] 输入 single-repository contextmenu events，新增 regression tests；输出 native-menu suppression、Git submenu accessibility、section-local bulk target、cancel/confirm isolation 的可执行证据。
- [x] 2.2 [P0, depends: 1.3] 输入 two-repository same-path fixtures 与 explicit workspace-root fixture，新增 regression tests；输出 exact repository callback、refresh-on-success、zero side effects on menu-open 的可执行证据。
- [x] 2.3 [P1, depends: 1.2, 1.3] 输入最终 callback/data-flow，更新 `dev-guidelines/frontend/multi-repository-git-commit-workspace.md`；输出可执行 signature、action matrix、error matrix 与 test requirements。

## 3. Verification And Closure

- [x] 3.1 [P0, depends: 2.1, 2.2] 运行 focused Git component Vitest、`npm run lint`、`npm run typecheck`、`git diff --check` 与 `npm run check:large-files`；输出每个 gate 的 pass/fail evidence。
- [x] 3.2 [P0, depends: 2.3, 3.1] 对照 proposal/design/spec/task 复核 implementation，运行 strict OpenSpec validation 并记录 `verification.md`；输出可归档的 traceability 与已知限制。
