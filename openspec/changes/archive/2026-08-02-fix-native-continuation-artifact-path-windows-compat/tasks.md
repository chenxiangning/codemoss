## 1. Path Key Implementation

- [x] 1.1 [P0][无依赖] 在 `artifact_store.rs` 实现 `session_path_key`（sha256 前 16 hex），
      `artifact_dir` 改用该 key；`session_id` 不再作为裸 path segment，也不再对其调用
      `safe_segment`。通过现有 round-trip 测试保持通过验证。
- [x] 1.2 [P0][依赖 1.1] 实现读取 legacy fallback：`read_artifact` / `read_typed_artifact`
      在新 key 路径不存在时回退 legacy `{session_id}` 路径（仅读、绕过加固校验）。
      通过新增 legacy 布局读取测试验证。
- [x] 1.3 [P0][依赖 1.1] 加固 `safe_segment`：拒绝 Windows 保留字符 `\ / < > : " | ? *`、
      控制字符、尾随点/空格与保留设备名（`CON`/`PRN`/`AUX`/`NUL`/`COM1-9`/`LPT1-9`
      含 `.ext` 变体）。通过新增加固矩阵测试验证。

## 2. Regression Tests

- [x] 2.1 [P0][依赖 1.1] 新增带冒号 `session_id`（`claude:<uuid>`）的
      `write_typed_artifact` round-trip 测试，断言 artifact 目录名不含 `:` 且读取成功。
- [x] 2.2 [P0][依赖 1.2] 新增 legacy 布局读取测试：手工构造
      `{hash}/claude:<uuid>/<artifact>.json` 后，`read_artifact` / `read_typed_artifact`
      能读取，且 `scan_orphan_artifacts` 不误删被引用 artifact。
- [x] 2.3 [P0][依赖 1.3] 新增 `safe_segment` 加固矩阵测试（非法字符 / 控制字符 /
      保留名 / 尾随点空格全部拒绝）。
- [x] 2.4 [P0][依赖 2.1-2.3] 运行 `cargo test -p cc-gui shared_context`，确认新增与既有
      tests（round-trip / tamper / 并发 / orphan）全部通过。

## 3. Contract Sync And Verification

- [x] 3.1 [P0][依赖 1.1、1.2] 更新
      `dev-guidelines/backend/native-provider-continuation-contract.md`：写明 artifact
      存储路径 MUST 使用 platform-safe key、logical `sessionId` 不得直接作为路径段、
      读取 MUST 兼容 legacy `{sessionId}` 布局。
- [x] 3.2 [P0][依赖 3.1] 执行 `openspec validate
      fix-native-continuation-artifact-path-windows-compat --strict --no-interactive`，
      并核对 delta spec 与 proposal 一致性。
- [x] 3.3 [P1][依赖 3.1] 在 `openspec/changes/README.md` active table 登记本 change
      与当前进度。
