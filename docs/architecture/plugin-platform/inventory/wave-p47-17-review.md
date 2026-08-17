# Wave P4.7-17 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-first-interactive`  
> 论文对齐：`15` §3 step 6 first-interactive。产品有效事件是 Claude stream-json（`system`/`assistant`/`result`…），不是 `/bin/echo` 任意一行。  
> 结论：**方向正确。本机 Claude Code 2.1.226 经制品根 Process Entry 读到 `system` 后杀组。不称完整 stream/storage/rollback conformance。**

## 本批做了

- `is_product_valid_claude_stream_event` 抽出，产品 `send_message` 复用
- 制品根监督本机 `find_claude_code_binary`：`-p` + stream-json + verbose + include-partial-messages
- 读到产品形有效事件（本机实测 `type=system`）后 interrupt，`live_count=0`
- 缺 CLI / 相对路径跳过，不得假绿
- 默认仍 `cmd.spawn()`，boot 仍 `missing_executable()`

## 本批没做（有意）

- 不跑完整 turn / storage / rollback
- 不宣称整根插头完成
- 不开 flag、不 Slim、不改 `boot_driver()`
- 不做 Notes

## 下一刀

P4.7-18：真实 Claude CLI 完整 stream（result / 退出码）或 Notes inventory。在那之前不称插头完成。
