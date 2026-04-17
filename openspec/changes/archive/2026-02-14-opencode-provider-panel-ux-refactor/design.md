## Context

当前面板存在“重复决策 + 反馈滞后”：

- 用户在 UI 先选 Provider，再进入 CLI 仍需确认，形成双重选择。
- 凭据检查依赖手动按钮触发，导致页面初始状态经常过期。
- 模型已切换但 Provider 状态文案不跟随变化，用户误判当前连接。

## Goals / Non-Goals

**Goals:**

- 连接入口最小化：UI 不做 Provider 预选，交由 CLI 完成最终选择。
- 认证信息可读性提升：默认展开 + icon 分组 + 关键词着色。
- 状态过程可见：model 切换时展示阶段性提示文案。
- 自动检查：面板打开即自动触发凭据检查并刷新。

**Non-Goals:**

- 不修改 OpenCode CLI 认证协议。
- 不新增后端持久化结构。
- 不改 Claude/Codex 共享面板行为。

## Decisions

### Decision 1: Provider 连接入口采用 CLI-first

- 方案：移除 Provider 下拉与预选代码，`连接 Provider` 按钮只触发 CLI 连接流程。
- 理由：消除前端/CLI 双重决策，避免 UI 与 CLI 状态偏差。

### Decision 2: 已完成认证区域默认展开并分层展示

- 方案：默认 `expanded=true`；使用 icon 标识“状态/已认证列表/匹配结果”；关键字（如 `已连接`、`匹配`、`未连接`）着色。
- 理由：用户打开即能看到关键诊断，不再额外交互。

### Decision 3: 三个下拉区头部改 icon-only

- 方案：Agent/Model/Variant 的标题文本移除，仅保留图标（带 aria-label）。
- 理由：减少视觉噪音，保留语义通过无障碍属性表达。

### Decision 4: Provider 状态文案与 Model 选择联动

- 方案：引入轻量状态机：`idle -> switching_model -> checking_provider -> synced|mismatch`。
- 理由：给用户可见过程，降低“点击后无反馈”的不确定感。

### Decision 5: 凭据检查改自动触发

- 方案：面板 `onOpen` 自动触发 `checkCredentials()`；移除手动按钮；检查完成后刷新 Provider/认证摘要。
- 理由：保证首屏状态新鲜，减少无效操作。

## State Flow (Pseudo)

1. 面板打开
2. 自动触发凭据检查
3. 渲染“认证状态 + 已完成认证 + 当前 Provider”
4. 用户切换 model
5. 文案显示“Provider 切换中...”
6. 触发 provider 对应状态计算/检查
7. 文案更新为“已同步到 <provider>（已连接/未连接）”

## Risks / Trade-offs

- 自动检查频率过高：通过“仅 onOpen 触发 + 防抖”控制。
- icon-only 可理解性下降：通过 tooltip 与 aria-label 补足。
- 状态文案闪烁：对短时中间态设置最小展示时长（如 300ms）。

## Migration Plan

1. 删 UI Provider 下拉与“检查凭据”按钮。
2. 接入面板打开自动检查。
3. 改造认证区域默认展开与视觉层级。
4. 接入 model->provider 文案联动状态机。
5. 执行 OpenCode-only 回归验证。
