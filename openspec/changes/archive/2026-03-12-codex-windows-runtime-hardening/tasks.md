## 1. OpenSpec Delta Completion（P0）

- [x] 1.1 [P0][depends: none][I: 根因分析与边界][O: `codex-runtime-resilience` delta spec][V: 仅含 `## ADDED Requirements` 且覆盖首包恢复 / 晚到响应 / doctor 诊断] 新增 Codex 运行时韧性 spec。
- [x] 1.2 [P0][depends: none][I: Composer 提交流程问题][O: `composer-submit-integrity` delta spec][V: 仅含 `## ADDED Requirements` 且覆盖最新快照 / IME / 清空后提交一致性] 新增 Composer 提交一致性 spec。

## 2. Composer Submit Integrity（P0）

- [x] 2.1 [P0][depends: 1.2][I: ChatInputBox 提交 DOM 快照][O: `content + attachments` 贯通到 Composer][V: 快速 Enter / 点击发送时使用提交快照，不再依赖 debounce state] 修改 `useSubmitHandler -> ChatInputBoxAdapter -> Composer` 的参数链。
- [x] 2.2 [P0][depends: 2.1][I: 提交时文本/附件/历史记录路径][O: 单一提交源][V: 不出现双重 history 记录，不丢附件，不清空后再读旧值] 收敛 Composer 内部发送与清空顺序。
- [x] 2.3 [P0][depends: 2.1][I: Vitest 前端用例][O: 回归测试][V: 覆盖 Enter / 点击发送 / IME / 附件组合场景] 补充或扩展 Composer / ChatInputBox 相关测试。

## 3. Codex First-Packet Recovery（P0）

- [x] 3.1 [P0][depends: 1.1][I: `send_request_with_timeout`][O: 超时请求 grace metadata][V: `turn/start` 超时后仍可识别晚到响应，不泄漏 pending entry] 在 Rust app-server 层增加 timed-out request 恢复窗口。
- [x] 3.2 [P0][depends: 3.1][I: 晚到 `turn/start` 结果][O: 合成或恢复 `turn/started`][V: 晚到成功结果能继续驱动当前线程，而非永久失败] 在 stdout 解析循环中处理超时后的晚到响应。
- [x] 3.3 [P0][depends: 3.1][I: `FIRST_PACKET_TIMEOUT` 错误][O: 前端 warning 语义][V: Codex 首包慢时线程保持 processing，可等待后续 event 收口] 调整 `useThreadMessaging` 对 Codex 首包超时的处理。
- [x] 3.4 [P0][depends: 3.2,3.3][I: Frontend + Rust tests][O: 回归保障][V: 覆盖 timeout 后晚到事件恢复、非 Codex 不受影响] 补齐 Codex runtime 相关测试。

## 4. Windows Wrapper Diagnostics & Compatibility（P1）

- [x] 4.1 [P1][depends: 1.1][I: Windows `.cmd/.bat` launcher][O: wrapper kind 识别与 probe metadata][V: doctor/debug 能报告 resolved binary 与 wrapper 类型] 扩展 shared command builder / debug info。
- [x] 4.2 [P1][depends: 4.1][I: app-server spawn / doctor probe 失败场景][O: 受控兜底重试][V: wrapper 场景首次失败后可执行一次兼容重试，不影响非 wrapper 正常路径] 增加 Windows wrapper fallback。
- [x] 4.3 [P1][depends: 4.1][I: `CodexDoctorResult` / SettingsView][O: 用户可见诊断增强][V: 设置页能看到 resolved path、wrapper、PATH/代理上下文、probe 状态] 扩展 Codex doctor 类型与 UI。

## 5. Verification & Traceability（P0）

- [x] 5.1 [P0][depends: 2.3,3.4,4.3][I: 前端实现][O: Vitest 结果][V: `pnpm vitest run` 目标用例全绿] 运行 Composer / useThreadMessaging / SettingsView 相关前端测试。
- [x] 5.2 [P0][depends: 3.4,4.2][I: Rust 实现][O: cargo test 结果][V: Codex app-server / doctor / command builder 相关测试通过] 运行 Rust 目标测试。
- [x] 5.3 [P0][depends: 5.1,5.2][I: 完整改动][O: 类型与任务状态收口][V: `pnpm tsc --noEmit` 通过，tasks 勾选与实现一致] 完成最终对齐与交付说明。
