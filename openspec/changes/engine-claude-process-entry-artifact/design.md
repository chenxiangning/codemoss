# Design

```text
build.rs
  RUSTC process_entry.rs
  → $OUT_DIR/plugin-engine-claude/bin/<platform>/claude
  cargo:rustc-env MOSSX_CLAUDE_PROCESS_ENTRY_ROOT

runtime
  claude_plugin_package_root() = 该制品根
  resolve_process_entry_path 仍只认 Manifest 相对路径
  缺文件 → activation-failed
  交叉编译 / rustc 失败 → 不写文件，fail closed
```

测试仍可自建临时 root。产品 flag-on 用制品根。默认路径仍 `cmd.spawn()`。
