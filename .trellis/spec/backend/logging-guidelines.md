# Logging Guidelines（backend）

## 目标

保证 issue 可追踪（traceable）、可定位（diagnosable）、可回放（auditable）。

## 日志层级建议

- `info`：关键生命周期事件（启动、切换、完成）
- `warn`：可恢复异常（fallback、生效降级）
- `error`：失败路径（command 失败、持久化失败、bridge 失败）

## 日志内容规范

- 必须包含：模块名 + 操作名 + 关键标识（workspaceId/sessionId/changeId 等）
- 不打印敏感信息（token、password、完整私密路径内容）
- 大 payload 打摘要，不直接全量 dump

## 关键链路建议埋点

- command 入口/出口
- 文件持久化（读/写/锁）
- engine 会话管理（spawn/reload/interrupt）
- external process 调用（start/stop/failure）

## 禁止项

- 仅打印“failed”无上下文。
- 把用户输入原文无脱敏写入日志。
- 在高频循环里无节制打印 info。
