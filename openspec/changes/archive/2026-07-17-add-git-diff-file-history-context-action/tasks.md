## 1. Typed Target And Menu Contract

- [x] 1.1 [P0, 依赖: 无] 输入 workspace、single `gitRoot` 或 multi explicit `repositoryRoot` 与 clicked row path，输出 validated `FileHistoryTarget | null` pure resolver；验证 root/nested/Windows/empty-root/invalid path focused tests 通过。
- [x] 1.2 [P0, 依赖: 1.1] 输入 optional History action 与 existing mutation actions，输出统一 `Git` submenu ordering（Unstage/Stage → History → separator → Discard）；验证 helper exact structure、History-only 与 empty action tests 通过。

## 2. Single And Multi Repository Wiring

- [x] 2.1 [P0, 依赖: 1.1/1.2] 输入 single flat/tree clicked row、selection 与 optional `onOpenFileHistory`，输出 clicked-only History navigation，并将 mutation availability 与 read-only History availability分离；验证 bulk selection、mutationDisabled、missing capability tests 通过。
- [x] 2.2 [P0, 依赖: 1.1/1.2] 输入 multi repository exact `repositoryRoot + path`，输出 repository-scoped History navigation并保留 `repositoryRoot=""`；验证 same-path cross-repository 与 root identity tests 通过。
- [x] 2.3 [P1, 依赖: 2.1/2.2] 输入 AppShell existing File History callback，输出 layout → `GitDiffPanel` typed optional prop wiring及 stale menu invalidation；验证 callback/topology/workspace rerender test 通过。

## 3. Contract And Verification Closure

- [x] 3.1 [P1, 依赖: 2.1/2.2/2.3] 输入最终实现，输出 `dev-guidelines/frontend/file-history-view.md` 与 `multi-repository-git-commit-workspace.md` executable contract增量；验证 signatures、matrix、Good/Base/Bad 与 required tests 完整。
- [x] 3.2 [P0, 依赖: 3.1] 输入全部 code/spec changes，输出 focused Vitest、lint、typecheck、large-file/native-menu、`git diff --check` 与 strict OpenSpec validation evidence；验证所有本变更 gate 通过或显式记录 unrelated baseline。
