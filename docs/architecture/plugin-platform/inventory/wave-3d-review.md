# Wave 3D Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-compat-adapter`  
> 结论：**方向正确。停在单 owner 门面。** 下一刀才是 feature-flag dual-run（3E），禁止从此处删 `engine/claude*`。

## 方向

| 检查 | 结果 |
|---|---|
| 单 owner | 通过。只有 `CompatOwner::CoreClaude` |
| 委托不复制 | 通过。session 走 `ClaudeSessionManager`；event 走 `BuiltinEngineAdapter` |
| registry 未替换 | 通过。`adapter_id` 仍为 `builtin.claude`，7 个 builtin |
| 不改 `engine/claude*` | 通过。本刀无生产 Claude diff |
| 不进 boot / 不 dual-run | 通过。`lib.rs::run` 未构造门面 |
| 未开 Notes / Marketplace | 通过 |

## 证明

- `cargo test --lib plugin_runtime::claude_compat`：4 passed
- `openspec validate engine-claude-compat-adapter --strict --no-interactive`：valid
- 同 workspace 两次 `get_or_create_session` → `Arc::ptr_eq`

## 颗粒度

3D 只加替换点类型，不切流量。这是对的：dual-run 必须能单独回滚。

## 下一阶段边界（锁定）

**3E：`engine-claude-dual-run-flag`。**  
默认 off。flag on 时产品路径经门面读 session，内部仍是 Core Claude。  
禁止：第二个 live owner、删 Core、搬 history、开 Notes。
