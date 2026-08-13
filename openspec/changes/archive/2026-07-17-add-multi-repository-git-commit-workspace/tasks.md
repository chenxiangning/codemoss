## 1. Scoped Git Contract

- [x] 1.1 [P0] 修复 explicit repository branch update 的 workspace guard：输入 active workspace + `repositoryRootOverride`，输出 scoped update result；依赖：无；验证：hook test 覆盖未 selected repository 的 context update。
- [x] 1.2 [P0] 为 Git status/stage/unstage/revert/commit/push/pull/sync/fetch frontend service 增加 optional `repositoryRoot` mapping，并保持 omitted legacy payload；依赖：无；验证：`src/services/tauri.test.ts` payload assertions。
- [x] 1.3 [P0] 扩展 Rust Git commands/resolver 接受 optional `repository_root`，拒绝 escape/unknown root 且不 fallback；依赖：1.2；验证：Rust omitted/empty/nested/invalid isolation tests。

## 2. Repository Status Model

- [x] 2.1 [P0] 新增 repository-keyed full status orchestration：输入 summaries + workspace，输出 stable single/multi model；依赖：1.2、1.3；验证：parallel success、partial failure、stale workspace tests。
- [x] 2.2 [P0] 将 status refresh 接入 existing cadence/event path，禁止新增秒级 polling 与 AppShell root 高频 arrays；依赖：2.1；验证：hook tests + render contract review。

## 3. Adaptive Commit Workspace UI

- [x] 3.1 [P0] 保留 single-repository `GitDiffPanel` compact shape，并补 compatibility test；依赖：2.1；验证：single repository DOM snapshot/assertions。
- [x] 3.2 [P0] 新增 multi-repository groups，展示 repository name、branch、file count、error/loading 与 existing file rows；依赖：2.1；验证：multi group component tests。
- [x] 3.3 [P0] 将 commit selection 改为 repository-keyed tri-state model，隔离同名 relative paths；依赖：3.2；验证：same-path two-repository selection tests。

## 4. Multi-Repository Mutations

- [x] 4.1 [P0] 实现 deterministic sequential repository commit orchestration 与 repository-level outcomes；依赖：1.2、1.3、3.3；验证：all success、partial failure、all failure tests。
- [x] 4.2 [P0] 实现 commit-and-push 仅 push 本轮 commit 成功 repositories，并区分 commit/push failure；依赖：4.1；验证：mixed commit/push outcome tests。
- [x] 4.3 [P1] 增加 i18n 与 result summary，成功组刷新/清 selection，失败组保留 selection；依赖：4.1、4.2；验证：component/controller tests。

## 5. Specs And Verification

- [x] 5.1 [P1] 同步 `dev-guidelines` 的 repository-scoped Git identity、adaptive single/multi UI 与 partial success executable contract；依赖：1-4；验证：index links 与 referenced symbols/commands 存在。
- [x] 5.2 [P0] 运行 focused Vitest、`npm run typecheck`、`npm run check:runtime-contracts` 与相关 Rust tests；依赖：1-4；验证：全部通过或记录明确 pre-existing failure。
- [x] 5.3 [P0] 运行 `openspec validate add-multi-repository-git-commit-workspace --strict --no-interactive` 并执行 implementation/spec/task drift review；依赖：5.1、5.2；验证：strict validation 通过。

## 6. Independent Git History Repository Selection

- [x] 6.1 [P0] 为 Git History 增加 current-workspace repository picker，并建立独立 selected project + `repositoryRoot` state；依赖：2.1；验证：选择 child repository 不调用主 `setActiveWorkspaceId`。
- [x] 6.2 [P0] 复用 existing optional `repositoryRoot` command flow，处理 single repository、workspace-root repository、child repository 与 active workspace topology change；依赖：6.1；验证：focused AppShell/GitHistory tests。

## 7. Bottom Commit Composer Layout

- [x] 7.1 [P0] 调整 single repository diff mode DOM/layout 为 changed files 在上、commit composer 在下并吸底，保留 generate/commit/push semantics；依赖：3.1；验证：single mode DOM order 与 CSS contract tests。
- [x] 7.2 [P0] 调整 multi repository group surface 为独立 scroll region，共享 commit composer 位于底部，避免遮挡最后一行；依赖：3.2、3.3；验证：multi mode DOM order、overflow 与 selection tests。
- [x] 7.3 [P1] 同步 `dev-guidelines` 与 i18n/accessibility contract，不新增 polling 或 root render arrays；依赖：6.1-7.2；验证：spec link、accessible picker/footer assertions。
- [x] 7.4 [P0] 运行 focused Vitest、lint、typecheck、runtime contracts 与 strict OpenSpec validation；依赖：6.1-7.3；验证：全部通过或记录明确 pre-existing failure。

## 8. Multi-Repository AI And Two-Level History Picker

- [x] 8.1 [P0] 恢复 multi repository composer 的 AI engine icon/menu/loading state，并按 repository selection 传递 generation scope；依赖：7.2；验证：component test 覆盖 icon、menu callback 与 selected roots。
- [x] 8.2 [P0] 扩展 commit-message frontend/Tauri/Rust contract 接受 optional `repositorySelections`，聚合经过 scoped resolver 校验的 repository diffs；依赖：8.1；验证：service payload、Rust combined diff/invalid root tests。
- [x] 8.3 [P0] 恢复 Git History existing workspace/worktree picker，并新增跟随 History workspace 的第二层 repository picker；依赖：6.1、6.2；验证：single legacy shape、multi two-level shape、independent selection 与 stale response tests。
- [x] 8.4 [P0] 同步 Trellis contract 并运行 focused tests、lint、typecheck、runtime contracts、Rust tests 与 strict OpenSpec validation；依赖：8.1-8.3；验证：全部通过或记录明确 pre-existing failure。

## 9. Fix Git History Repository Scope Wiring

- [x] 9.1 [P0] 移除 Git History repository selection 的 `addWorkspaceFromPath` 链路，只更新 selected project + `repositoryRoot` state；依赖：8.3；验证：点击 child repository 不新增 workspace 且不调用主 `setActiveWorkspaceId`。
- [x] 9.2 [P0] 为 Git History command flow 补齐 optional `repositoryRoot` mapping，并在 Tauri/daemon 复用 `resolve_git_root_for_scope`；依赖：9.1；验证：service payload 与 Rust scoped-root tests。
- [x] 9.3 [P0] 补充切仓后的 branch/history/detail refresh 回归测试，禁止只验证 picker callback；依赖：9.1、9.2；验证：focused GitHistory/AppShell tests。
- [x] 9.4 [P0] 同步 Trellis contract，并运行 focused tests、lint、typecheck、runtime contracts、Rust checks 与 strict OpenSpec validation；依赖：9.1-9.3；验证：全部通过或记录明确 pre-existing failure。

## 10. Fix Git History Worktree Scope Parity

- [x] 10.1 [P0] 将 Git History 左侧 `GitHistoryWorktreePanel` 接入 selected `repositoryRoot`，使 status、stage、unstage、revert、commit 与 AI commit message generation 使用同一 repository identity；依赖：9.2；验证：真实组件 A→B 切仓与 scoped mutation tests。
- [x] 10.2 [P1] 左侧 worktree root label 跟随 selected repository，并在 scope change 时清理旧仓瞬态 state、拒绝 stale response；依赖：10.1；验证：旧文件不残留且 root label 更新。
- [x] 10.3 [P0] 运行 focused Vitest、typecheck、runtime contracts 与 strict OpenSpec validation；依赖：10.1、10.2；验证：全部通过或记录明确 pre-existing failure。

## 11. Isolate Git History Repository Lifetime

- [x] 11.1 [P0] 将 `GitHistoryWorktreePanel` component key 绑定 `workspaceId + repositoryRoot`，严格区分 legacy `null`、workspace-root `""` 与 child root；依赖：10.1；验证：History repository picker 切换后 worktree component remount。
- [x] 11.2 [P0] scope change 时立即清零 parent worktree summary，防止新仓 loading/error 期间残留旧仓统计；依赖：11.1；验证：summary callback 先收到 zero，失败后仍保持 zero。
- [x] 11.3 [P0] 增加 in-flight mutation、in-flight AI generation 与 same-relative-path selection regression tests，确保旧 repository closure 不污染当前 repository UI；依赖：11.1；验证：focused GitHistory tests。
- [x] 11.4 [P0] 同步 Trellis executable contract，并运行 focused tests、lint、typecheck、runtime contracts 与 strict OpenSpec validation；依赖：11.1-11.3；验证：全部通过或记录明确 pre-existing failure。
