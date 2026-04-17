## 1. Rust Runtime Auto Compaction Core（P0）

- [x] 1.1 [P0][depends: none][I: Codex app-server stdout events][O: per-thread compaction runtime state][V: 单测可断言 threshold/processing/in_flight/cooldown 判定] 在 `WorkspaceSession` 新增 auto compaction 线程态与判定函数。
- [x] 1.2 [P0][depends: 1.1][I: token_count/thread tokenUsage events][O: usage percent 驱动触发决策][V: 高于阈值且空闲时进入触发路径] 在 app-server 事件循环中接入 usage 更新与触发调度。
- [x] 1.3 [P0][depends: 1.2][I: Codex session send_request][O: compact RPC fallback 调用][V: 方法按顺序回退，任一成功即停止] 实现 `thread/compact/start -> thread/compactStart -> thread/compact` 兼容调用。
- [x] 1.4 [P0][depends: 1.3][I: in_flight + cooldown 控制][O: 幂等防风暴][V: 同线程 in_flight/cooldown 内不重复触发] 完成重复触发防护与失败后状态回收。

## 2. Lifecycle Events 与前端接线（P0）

- [x] 2.1 [P0][depends: 1.3][I: runtime scheduling result][O: `thread/compacting` 事件][V: 触发压缩前可观测到 compacting 事件] 在 Rust 侧发射 compaction start 事件。
- [x] 2.2 [P0][depends: 1.3][I: fallback 失败结果][O: `thread/compactionFailed` 事件][V: 所有方法失败后发失败事件且不阻断会话] 在 Rust 侧发射 failure 诊断事件。
- [x] 2.3 [P0][depends: 2.1][I: `useAppServerEvents` 路由][O: 新事件前端可消费][V: `thread/compacting` 可进入 threads handlers 且不影响已有事件] 在前端事件路由增加 compaction lifecycle 分支。

## 3. Codex-only Boundary 与回归（P0）

- [x] 3.1 [P0][depends: 1.2][I: workspace session engine scope][O: codex-only 生效][V: 非 codex 路径无新增行为] 验证并固化 runtime 仅在 Codex session 生效。
- [x] 3.2 [P0][depends: 1.4,2.3][I: Rust tests + 前端 tests][O: 可交付质量门禁][V: 新增单测通过，`pnpm tsc --noEmit` 通过] 补测试并执行最小回归。
- [x] 3.3 [P0][depends: 3.2][I: 实现结果][O: 交付说明 + 回滚步骤][V: 用户可按步骤验证并快速回滚] 输出交付摘要与介入测试清单。

## 4. Manual Trigger（P0）

- [x] 4.1 [P0][depends: 1.3][I: Codex workspace/thread context][O: `thread_compact` runtime command][V: 手动调用走同一 fallback 逻辑并返回结果] 新增 Codex 手动压缩命令。
- [x] 4.2 [P0][depends: 4.1][I: Context tooltip UI][O: Codex-only 手动压缩 icon 按钮][V: 仅 codex 渲染，点击后触发 runtime command] 在 ContextBar tooltip 增加图标按钮并接线。
- [x] 4.3 [P0][depends: 4.2][I: frontend tests + typecheck][O: 回归保障][V: 新增/更新用例通过，`pnpm tsc --noEmit` 通过] 补充测试并完成回归。
