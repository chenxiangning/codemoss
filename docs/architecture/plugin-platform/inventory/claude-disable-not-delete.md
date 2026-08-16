# Claude Disable-Not-Delete Inventory（Wave 3AM）

> pluginId：`com.mossx.engine.claude`  
> 状态：**inventory-only**。本刀不改实现、不 disable 产品 Claude、不删代码。

## 已有证据

Host fixture `disable_claude_fixture_keeps_core_implementation`：FakeDriver 激活后可 disable，Broker 拒绝，`engine/claude.rs` 仍在。

## 还不是产品 disable

| 面 | 现状 |
|---|---|
| 产品 runtime owner | 仍是 Core `engine/claude*` |
| flag | `MOSSX_CLAUDE_COMPAT_FACADE` 默认 off |
| registry | `builtin.claude` |
| boot | 不调用 `disable("com.mossx.engine.claude")` |

## 禁止

从 3AM 跳到删 `engine/claude*`、在 boot 里 disable 产品 Claude、默认开 flag、开 Marketplace。
