## Design Overview

本变更包含两条并行但解耦的前端改动：

1. 用户气泡输入格式保真（Formatting Fidelity）
2. Codex 外部 Spec 根提示首条注入收敛（First-Turn-Only Injection）

两者共同目标是降低聊天幕布中的“显示噪音与格式失真”，但职责边界不同：  
- Formatting Fidelity 只影响用户消息渲染观感；  
- First-Turn-Only Injection 只影响 Codex 发送前提示拼装频次。

---

## Scope and Boundaries

### In Scope

- `Messages` 用户消息显示链路（`displayText` 渲染到用户气泡）
- `useThreadMessaging` 的 Codex 文本拼装逻辑（是否拼接 Spec 根提示）
- 对应单元测试（messages / thread messaging）

### Out of Scope

- 后端 API、消息存储结构、线程 schema
- assistant markdown renderer 的行为改变
- 外部 Spec 根探测协议与 probe 规则本身

---

## Architecture Decisions

### Decision A: Display-Only Transform For User Bubble

用户输入格式保真必须是 display-only：
- 不修改消息原文 `item.text`
- 复制仍基于原文
- 仅在用户气泡渲染时使用“展示文本”

原因：避免 UI 修饰反向污染数据层，保证回溯、复制、审计一致性。

### Decision B: Codex Spec Hint Injection Gated By First Turn

Spec 根提示文本（`[Session Spec Link]` / `[Spec Root Priority]`）仅在线程首条消息拼装。

门控条件：
- `resolvedEngine === "codex"`
- 已存在 `sessionSpecLink`
- `threadItems.length === 0`

原因：首条消息足够建立上下文，后续重复拼接属于噪音，会污染实际用户输入可读性。

---

## Behavior Flow

### A) User Bubble Formatting Fidelity

1. 输入文本进入消息体系（含 `[System]... [User Input]...` 结构）
2. 现有提取逻辑得到 `displayText`
3. 对 `displayText` 执行格式保真显示处理（仅渲染侧）
4. 用户气泡按保真文本展示
5. 复制按钮仍引用原始消息文本

### B) Codex First-Turn-Only Spec Hint

1. 发送前按 workspace 解析 `customSpecRoot`
2. 若存在 root，执行 probe 获取 `sessionSpecLink`
3. 判断是否首条：`threadItems.length === 0`
4. 首条则拼接 Spec 提示；非首条直接发送用户文本
5. 所有轮次继续透传 `customSpecRoot` 参数

---

## Pseudocode

```ts
// A) Display-only fidelity
const originalUserText = item.text;
const displayText = extractUserInput(originalUserText);
const renderedText = formatForUserBubbleDisplay(displayText); // display-only
renderUserBubble(renderedText);
copyAction(() => originalUserText);
```

```ts
// B) Codex first-turn-only injection
const shouldInjectSpecHint =
  engine === "codex" &&
  !!sessionSpecLink &&
  threadItems.length === 0;

const textForCodexSend = shouldInjectSpecHint
  ? prependSpecRootContext(finalText, sessionSpecLink)
  : finalText;

sendToCodex(textForCodexSend, {
  customSpecRoot, // always keep propagation
});
```

---

## Risk Analysis

### Risk 1: First-turn判断误差导致漏注入

- 风险：若 `threadItems` 语义异常，可能首条未注入。
- 缓解：增加“空线程首条注入”与“已有消息不注入”的成对测试。

### Risk 2: 格式保真误伤普通短文本

- 风险：普通短句展示意外变化。
- 缓解：保持非结构化路径等价，增加普通文本回归样例。

### Risk 3: 提示收敛影响 spec root 可用性

- 风险：只收敛提示文本，不能影响 `customSpecRoot` 透传。
- 缓解：测试中显式断言 `customSpecRoot` 仍出现在发送参数中。

---

## Verification Plan

### Required

- `pnpm vitest run src/features/threads/hooks/useThreadMessaging.test.tsx`
- `pnpm vitest run src/features/messages/components/Messages.test.tsx`

### Manual

- 新建 Codex 会话：首条消息应包含一次 Spec Root 提示
- 同线程追问：不再重复提示
- 输入多行清单/缩进文本：用户气泡展示结构与输入一致

---

## Rollback Plan

若出现回归，可独立回滚：

1. 回滚 `useThreadMessaging` 首条门控逻辑，恢复原注入策略
2. 回滚用户气泡 display formatter 接入

二者互不依赖，可分段回滚，不影响后端协议与存储。
