# Wave P4.7-3 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-map-bin`  
> 论文对齐：Process Entry 拥有 CLI transport；生产 bin 必须可审计，禁止 PATH fallback。  
> 结论：**方向正确。映射已真。产品 spawn 仍在 Core。**

## 本批做了

- `map_claude_bin_to_supervise`：只接受绝对路径 + allowlist + 真实文件
- `claude_process_driver_for_bin`：Process Entry 与 bin 都合法才 `with_supervise`
- 空 / 相对 / `claude` / `/bin/bash` / 缺 Process Entry → `missing_executable`
- boot / `ClaudeSession::resolve_cli_binary` / `cmd.spawn` 未改

## 本批没做（有意）

- 不把生产 `ClaudeSession::spawn` 换成 supervise
- 不开 flag、不 Slim、不开市场
- 不宣称产品 stream / interrupt conformance

## 下一刀

P4.7-4：default-off dual-run，把生产 spawn 切到该映射。同一时刻仍只有一个 active owner。
