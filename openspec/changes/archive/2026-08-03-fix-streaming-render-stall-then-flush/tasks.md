## 1. 设计与规范收口

- [x] 1.1 [P0，无依赖] 修订 `docs/perf/streaming-render-stall-design-2026-07-30.md`：输入为已审计问题，输出为不恢复 adaptive rendering、不声明虚假 DOM SLA、明确 Shared defer 独立归因的实施版；通过文档交叉检查验证
- [x] 1.2 [P0，依赖 1.1] 校验 OpenSpec artifacts 与设计文档一致，输出可实施 contract；通过 `openspec validate fix-streaming-render-stall-then-flush --strict` 验证

## 2. Live text 发布节奏

- [x] 2.1 [P0，依赖 1.2] 在 `liveAssistantTextChannel` 分离 accumulated entry 与 published snapshot，输出首段立即、后续 48ms throttle + trailing publish；通过 focused fake-timer tests 验证
- [x] 2.2 [P0，依赖 2.1] 收口 clear、drain、rename、reset 的 timer 与无损语义，输出无 stale callback / terminal 文本丢失；通过 focused edge-case tests 验证
- [x] 2.3 [P0，依赖 2.2] 更新 `useLiveAssistantText` focused tests，输出符合 `useSyncExternalStore` stable snapshot contract 的订阅行为；通过对应 Vitest 验证

## 3. Row 与 Markdown 调度

- [x] 3.1 [P0，依赖 2.3] 让 channel-backed `MessageRow` 绕过重复 `useDeferredValue`，输出单一发布节奏；通过 row/live behavior focused tests 验证
- [x] 3.2 [P0，依赖 3.1] 移除 Markdown bounded timer commit 上的 `startTransition`，保留 throttle / progressive limits；通过 `useMarkdownStreamingValue` tests 验证
- [x] 3.3 [P1，依赖 3.2] 确认 adaptive rendering 硬禁用、anchor DOM 与 lightweight prompt 未改动；通过 symbol/diff inspection 验证
- [x] 3.4 [P1，依赖 3.3] 为 Shared owner defer 增加 reason、queue depth 与 bounded overflow evidence，不改变 barrier；通过 focused Rust tests 验证

## 4. 增量验证

- [x] 4.1 [P0，依赖 3.4] 运行 live channel、hook、Markdown scheduler、terminal/drain 与 Messages live behavior 增量测试
- [x] 4.2 [P0，依赖 4.1] 运行 `npm run typecheck` 与 touched-files 定向 ESLint
- [x] 4.3 [P0，依赖 4.2] 运行 OpenSpec strict validation 与变更一致性检查；不运行全量测试

## 5. Terminal causal ordering 闭环

- [x] 5.1 [P0，依赖 4.3] 修订 proposal / design / delta spec，区分 settlement terminal barrier 与 interactive urgent bypass；明确其他 engine adapter、Shared coordinator、`AgentEventBus` 非改动范围
- [x] 5.2 [P0，依赖 5.1] 修复 Codex `BatchedTauriEventSink`：terminal flush 同 sink、同 workspace predecessors 后追加 terminal，其他 workspace 保持 queued；通过 focused Rust tests 验证 ordering、isolation 与 stats
- [x] 5.3 [P0，依赖 5.2] 为 unified `appServerEventBackpressure` 增加 optional causal barrier key，只对 app-server settlement terminal 启用；通过 focused unit tests 验证 batch/single ordering、urgent bypass 与 workspace isolation
- [x] 5.4 [P0，依赖 5.3] 增加 frontend integration regression，覆盖 `delta → item/completed → turn/completed` 与 Shared projected identity，证明 terminal guard 前 final content 已 dispatch
- [x] 5.5 [P0，依赖 5.4] 同步 `dev-guidelines` 与 performance design，运行 focused Rust/Vitest、typecheck、定向 ESLint、format/diff/OpenSpec strict checks；不运行全量测试
