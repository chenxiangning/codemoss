# Proposal: bound-session-management-default-scan

> OpenSpec change id: `bound-session-management-default-scan`  
> 关联：`docs/perf/2026-08-12-history-io-garbage-code-execution-todolist.md` W1-1

## Why

打开设置 → 会话管理时，`keyword` / `folder` / `archived` 会把 `list_workspace_sessions` 推成 `SessionCatalogScanMode::Exhaustive`（`usize::MAX`）。投影 summary 还用 `SESSION_CATALOG_MAX_LIMIT=9999`。进一下设置页就能打成全盘 transcript inventory。

## 目标

1. Session Management 默认 list / summary 都是 **Bounded**（沿用现有 page size / `SESSION_CATALOG_DEFAULT_LIMIT`，不发明第三套数字）。
2. 「扫描全部」必须二次确认；可取消（丢弃 in-flight request seq）。
3. 启动 / focus / 侧栏 hydrate **禁止** Exhaustive catalog。
4. archive / unarchive / delete / folder assign 后台批处理可继续 Exhaustive，但不得挂在页面 mount。

## 非目标

- 不改打开会话的 `load_*_session` 全文契约（W2）。
- 不把 Session Management 改成 Session Index only。
- 不改归属 / 归档语义；只改「默认扫多少」。
