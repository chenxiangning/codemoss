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
| `@mossx/plugin-engine-claude` | AppShell / 会话 / 模型 | `engine/claude*` 未删 |

## 仍未做

- 其余 later-plugin 产品导入仍直达 `src/features/**`
- Claude history loader / realtime adapter 还有直达导入
- 远程 Marketplace / 签名 / SBOM
- 产品 disable-not-delete / Notes 切流
