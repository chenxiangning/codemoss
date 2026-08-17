# Proposal: plugin-pilot-disable-not-delete

> OpenSpec change id: `plugin-pilot-disable-not-delete`  
> Wave：P4.7 批次 29（协议第 7 步 Disable）  
> 依赖：Claude / Notes 产品默认已切；插排已报通电  
> 架构：`15` §3 step 7 disable-not-delete。**MUST NOT** 进 step 8 Slim。

## Why

产品路径已切 PE / 隔离 sqlite，但 inventory 仍写「产品 owner 仍是 Core」。Disable 不是删代码，是把 Core 钉成「仅显式 `0` 可回退」。源码、`cmd.spawn()`、`note_card_*_core` 必须留下。

## 目标与边界

1. 未设旗时 Claude / Notes 的 Core owner MUST 视为 disabled。
2. 显式 `0` MUST 仍能回 Core。
3. `engine/claude.rs` 与 `note_cards.rs` MUST 仍在仓库。
4. **MUST NOT** Slim，**MUST NOT** 从 registry 摘掉命令，**MUST NOT** 开 Marketplace。

## Capabilities

- `plugin-pilot-disable-not-delete-v1`
