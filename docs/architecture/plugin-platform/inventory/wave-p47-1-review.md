# Wave P4.7-1 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-peer`  
> 论文对齐：Process Entry 是 Host 拥有的受限 executable，路径来自 Manifest 平台图。  
> 结论：**方向正确。插头身份第一次变真。产品 CLI 仍在 Core。**

## 本批做了

- Claude 过渡仓增加 `src/process_entry.rs`（MXPC handshake peer，不是生产 CLI）
- `claude_process.rs` 按 `platforms[currentPlatform]` 解析绝对路径
- 缺文件 / `..` / 绝对声明路径 fail closed
- `boot_driver()` 仍是 `missing_executable()`
- 插排中英文案去掉「标记 / 安装卸载」残留
- 校正 `wave-layering-close` 与 `15` §5.1 过期断言

## 本批没做（有意）

- 不改 `engine/claude.rs` 生产 spawn
- 不开 `MOSSX_CLAUDE_COMPAT_FACADE`
- 不迁 Notes 表
- 不宣称 stream / storage / rollback 产品 conformance

## 下一刀

P4.7-2：把生产 Claude CLI spawn / interrupt 映射到这个 Process Entry。仍 default-off。
