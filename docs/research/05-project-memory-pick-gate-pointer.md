---
type: research
status: active
---

<!-- DOC-LIFECYCLE: active-pointer -->

# Project Memory · Pick Gate 文档指针

**更新**: 2026-08-11  
**用途**: 把「发送前记忆挑选闸门」与 Phase-2/3 检索、习惯、语义模型的实现指导收口，避免在 historical research 里分叉。

## 读哪里

| 优先级 | 路径 | 内容 |
|--------|------|------|
| 0 | `openspec/changes/add-memory-pick-gate/README.md` | **闸门 Phase-1 变更总索引** |
| 1 | `openspec/changes/add-memory-pick-gate/ux.md` | **UI/UX 定稿**（时序、C 布局、交互矩阵、a11y、文案 key） |
| 2 | `openspec/changes/add-memory-pick-gate/design.md` | **工程设计**（架构、状态机、DTO、编排、测试、触点） |
| 3 | `openspec/changes/add-memory-pick-gate/proposal.md` | Why / 边界 / 拍板表 |
| 4 | `openspec/changes/add-memory-pick-gate/tasks.md` | 实现任务拆分 |
| 5 | `openspec/changes/add-memory-pick-gate/specs/**` | 行为 delta |
| 6 | `docs/prototypes/memory-pick-gate-ui-variants.html` | 可交互金样 |
| **7** | **`docs/research/06-memos-vs-mossx-memory-upgrade-research-2026-08-10.md`** | **MemOS 对照调研 + Phase-2 匹配/可观测/转接决策** |
| **8** | **`openspec/changes/enhance-memory-pick-retrieval-and-observability/`** | **Phase-2** hybrid 核 + 可感 + 转接（已实现） |
| **9** | **`openspec/changes/enhance-memory-pick-phase3-habit-and-semantic/`** | **Phase-3** 语义索引 + session 持久化 + dismiss 恢复 + 设置「项目记忆」 |
| 10 | `openspec/specs/project-memory-local-semantic-retrieval/spec.md` | hybrid / 诚实 lexical 合同 |
| 11 | `openspec/specs/project-memory-retrieval-pack-cleaner/spec.md` | Pack / Instruction 合同 |

## 与历史文档关系

- `00`–`04` project-memory research 为 **historical / superseded** 基线，说明 Phase1 与旧消费模型。  
- **不得**用旧「仅 Claude+Codex」「隐式自动注入」章节覆盖本 change。  
- 主行为 specs 仍以 `openspec/specs/project-memory-*` 为准；闸门落地后通过 delta + sync 更新。  
- **MemOS 参考**：早期设计曾参考 MemOS；升级后的对照结论只以 `06-memos-vs-mossx-…` 为准，勿从旧口头印象推断。

## Phase 状态

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase-1 Pick Gate | ✅ 已合 | 时序 + 闸门 + pack source=memory-pick |
| Phase-2 匹配 + 可感 + 转接 | ✅ 已合 `af112cdde` | hybrid 核 + 时间线 emptyReason + Instruction 转接；**不改采集 ABCD** |
| Phase-3 习惯 + 真语义 | ✅ 已实现（收口提交） | session 持久化；dismiss→pick；设置页下载模型到用户主目录 `.ccgui/models/embedding/`；embed-index 旁路；语义/词面开关；hybrid 门槛与预热；**匹配最短 1s 禁止缩短** |

## 一句话

- **Phase-1**：用户气泡先待发送 → 其下闸门挑选流 → 本轮手勾或 session top(n) → 确认后才调模型。  
- **Phase-2**：hybrid 同核检索 + 空/超时可感埋点 + 注入语义转接（记忆服务原文，不抢戏）；采集写路径零回归。  
- **Phase-3**：习惯落盘；本地语义模型按需下载（非安装包）；检索可强制词面；设置「项目记忆」规则与示意。
