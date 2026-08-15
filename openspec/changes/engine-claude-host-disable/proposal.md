# Proposal: engine-claude-host-disable

> Wave：3F（第一根插头 · 插座级 disable-not-delete）  
> 依赖：3C 假激活、1B2 Host disable

## Why

Claude 已有 Manifest / 假激活 / 默认 off 门面。合同下一步是 disable 插头，不是删 `engine/claude*`。3F 只对 fixture 走 Host disable + Broker 拒绝，并证明产品源码仍在。

## 边界

1. 激活 `com.mossx.engine.claude` fixture 后 `disable`。
2. 再 activate / Broker read MUST 失败。
3. `src-tauri/src/engine/claude.rs` MUST 仍存在。
4. 不改 EngineManager 生产路径，不迁 Notes。

## Capabilities

- `engine-claude-host-disable-v1`
