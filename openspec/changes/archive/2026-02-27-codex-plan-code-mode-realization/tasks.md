## 1. Policy Core (Backend)

- [x] 1.1 [P0] 定义 `CodexCollaborationPolicy` 数据结构与模式归一化函数（input: collaborationMode payload, output:
  effective_mode + fallback_reason, verify: Rust unit test 覆盖 plan/code/invalid）。
- [x] 1.2 [P0][depends:1.1] 实现策略指令生成器（input: effective_mode, output: policy directives + policy_version,
  verify: Rust unit test 断言字段完整性）。
- [x] 1.3 [P0][depends:1.1] 在 `send_user_message_core` 接入策略计算并保留透传（input: threadId + collaborationMode,
  output: turn/start payload 含可观测字段, verify: 单测断言 payload 包含 selected/effective/fallback）。

## 2. Thread Mode State

- [x] 2.1 [P0] 新增线程级模式状态容器（Mutex map）（input: thread id, output: get/set API, verify: 并发读写单测）。
- [x] 2.2 [P0][depends:2.1,1.3] 将模式状态写入主发送链路并在缺失时回退（input: send flow, output: 稳定 effective_mode,
  verify: 单测覆盖 missing/override）。
- [x] 2.3 [P1][depends:2.2] 为 fork/resume 增加模式继承逻辑（input: parent thread mode, output: child inherited mode,
  verify: 单测覆盖继承与显式覆盖）。

## 3. Event Enforcement

- [x] 3.1 [P0][depends:2.2] 在 app-server 事件分发链路增加 mode-aware gate（input: incoming method + thread mode, output:
  allow/block decision, verify: 单测覆盖 plan pass/code block）。
- [x] 3.2 [P0][depends:3.1] 实现 `collaboration/modeBlocked` 事件结构并发射（input: blocked requestUserInput, output:
  standardized block event, verify: 单测断言 required params）。
- [x] 3.3 [P1][depends:3.1] 为未知/异常事件保留透传回退（input: unknown payload, output: no crash + passthrough, verify:
  容错单测）。

## 4. Frontend Integration

- [x] 4.1 [P0][depends:3.2] 在 `useAppServerEvents` 接入 `collaboration/modeBlocked` 消费（input: app-server event,
  output: UI-friendly callback payload, verify: hook test）。
- [x] 4.2 [P0][depends:4.1] 在消息区增加阻断提示展示（input: modeBlocked payload, output: explicit hint with Plan
  suggestion, verify: component test）。
- [x] 4.3 [P1][depends:4.2] 复核 `askuserquestion` 提示文案与 Plan path 不回归（input: code/plan mode tool item, output:
  mode-specific rendering, verify: existing + new tests）。

## 5. Observability & Diagnostics

- [x] 5.1 [P0][depends:1.3] 为 turn/start 日志添加 selected/effective/policy/fallback 字段（input: resolved mode, output:
  structured debug entry, verify: test snapshot）。
- [x] 5.2 [P1][depends:5.1] 为 enforcement 行为增加审计日志（input: blocked/pass decision, output: searchable logs,
  verify: unit test + manual grep）。

## 6. Regression Tests & Verification

- [x] 6.1 [P0][depends:1.3,2.2,3.2] 新增 Rust 测试套件：策略计算、线程状态、事件阻断（input: synthetic payloads, output:
  passing tests, verify: cargo test target modules）。
- [x] 6.2 [P0][depends:4.3] 新增前端测试套件：modeBlocked 消费与 askuserquestion 行为（input: mocked events, output:
  passing vitest, verify: vitest target files）。
- [x] 6.3 [P0][depends:6.1,6.2] 执行回归门禁（input: full test commands, output: zero regression result, verify: test
  command pass + status check）。

## 7. Rollout & Safeguards

- [x] 7.1 [P1][depends:3.2,5.1] 增加 feature flag 开关与默认策略（input: app settings/codex config, output: enforcement
  on/off control, verify: toggle test）。
- [x] 7.2 [P1][depends:7.1] 补充回滚说明与运维排障文档（input: new behavior + logs, output: rollback runbook, verify: doc
  review checklist）。
