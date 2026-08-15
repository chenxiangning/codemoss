# Design: notes-plugin-pilot-host-activate

## Decisions

### D1. 复用 3C 形状

与 `claude_pilot.rs` 同构：fixture → `ActivationRequest` → FakeDriver。不抽公共 helper 到产品路径，避免 4C 顺手改 Claude。

### D2. 不读真实 Notes 数据

`required_entries` 只来自 Manifest unit，不打开 workspace notes 目录。

### D3. 不进 boot

仅单测调用。
