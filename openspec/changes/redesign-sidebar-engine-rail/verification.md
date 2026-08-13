# Verification: redesign-sidebar-engine-rail

## 2026-04-14 收口

### 致命 review

| 风险 | 裁定 |
|---|---|
| first-paint 二次 catalog/`setThreads` 冲掉引擎 | first-paint 在 Index+Shared 后 return |
| 后一次残缺 list 整表替换 | `setThreads` 默认 merge；SQLite first-paint 用 `mode: "replace"` 且先套 archive |
| 重启只 hydrate active 工作区 | 所有未折叠工作区各跑一次 first-paint |
| 侧栏加载扫磁盘 | first-paint `syncIfNeeded=false`；展开不再 `includeEngineDiskLists` |
| PI Tab 画成 Codex | `resolveEngineType` 含 `pi` |
| 归档会话被 merge 复活 | first-paint replace + archive overlay |

### 测试

- `useWorkspaceThreadListHydration.test.tsx`
- `sidebarEngineRail.test.ts`
- `topbarSessionTabs.test.ts`
- `sessionIndexThreadSummaries.test.ts`
- `useThreadsReducer.test.ts`
- `cargo test --lib` tombstone / per-engine list（本机已跑过相关用例）

### 未做

- `add-session-index-import-daemon`：外部 CLI → SQLite 定时导入，另开 change

### 人工

- 重启：未折叠项目应一次出齐 Index 里已有引擎
- 客户端新建 native：重启后仍在
- 折叠再展开：只再查 SQLite，不应再等磁盘
