# Design

```text
默认
  MOSSX_CLAUDE_PROCESS_ENTRY 未设 → CoreCommand + Tokio
  MOSSX_CLAUDE_COMPAT_FACADE 未设 → 产品 ClaudeSessionManager
  boot_driver() → missing_executable()

flag on + 合法 plan
  spawn_owner = ProcessEntry
  line_source = ProcessEntry
  send_message / resume 走 spawn_process_entry_turn

flag on + 无 plan
  Denied → process-entry-bin-denied
```

本刀只刷新 inventory + 闸门测试。不改产品默认路径。
