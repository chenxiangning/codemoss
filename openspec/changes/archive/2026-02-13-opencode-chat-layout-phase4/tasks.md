## 1. OpenCode Chat Layout 重构（P0）

- [x] 1.1 [P0][depends: none] 定义 OpenCode chat 三层结构：摘要条、主聊天区、侧边抽屉（Tab）。
- [x] 1.2 [P0][depends: 1.1] 将 Provider/MCP/Sessions/Advanced 从内联布局迁移到抽屉。
- [x] 1.3 [P0][depends: 1.2] 优化抽屉交互：Esc 关闭层级、Tab 切换、滚动区域稳定。

## 2. Provider 交互优化（P0）

- [x] 2.1 [P0][depends: 1.2] Provider 选择统一改为弹出面板（搜索 + Popular/Other 分组）。
- [x] 2.2 [P0][depends: 2.1] 对 provider 数据做 UI 侧清洗与去重，移除噪声项。
- [x] 2.3 [P0][depends: 2.2] 校验 connect/test 状态文案与真实可用性一致。

## 3. OpenCode 专属隔离护栏（P0）

- [x] 3.1 [P0][depends: 1.1] 所有布局改动仅挂载于 `activeEngine === "opencode"`。
- [x] 3.2 [P0][depends: 3.1] 补充隔离回归：Claude/Codex 不渲染 OpenCode 摘要条/抽屉。
- [x] 3.3 [P0][depends: 3.1] 检查 keyboard/focus 事件不跨引擎生效。

## 4. 视觉与可用性收口（P1）

- [x] 4.1 [P1][depends: 1.x] 统一摘要条与抽屉视觉层级（按钮主次、留白、状态色）。
- [ ] 4.2 [P1][depends: 1.x] 移动端/窄窗口适配（抽屉改底部层或全宽层）。
- [ ] 4.3 [P1][depends: 4.1] 处理超长 model/provider 文案截断与 tooltip。

## 5. 验证与发布（P0）

- [x] 5.1 [P0][depends: 1.x,2.x,3.x] 执行 `npm run typecheck && npm run lint`。
- [x] 5.2 [P0][depends: 1.x,2.x,3.x] 执行 OpenCode 关键测试（面板渲染、Tab 切换、Provider 选择）。
- [ ] 5.3 [P0][depends: 5.1,5.2] 手工回归：聊天发送、切线程、开关抽屉、Provider 连接流。
