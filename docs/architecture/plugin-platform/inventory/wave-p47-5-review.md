# Wave P4.7-5 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-stdio`  
> 论文对齐：Process Entry 拥有 CLI transport；stdio 走封闭 MXPC，产品 stream 未切前禁止双 owner。  
> 结论：**方向正确。中继已真。产品 send_message 仍 cmd.spawn。**

## 本批做了

- supervise 后 CLI stdin/stdout 改为 pipe
- 封闭方法：`mossx.process.stdio.write` / `read` / `close-stdin`（`dataHex`）
- Host driver 可 write / read / close-stdin
- `/bin/echo` 输出可读；`/bin/cat` 可回环
- 产品 `send_message` / boot / flag 默认关 未改

## 本批没做（有意）

- 不把 `ClaudeSession::send_message` 换成中继
- 不开 MXPD、不宣称 stream conformance
- 不开 flag、不 Slim、不开市场
- flag-on 仍 `process-entry-spawn-not-cutover`

## 下一刀

P4.7-6：default-off 把生产 `send_message` 的 stdin/stdout 切到该中继。同一时刻仍只能有一个 owner。
