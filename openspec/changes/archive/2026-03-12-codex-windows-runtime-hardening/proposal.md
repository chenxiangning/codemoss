## Why

Windows 下的 Moss `codex` 对话链路存在两类高频不稳定现象：一类是输入框提交后消息偶发未真正发出，另一类是 `turn/start` 首包超时后前端先判失败、几分钟后又收到晚到结果。问题已经直接影响核心聊天可用性，而且会把 GUI 启动差异误判成“纯网络/代理问题”，需要尽快收敛为可恢复、可诊断、可验证的运行时行为。

## 目标与边界

- 目标：修复 Composer 提交链路对最新输入快照的不一致消费，保证 `Enter / 点击发送 / IME` 都发送同一份最终文本。
- 目标：强化 Codex runtime 在 Windows 下的首包等待、晚到事件恢复、wrapper 诊断与可观测性。
- 目标：让用户可以区分“输入根本没发出去”“Codex 会话启动失败”“Codex 首包慢但仍在继续”这三种状态。
- 边界：本次只修 `codex` 运行时和通用 Composer 提交流程，不重写 Claude/OpenCode 的消息生命周期模型。
- 边界：不修改上游 Codex CLI / app-server 协议定义；若需兼容，仅在本地桥接层做兼容与诊断增强。
- 边界：不引入新的全局设置项；Windows wrapper 兼容以默认安全兜底和 doctor 诊断为主。

## 非目标

- 不做全引擎统一超时框架重构。
- 不实现新的代理配置中心或系统级网络探测。
- 不重构整个 ChatInputBox 编辑器架构。
- 不改变 Claude/OpenCode 既有用户可见交互语义。

## What Changes

- 新增 `codex-runtime-resilience` capability：
  - 将 Codex `initialize` 致命失败与 `turn/start` 首包慢区分处理。
  - 为 `turn/start` 超时增加“可恢复等待”语义，并允许晚到响应或晚到事件继续驱动当前线程。
  - 增强 Windows `.cmd/.bat` wrapper 路径的可诊断性与兼容兜底。
  - 扩展 `codex_doctor` 输出，暴露解析到的 binary、wrapper 类型、PATH/代理上下文、app-server probe 结果。
- 新增 `composer-submit-integrity` capability：
  - 将 ChatInputBox 实际提交的文本快照一路传到 Composer 发送入口。
  - 消除 `debounce + clearInput + IME` 组合下“输入框清空但父层读到旧值/空值”的问题。
  - 保证文本与附件使用同一份提交快照，不因按钮/快捷键路径不同而分叉。
- 共享 Windows launcher 工具做最小硬化，但 Claude/OpenCode 仅继承底层兼容改善，不引入新的超时或等待语义。

## 技术方案对比与取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A. 只增大超时并提示重试 | 拉长 `turn/start` 等待时间，前端仍按失败处理 | 改动最小 | 不能修复输入丢失；也不能解释晚到结果，用户仍感知为“假失败” | 不选 |
| B. 分层修复提交链路 + Codex 首包恢复 + Doctor 诊断（选用） | 前端用提交快照；Codex 首包超时改为非终态；晚到响应可回接；doctor 输出增强 | 直接覆盖根因，边界清晰，可逐层验证 | 需要同时修改前后端与测试 | 选用 |
| C. 统一重写所有引擎生命周期状态机 | 抽象 Claude/Codex/OpenCode 统一 turn runtime | 长期一致性最好 | 本期范围过大，回归成本高，容易拖慢交付 | 本期不选 |

## 验收标准

- 在 Composer 中快速输入后立即 `Enter` 或点击发送，系统 MUST 使用最新可见文本快照发送消息，不得出现“输入框清空但消息未发送”。
- Windows IME 输入结束后立刻提交，系统 MUST 发送已确认文本一次且仅一次。
- Codex `turn/start` 首包超时后，前端 MUST 不再立即把该线程判为终态失败；若后续收到 `turn/started`、`item/*` 或 `turn/completed`，线程 MUST 能继续完成本轮对话。
- Codex `initialize` 超时或 app-server 真正不可用时，系统 MUST 仍返回明确致命错误，不得无限等待。
- Codex doctor MUST 输出足以定位 GUI/Terminal 差异的关键诊断：解析到的 binary、wrapper 类型、PATH、代理上下文、Node 检查、app-server probe 结果。
- Claude/OpenCode 的现有发送与生命周期测试 MUST 不因本次改动回退。

## Capabilities

### New Capabilities

- `codex-runtime-resilience`: 为 Codex 提供可恢复首包等待、晚到事件对齐、Windows wrapper 兼容与 doctor 诊断能力。
- `composer-submit-integrity`: 为 Composer 提供最新输入快照一致提交能力，覆盖按钮、快捷键与 IME 场景。

### Modified Capabilities

- （无）

## Impact

- Frontend:
  - `src/features/composer/components/ChatInputBox/hooks/useSubmitHandler.ts`
  - `src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.tsx`
  - `src/features/composer/components/Composer.tsx`
  - `src/features/threads/hooks/useThreadMessaging.ts`
  - `src/features/settings/components/SettingsView.tsx`
- Backend:
  - `src-tauri/src/backend/app_server.rs`
  - `src-tauri/src/shared/codex_core.rs`
  - `src-tauri/src/codex/mod.rs`
  - `src-tauri/src/utils.rs`
- Tests:
  - Composer / ChatInputBox 相关 Vitest
  - `useThreadMessaging` / `useThreadTurnEvents` 相关 Vitest
  - Rust backend 单测（Codex app-server / doctor / Windows command builder）
