# Claude Auto-Compact 验收记录

## 范围

- 仅验证 Claude Code 引擎链路。
- 不影响 Codex/OpenCode/Gemini 既有行为。

## 成功路径（Prompt is too long -> 自动 /compact -> 重试成功）

1. 构造超长上下文输入，触发 Claude `Prompt is too long`。
2. 观察后端事件：
   - 出现 `thread/compacting`。
   - 自动发送一次隐藏 `/compact`。
   - 出现 `thread/compacted`。
   - 原请求仅重试一次并成功完成。
3. 观察前端状态：
   - `isContextCompacting` 在 compacting 时为 `true`。
   - compact 完成后恢复为 `false`。
   - 线程消息出现单条 `Context compacted.`。

## 失败路径 A（自动 /compact 失败）

1. 人为制造 `/compact` 失败（CLI/网络/Provider 异常）。
2. 观察后端事件：
   - `thread/compactionFailed`（包含 reason）。
   - 终态 `turn/error`。
3. 观察前端状态：
   - 不残留 processing。
   - 显示 compaction failed 错误提示。

## 失败路径 B（/compact 成功但重试仍失败）

1. 保持超长输入或制造后续 provider 错误，确保重试失败。
2. 观察后端：
   - 仅一次自动 `/compact`。
   - 最终 `turn/error` 收口。
3. 观察前端：
   - 状态正确收敛到失败，不出现无限重试。

## 自动化回归（本次执行）

- `cargo test --manifest-path src-tauri/Cargo.toml prompt_too_long_detection_matches_common_variants`
- `cargo test --manifest-path src-tauri/Cargo.toml prompt_too_long_marker_roundtrip`
- `cargo test --manifest-path src-tauri/Cargo.toml convert_event_maps_system_compacting_to_raw`
- `cargo test --manifest-path src-tauri/Cargo.toml compact_boundary`
- `cargo test --manifest-path src-tauri/Cargo.toml compaction_failed`
- `cargo test --manifest-path src-tauri/Cargo.toml claude_raw_compacting_maps_to_thread_compacting`
- `cargo test --manifest-path src-tauri/Cargo.toml non_claude_raw_compaction_signal_stays_raw_passthrough`
