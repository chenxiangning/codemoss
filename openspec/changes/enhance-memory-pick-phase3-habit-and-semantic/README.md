# Change: enhance-memory-pick-phase3-habit-and-semantic

**Memory Pick Phase-3** —— 习惯可留 + 语义真可用（应用内模型、可关）。

## 一句话

> Phase-1 立闸门，Phase-2 立检索核与转接语义；  
> **Phase-3**：session 持久化 / dismiss 恢复、`~/.ccgui` 按需下载 ONNX、embed-index 旁路、设置页「项目记忆」与检索模式开关；采集 ABCD 零回归。

## 状态

- [x] Proposal / Design / Tasks / Specs delta  
- [x] 拍板：方案 A、匹配 1s 冻结、dismiss→pick、模型 **运行时下载到用户主目录 `.ccgui/models/embedding/`**（不打进安装包）  
- [x] Implementation（W1–W5 + 门槛/预热/设置 UX）  
- [x] 人工验收通过（2026-08-10）  
- [x] Commit / Trellis session record  
- [ ] Sync 主 specs / Archive（可选后续）

## 文档清单

| 顺序 | 文件 | 内容 |
|------|------|------|
| 1 | [proposal.md](./proposal.md) | Why、范围、验收 |
| 2 | [design.md](./design.md) | provider / 持久化 / 恢复 / 索引 / 设置 |
| 3 | [tasks.md](./tasks.md) | 实现任务 |
| 4 | [specs/](./specs/) | 行为 delta |
| 前置 P1 | [add-memory-pick-gate](../add-memory-pick-gate/) | 闸门 |
| 前置 P2 | [enhance-memory-pick-retrieval-and-observability](../enhance-memory-pick-retrieval-and-observability/) | hybrid 核 + 可感 + 转接 |
| 调研 | [06-…](../../../docs/research/06-memos-vs-mossx-memory-upgrade-research-2026-08-10.md) | MemOS 对照 |

## 落地能力摘要

| 能力 | 结论 |
|------|------|
| Session | localStorage 持久化 mode/dismissed/firstPick/preferredCount |
| Dismiss 恢复 | Composer「恢复记忆参考」→ pick |
| Embedding | 设置页下载到 **用户主目录** `.ccgui/models/embedding/`（绝对路径本机解析，跨 mac/win/linux） |
| Index | workspace 旁路 `embed-index.v1.json`；异步 enqueue，失败不挡采集 |
| 检索偏好 | 开关：语义 hybrid / 强制词面（有模型也可关） |
| 质量 | min 向量/final 门槛；词面满分不稀释；检索禁全量 embed；预热 |
| 匹配 UI | `PICK_MATCH_MIN_DISPLAY_MS=1000` 冻结 |
| 设置 UX | 侧栏「项目记忆」、规则说明、效果示意默认折叠 |

## 明确不做

- 用户安装 Ollama / 云 Key 作前提  
- 替换 JSON 主记忆库  
- 缩短匹配 1s  
- L2/L3 / MemOS 全栈  
