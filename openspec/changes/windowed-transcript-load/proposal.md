# Proposal: windowed-transcript-load

> OpenSpec change id: `windowed-transcript-load`  
> 关联：`docs/perf/2026-08-12-history-io-garbage-code-execution-todolist.md` W2

## Why

侧栏已切 Session Index，但**打开一条会话**仍把整份 transcript 灌进 `itemsByThread`。本机单文件可达 30–100MiB；全量 parse + React 列表会卡死首屏。

## 目标

1. `load_*_session` 支持 `limit` / `before`（byte cursor）/ direction=older。默认 UI 先最近 N 条。
2. 省略窗口参数时保持现有全量契约（fork / resume / compact / Shared 续接）。
3. UI 首屏只挂窗口；向上加载更早历史；不损坏磁盘 transcript。
4. tool 大输出继续 redact / budget。Gemini 热路径禁止无界 `read_to_string`。
5. 不恢复流式虚拟化 / `content-visibility` / 对话级摘要墙。

## 非目标

- 不在本 change 做 Gemini JSON 窗口化（单文件 JSON 更难；W2-4 只做字段/体积 cap）。
- 不改 Session Index / Catalog。
- 不把搜索做成 FTS（W3）。
