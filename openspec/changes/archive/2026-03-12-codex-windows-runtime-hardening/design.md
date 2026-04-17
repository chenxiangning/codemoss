## Context

当前问题不是单点故障，而是三层断裂叠加：

1. **Composer 提交链路**  
   `useSubmitHandler` 会先从 DOM 读取文本、清空输入框，再异步触发 `onSubmit`；但 `ChatInputBoxAdapter -> Composer` 当前丢掉了这份提交文本，父层又回头读取 `100ms debounce` 后的 `text` 状态，导致“清空成功，但父层拿到旧值/空值”。

2. **Codex `turn/start` 首包等待**  
   `send_request_with_timeout` 在超时后直接移除 pending callback，前端收到 `FIRST_PACKET_TIMEOUT` 后立刻 `markProcessing(false)` 并推送失败提示。若 app-server 后续才发出 `turn/started`、`item/*` 或 `turn/completed`，用户就会感知为“先失败，过几分钟又自己好了”。

3. **Windows `.cmd` wrapper / GUI PATH 差异**  
   Rust 后端对 `.cmd/.bat` 会转成 `cmd /c`，同时默认开启 `CREATE_NO_WINDOW`。源码注释已经明确承认该 flag 可能影响某些 wrapper 的 stdio pipe。终端内 `codex` 可用，不等于 GUI 拉起的 `codex app-server` 可用。

本次设计的目标不是“把等待拉长”，而是把“未发送”“慢响应”“真失败”拆开，并让 Codex/Windows 场景有可恢复路径和可追踪诊断。

## Goals / Non-Goals

**Goals**

- 让 Composer 提交链路始终消费同一份最终文本快照。
- 让 Codex `turn/start` 首包慢场景变成**非终态 warning**，晚到事件仍能收口。
- 为 Windows CLI wrapper 场景补充足够的运行时与 doctor 诊断。
- 保持 Claude/OpenCode 现有消息生命周期语义不变。

**Non-Goals**

- 不重写 ChatInputBox contenteditable 架构。
- 不统一改造所有引擎的 turn state machine。
- 不新增新的用户设置开关来手动选择 Windows wrapper 策略。
- 不依赖修改上游 Codex CLI 协议。

## Decisions

### Decision 1: 提交文本快照必须沿调用链同步传递

- 方案 A：继续在 Composer 中读取 `text` state。
  - 优点：改动少。
  - 缺点：天然受 `debounce`、IME、异步清空影响。
- 方案 B：把 `useSubmitHandler` 捕获到的 `content` 明确传到 `ChatInputBoxAdapter.onSend`，再传到 `Composer.handleSend`（选用）。
  - 优点：发送文本与用户最后一次 DOM 快照一致。
  - 缺点：需要调整 `onSend` 签名与相关测试。

结论：采用 **B**。`Composer.handleSend` 以“提交快照”为准，只在未提供快照时再回退到本地 state。

### Decision 2: Codex 首包超时改为“可恢复等待”，但 initialize 失败仍然致命

- 方案 A：简单增加 `turn/start` timeout。
  - 优点：实现简单。
  - 缺点：不能解释晚到事件，仍会把慢请求误判为失败。
- 方案 B：区分 `initialize` 与 `turn/start first packet` 两类超时（选用）。
  - `initialize` 超时：保持 fatal，直接说明 app-server 启动失败。
  - `turn/start` 首包超时：向前端返回可识别 warning，前端保持线程为 processing 状态，等待后续事件。

结论：采用 **B**。这符合用户实际感知，也不掩盖真正的 app-server 启动故障。

### Decision 3: 为超时后的晚到 `turn/start` 响应保留恢复窗口

- 方案 A：超时后彻底丢弃 pending request。
  - 优点：实现已存在。
  - 缺点：若晚到的是 `turn/start` 结果且无对应 method 事件，前端永远无法恢复。
- 方案 B：在超时后将请求元数据转入短期 `timed_out_requests`，解析循环遇到晚到响应时做兼容恢复（选用）。
  - 对 `turn/start` 晚到结果，优先提取 `threadId + turnId`，必要时向前端发合成 `turn/started` 事件。
  - 保留有限 grace window，避免无界内存增长。

结论：采用 **B**，这样“超时但最终成功”的场景可以自愈，而不依赖特定服务端事件顺序。

### Decision 4: Windows wrapper 修复以“诊断增强 + 启动兜底”组合落地

- 方案 A：只在 doctor 中展示更多信息。
  - 优点：风险低。
  - 缺点：对真实运行时问题没有缓解，只能让用户自己猜。
- 方案 B：共享 launcher 保留现有隐藏控制台路径，并在 `.cmd/.bat` + probe/initialize 失败时启用一次兼容兜底重试；同时暴露 wrapper 类型与 probe 结果（选用）。
  - 优点：对 Windows GUI 启动差异有实际缓解。
  - 风险：失败重试路径需要控制触发条件，避免常态弹出可见控制台。

结论：采用 **B**，但仅在 wrapper 场景失败后触发一次兜底，不改变其他平台或非 wrapper 常规路径。

### Decision 5: Codex Doctor 承担“GUI 与终端差异解释器”角色

现有 `codex_doctor` 已有入口和 Debug 区域，因此本次不新增 UI 入口，只扩展返回字段与展示：

- `resolvedBinaryPath`
- `wrapperKind`（`direct` / `cmd-wrapper` / `bat-wrapper` / `unknown`）
- `pathEnvUsed`
- `proxyEnvSnapshot`
- `appServerProbeStatus`
- `fallbackRetried`

这样用户可直接看到：Moss 实际用了哪个 binary、是不是 `.cmd`、当时 PATH/代理是什么、probe 是否卡在 app-server。

## Risks / Trade-offs

- [Risk] 首包超时改为非终态后，极端情况下线程可能保持 processing 更久。  
  Mitigation: 仅对 Codex `FIRST_PACKET_TIMEOUT` 特判；真正 `turn/error`、`initialize` 失败仍立即收口。

- [Risk] 晚到响应恢复逻辑可能与现有 method 事件重复。  
  Mitigation: 只在“超时后已无 pending receiver”的 `turn/start` 响应上合成最小事件，并通过 thread/turn 去重。

- [Risk] Windows wrapper fallback 可能带来额外启动成本。  
  Mitigation: 仅限 `.cmd/.bat` 且首次 probe/initialize 失败时触发一次，不改变默认快路径。

- [Risk] 提交快照修复可能影响历史记录与附件时序。  
  Mitigation: 以提交快照为单一输入源，并补“文本 + 附件 + IME + Enter/Click”组合测试。

## Migration Plan

1. 先改前端提交链：
   - `useSubmitHandler` 保持读取 DOM 快照；
   - `ChatInputBoxAdapter` 转发 `content + attachments`；
   - `Composer.handleSend` 优先使用提交快照。
2. 再改 Codex runtime：
   - `send_request_with_timeout` 为超时请求保留 grace metadata；
   - `turn/start` 超时生成 recoverable warning；
   - 解析晚到响应时补发合成 `turn/started`（仅必要时）。
3. 改前端 Codex send/error 处理：
   - `FIRST_PACKET_TIMEOUT` 不再立即 `markProcessing(false)`；
   - 转为 warning/提示并继续等待后续事件。
4. 增强 Windows launcher / doctor：
   - 识别 wrapper 类型；
   - 增加 probe/initialize 失败兜底重试；
   - 扩展 `CodexDoctorResult` 与设置页展示。
5. 补测试并跑最小回归。

## Rollback

- 前端提交链回滚：恢复 `Composer` 从本地 `text` state 读取发送文本。
- Codex 恢复逻辑回滚：关闭 timed-out request grace map 与 frontend timeout warning 特判，恢复原始失败路径。
- Windows wrapper 回滚：保留 doctor 字段，关闭 runtime fallback retry。

## Open Questions

- 若 Windows wrapper fallback 仍失败，是否需要在 UI 中显式提示“尝试设置绝对 binary 路径而非 PATH 解析”？本期先通过 doctor 输出支撑，不新增额外弹窗。
- 若 Codex 服务端只返回晚到 `result`、完全不发 method 事件，是否还需要额外合成 `turn/completed`？本期先做 `turn/started` 恢复，必要时在实现中根据实际 payload 补最小完成事件。
