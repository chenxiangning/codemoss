# Verification: restore-sidebar-flat-list-and-index-backfill

## 自动化（已通过）

- `cargo test --lib session_index`：22 passed（新增 4：claude offset 分页 + tombstone 不复活 / codex 分区游标推进与 complete / kimi 行 offset 分页至 EOF / backfill state roundtrip + count 排除 tombstone 与他 workspace）
- `cargo test --lib local_usage`：66 passed（候选解析公共函数抽出后无回归）
- `cargo clippy --lib`：无新增告警
- vitest `useThreadActions.threadList.test.ts`：新增 session-index cursor 合成/解码用例绿
- vitest `src/features/threads` + `src/app-shell/sections`：92 failed / 1893 passed，与 HEAD baseline（92 / 1891）逐项一致，新增 2 个测试均通过；失败全部为既有（AskUserQuestionDialog、sidebar-cache、native-session-bridges 等，HEAD 同样失败）
- vitest `Sidebar.session-folders` / `renderAppShell.sidebarTopbar` / `useWorkspaceThreadListHydration`：绿
- `npx tsc --noEmit` 绿；eslint 改动文件 0 error（仅既有 warning）

## 人工验收（5.3，用户收口确认）

- [x] 目视验收：侧栏恢复扁平混排，无 engine rail 图标行
- [x] 回填收敛与 Load Older 链路随用户验收收口提交；游标持久化、complete 停扫、tombstone 不复活由 cargo 单测钉死
