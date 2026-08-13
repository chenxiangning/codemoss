---
type: reference
status: active
---

# User Input Elicitation 能力矩阵与单 UI 入口

> **最近校准**：2026-08-12 · mossx `0.8.8` · change `fix-askuserquestion-settlement-tombstone`（用户验收通过）  
> **事实边界**：以当前代码与 OpenSpec 为准；本文解释 contract，不新增 behavior requirement。  
> **相关 change**：`openspec/changes/fix-askuserquestion-settlement-tombstone/`  
> **新 CLI 接入**：[`../../research/mossx-new-cli-onboarding-guide.md`](../../research/mossx-new-cli-onboarding-guide.md)

---

## 1. 一句话

幕布上的「请求输入 / AskUserQuestion」是 **单一 UI 入口**（`RequestUserInputMessage` + 历史 `RequestUserInputSubmittedBlock`）。  
引擎差异只在 **谁 emit `item/tool/requestUserInput`、谁如何结算答案**；样式与折叠交互 **不按 CLI 分叉**。

---

## 2. Engine 能力矩阵（当前实现）

| Engine | Live 弹卡 | Backend 路径 | History 可 rehydrate 队列 | 备注 |
|--------|-----------|--------------|---------------------------|------|
| **Claude** | ✅ | Native plan：`AskUserQuestion` → kill+`--resume`；Default：MCP `mcp__ccgui__AskUserQuestion` oneshot | 受限（见 §4） | 全量实现；结算 tombstone 主战场 |
| **Codex** | ✅ | app-server `item/tool/requestUserInput` + 本地 plan prompt（`ccgui-plan-*`） | 视 app-server / snapshot | 与 Claude **共用同一 FE** |
| Gemini | ❌ | 无 | `userInputQueue: []` | 未实现 |
| Grok | ❌ | 无 | `userInputQueue: []` | 未实现 |
| Kimi | ❌ | 无 | `userInputQueue: []` | 未实现 |
| OpenCode | ❌ | 无 | 空或占位 | 未实现 |
| 其他 CLI | ❌ | 无 | — | 新接入见 §5 |

**协议事实源**

- 事件 method：`item/tool/requestUserInput`（`src/services/events.ts`）
- Engine envelope：`EngineEvent::RequestUserInput`（`src-tauri/src/engine/events.rs`）
- Claude 结算：`src-tauri/src/engine/claude/user_input.rs`（pending + MCP waiter + sole-waiter recovery）
- Codex 拦截/本地：`src-tauri/src/backend/app_server_plan_enforcement.rs`、`consume_local_user_input_request`

---

## 3. 单 UI 入口（不要再造第二套卡）

| 表面 | 组件 | 样式 |
|------|------|------|
| Live 幕布卡 | `RequestUserInputMessage` → `UserInputQuestionCard`（`flavor=request`） | `src/styles/request-user-input.css` |
| Overlay（遗留/测试） | `AskUserQuestionDialog` → 同一 `UserInputQuestionCard`（`flavor=ask`） | + `ask-user-question-dialog.css` |
| 历史已提交 | `RequestUserInputSubmittedBlock` | 与「已处理 · … ›」同构折叠 |

**结算 FE**

- `useThreadUserInput` / `useThreadUserInputEvents`
- 有界墓碑：`userInputSettlementTombstone`
- 身份：`requestUserInputIdentityKey` / submitted id：`request-user-input-submitted-<id>`

**视觉模板（2026-08-12 定稿）**

- 多题 Tab：分段控件（track + 活动段），非独立圆胶囊  
- Live 卡：幕布扁平、无重描边  
- 已提交：默认折叠一行 `已提交 · 题摘要 ›` + hairline；展开为 Q→答案列表（无选项墙卡片）

---

## 4. 结算与防幽灵卡（验收口径）

| 场景 | 期望 |
|------|------|
| 提交 / 跳过 | 卡消失；MCP/native 必须收到答案；turn 可继续 |
| 跳过 | 与提交同 IPC 路径：`answers: {}` + `skippedQuestionIds` |
| 同 identity 迟到 re-emit | tombstone / `completed=true` 禁止 re-add |
| 重开历史 | 不把尾部 incomplete / MCP ask 灌成可点 live 卡 |
| 新 tool_id 真再问 | 仍应弹出（合法二次提问） |
| request_id 漂移但仅 1 个 MCP waiter | sole-waiter recovery，禁止 CLI 永久转圈 |

---

## 5. 新 CLI 接入清单（User Input 子集）

在通用 onboarding 矩阵之外，User Input 至少勾选：

1. **是否需要 elicitation**（不需要则写决策记录，保持 `userInputQueue: []`）  
2. **Emit**：统一 `item/tool/requestUserInput`（questions / request_id / turn_id / completed）  
3. **Respond**：走现有 `respond_to_server_request` + engine pending/waiter，禁止静默 Ok 不解 waiter  
4. **FE**：只挂现有 `RequestUserInputMessage`；**禁止** per-engine 新弹层  
5. **History**：submitted 用 `requestUserInputSubmitted` + 同一 id 前缀；incomplete 勿误 rehydrate 可点卡  
6. **样式**：只改 `request-user-input.css` / dialog 共享层，禁止 engine 专用皮肤分叉  

自检：Claude default（MCP）跳过 + 提交；Codex plan 阻塞弹卡；重开会话无幽灵卡。

---

## 6. 关键路径速查

```
Engine emit RequestUserInput
  → useAppServerEvents → useThreadUserInputEvents（tombstone 闸门）
  → RequestUserInputMessage
  → respondToUserInputRequest
  → Claude: MCP oneshot / kill+resume  |  Codex: app-server / local consume
  → completed + markUserInputRequestSettled
  → RequestUserInputSubmittedBlock（历史）
```

---

## 7. 变更与验收

- OpenSpec：`openspec/changes/fix-askuserquestion-settlement-tombstone/`  
- 用户手测验收：2026-08-12 通过（跳过继续、无幽灵重弹、UI 折叠/分段控件）
