## 0. Incident (2026-08-11)

- [x] 0.1 重发洪水止血：completed-id + terminal-pulse + catch 闸门
- [x] 0.2 记录 `INCIDENT.md` 禁止重引入项
- [x] 0.3 临时关后台 → 安全版重开（cap=1 + signal deps）

## 1. P0 队列残留 / handoff 单所有者

- [x] 1.1 乐观出队（native）
- [x] 1.2 fail/catch prepend + terminal-pulse（禁止 dispatch 前 delete pulse）
- [x] 1.3 activeItems 命中等价 user 时清 handoff state
- [x] 1.4 completed-id：成功后同 id 永不自动再发
- [x] 1.5 单测：失败不连发；成功后 status 抖动不重发

## 2. P1 S1 安全版后台 auto-drain

- [x] 2.1 `MAX_BACKGROUND_QUEUE_DRAIN = 1`；`getEnableBackgroundQueueDrain()` 默认 **true**
- [x] 2.2 enqueue 写 `ownerWorkspaceId` / `ownerThreadId`
- [x] 2.3 **不**把整表 `threadStatusById` 放进 drain effect deps；改用 `queueDrainSignal`（仅有队列/inFlight 的 thread 的 p/t）
- [x] 2.4 调度：active 优先；后台 cap=1；无 status 的非 active hold
- [x] 2.5 非 active 强制 `sendUserMessageToThread(owner…)`；classify 仅 `ownerIsShared`
- [x] 2.6 native 成功 inFlight 边沿结算 + 8s 超时兜底（不重发）
- [x] 2.7 单测：闸关不后台发；闸开可后台发；hold without status

## 3. 接线与清理

- [x] 3.1 composer / app-shell 传 threadStatus、activeItems、resolveWorkspace
- [x] 3.2 删除劣质 HTML demo
- [x] 3.3 Vitest useQueuedSend + handoff **75 passed**

## 4. 验证（手工）

- [ ] 4.1 焦点：123 → 挂 456 → 自动发且 strip 空
- [ ] 4.2 离焦：A 挂队列 → 切 B → A 在 ready 后后台 drain（cap=1）
- [ ] 4.3 紧切回：不应「已回复还在条里」+ 不应同句刷屏
- [ ] 4.4 三会话各 1 队列：不卡死、不连发
