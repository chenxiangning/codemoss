## Phase 1: 自动引擎选择与自动回复（MVP）

- [x] 1.1 扩展 `ExternalSession` 状态字段，支持 auto flow 与引擎选择状态
- [x] 1.2 在飞书 WS 入站事件后触发 auto flow（仅处理新消息）
- [x] 1.3 自动创建 special session 并自动发送引擎选择提示
- [x] 1.4 实现引擎选择解析（`codex/claude/1/2`）和无效选择提示
- [x] 1.5 实现自动引擎路由与飞书回发（Claude/Codex）
- [x] 1.6 增加 auto flow 幂等保护与审计/指标埋点
- [x] 1.7 前端轮询补充 session 自动刷新
- [x] 1.8 回归验证（Rust tests + TS typecheck + UI tests）
