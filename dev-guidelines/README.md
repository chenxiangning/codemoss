# Implementation guidelines（mossx）

本目录是 code-level 实现规范与 executable contract 的沉淀位置（原 `dev-guidelines/**`）。

行为 / proposal / change 仍以 `openspec/**` 为准；本目录不承担 active change 审计历史。

## 索引

| 层 | 入口 | 用途 |
|---|---|---|
| Frontend | [`frontend/index.md`](frontend/index.md) | React / TypeScript / UI 实现规范 |
| Backend | [`backend/index.md`](backend/index.md) | `src-tauri` Rust 实现规范 |
| Guides | [`guides/index.md`](guides/index.md) | 跨层思考、native API、shell 等指南 |
| Multi-agent | [`multi-agent/contracts.md`](multi-agent/contracts.md) | 多 agent orchestration contracts |

## 最小读取

- 实现前端任务：先读 `frontend/index.md`，再按 checklist 打开具体 guideline。
- 实现后端任务：先读 `backend/index.md`。
- 跨层 / 改规则入口：再读 `guides/project-instruction-layering-guide.md`。

上级入口：[`../AGENTS.md`](../AGENTS.md)
