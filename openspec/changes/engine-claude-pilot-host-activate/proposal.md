# Proposal: engine-claude-pilot-host-activate

> Wave：3C  
> 依赖：3B Manifest + 1B Host

## Why

Manifest 已能解析，但还没证明 Host 能按 Claude unit 激活。3C 用 FakeDriver 激活 fixture 的 required closure，不调用生产 `engine::claude`。

## 边界

做：`claude_pilot.rs` 从 fixture 读 unit entries 并 `Host::activate`。  
不做：dual-run、删 Core、spawn claude CLI。

## Capabilities

- `engine-claude-host-activate-v1`

## 验收

1. `pluginId` / entries 来自 fixture。  
2. slot=`ready`。  
3. `src-tauri/src/engine/claude*` 无 diff。  
4. `openspec validate` 通过。
