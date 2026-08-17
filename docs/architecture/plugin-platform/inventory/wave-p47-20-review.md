# Wave P4.7-20 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-dual-run-default-core`  
> 论文对齐：`15` §3 Dual-run。同一时刻只有一个 owner。3AN 只记 compat 门面，已过期。  
> 结论：**方向正确。Process Entry 是真插头，产品默认仍 Core。不称整根插头完成。**

## 本批做了

- 刷新 `claude-dual-run-close.md` / `.json`：记录 Process Entry opt-in
- 钉测试：两旗 + Notes 旗默认关；默认 `CoreCommand` + Tokio；flag-on 合法 plan 走 PE；无 plan Denied
- 产品仍 3 处 `cmd.spawn()`（`send_message` + 两条 resume）
- `boot_driver()` 仍 `missing_executable()`

## 本批没做（有意）

- 不默认开 flag
- 不 Slim、不迁 Notes 表
- 不宣称产品默认路径 stream / storage / rollback conformance

## 目标状态

真实插排 + Claude 真插头（opt-in）已落地。产品默认仍 Core。Notes 仍 inventory。目标未完成，不得 mark complete。
