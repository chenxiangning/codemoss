# Wave Product Export Surface Close

> 日期：2026-08-16  
> 范围：仓库内过渡仓从 Manifest 推进到产品导入再导出  
> 结论：**已上架 Feature + Claude 前端入口已改走包。** 实现仍在 `src/features/**` 与 `engine/claude*`。市场本地 stage 不激活 Host。产品拔插头仍是 0%。

## 产品导入改走包

| 包 | 产品路径 | 实现仍在 |
|---|---|---|
| `@mossx/plugin-kanban` | AppShell 看板 | `src/features/kanban` |
| `@mossx/plugin-notes` | 布局 / 会话 runtime+ui | `src/features/note-cards` + `note_cards.rs` |
| `@mossx/plugin-project-map` | AppShell / 布局 runtime+ui | `src/features/project-map` |
| `@mossx/plugin-intent-canvas` | AppShell / 会话 / Composer | `src/features/intent-canvas` |
| `@mossx/plugin-browser` | AppShell / 会话 / Composer | `src/features/browser-agent` |
| `@mossx/plugin-engine-claude` | AppShell / 会话 / 模型 / history | `engine/claude*` 未删 |
| `@mossx/plugin-git-history` | AppShell / Git / Files | `src/features/git-history` |
| `@mossx/plugin-spec` | AppShell / 布局 / 会话 / Files | `src/features/spec` |
| `@mossx/plugin-quick-switcher` | AppShell / Git / Search 消费 | `src/features/quick-switcher` |
| `@mossx/plugin-tasks` | AppShell / WorkspaceHome | `src/features/tasks` |
| `@mossx/plugin-terminal` | AppShell / 布局 / launch script / vendors | `src/features/terminal` |
| `@mossx/plugin-vendors` | AppShell / Settings / Composer / shared-session | `src/features/vendors` |
| `@mossx/plugin-models` | AppShell / Composer / Settings / Vendors / Engine | `src/features/models` |
| `@mossx/plugin-skills` | AppShell / Composer / Settings / Context Ledger | `src/features/skills` + `curated-skills` |
| `@mossx/plugin-commands` | AppShell | `src/features/commands` |
| `@mossx/plugin-prompts` | AppShell / Composer / Settings / 布局 | `src/features/prompts` |
| `@mossx/plugin-debug` | AppShell / 布局 / 存储维护 / 会话诊断 | `src/features/debug` |
| `@mossx/plugin-collaboration` | AppShell | `src/features/collaboration` |
| `@mossx/plugin-context-ledger` | Composer / Settings / Status / Governance | `src/features/context-ledger` |
| `@mossx/plugin-governance` | Status Panel | `src/features/governance` |
| `@mossx/plugin-status` | 布局 / Composer / Settings / subagent-ui | `src/features/status-panel` |
| `@mossx/plugin-shared-session` | AppShell / 布局 / Composer / 会话 / 设置 | `src/features/shared-session` |
| `@mossx/plugin-client-ui-visibility` | AppShell / 布局 / Settings | `src/features/client-ui-visibility` |
| `@mossx/plugin-code-annotations` | 布局 / Composer / Files / Git / Status | `src/features/code-annotations` |
| `@mossx/plugin-live-edit-preview` | AppShell | `src/features/live-edit-preview` |
| `@mossx/plugin-multi-agent` | 布局 / Composer / 会话 / Messages | `src/features/multi-agent` |
| `@mossx/plugin-subagent-ui` | 布局 / Composer / Status / Git History | `src/features/subagent-ui` |
| `@mossx/plugin-dictation` | App 控制器 | `src/features/dictation` |
| `@mossx/plugin-computer-use` | Settings Codex | `src/features/computer-use` |
| `@mossx/plugin-agent-catalog` | AppShell / 会话 / Composer / Settings | `src/features/agent-catalog` |
| `@mossx/plugin-client-documentation` | AppShell / router | `src/features/client-documentation` |

## 仍未做

- Search 是 Core（`targetPluginId=null`），不能发明 `com.mossx.search`
- 其余 later-plugin 产品导入仍直达 `src/features/**`
- 远程 Marketplace / 签名 / SBOM
- 产品 disable-not-delete / Notes 切流
