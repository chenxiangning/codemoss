## Why

Windows 上 Native Provider Continuation 的 `prepare` 阶段在写 artifact 时，
`fs::create_dir_all` 对包含 ASCII `:` 的目录段（`claude:<nativeSessionId>` /
`kimi:<nativeSessionId>`）返回 `目录名称无效。(os error 267)`（Windows
`ERROR_DIRECTORY`）；macOS/Linux 允许 `:` 作为路径段，因此 Mac 正常、Win 必炸。
这发生在「同一 CLI 切换供应商」的 source history 读取完成后、写 frozen artifact 时，
导致准备阶段整体失败，来源会话保持不变。

根因是 `artifact_store` 把 logical `sessionId`（`engine:<native>` 组合串）直接用作
filesystem path segment，而 `safe_segment` 只拦截 `/` 与 `\`，未覆盖 Windows
保留字符 `: * ? " < > |`、控制字符与保留设备名（`CON` 等同样触发 267）。

## 目标与边界

- artifact 存储路径 key 与 logical `sessionId` 解耦：路径 key 必须是跨平台安全的
  确定性短串；record JSON 内继续保存原始 `sessionId`（`claude:<uuid>`），
  lineage、catalog lookup 与来源导航语义不变。
- 写入只使用新路径 key；读取兼容既有路径（mac 上已存在的
  `shared-context-artifacts/{workspace_hash}/{sessionId}/` 旧布局），保证旧
  artifact 仍可读、孤儿扫描不误删。
- workspace / artifact 布局层级不变，`shared-context-artifacts` 目录名不变。
- `prepare` / `create` / `discard` / progress / recovery contract 不变，
  IPC payload 不变，frontend 不改。

## 非目标

- 不迁移或删除 mac 上已落盘的旧布局 artifact（不做启动期批量 rename）。
- 不修改 Native history reader、Provider binding、Context Package 内容或 checksum 语义。
- 不统一改写 session catalog / thread id / shared session 存储。
- 不新增依赖，不新增抽象类型。

## What Changes

- `src-tauri/src/shared_context/artifact_store.rs`
  - 新增 `session_path_key(session_id) -> String`：`sha256(session_id)` 前 16 个
    hex 字符（8 bytes），确定性、跨平台安全、长度恒定。
  - `artifact_dir` 改为 `root/shared-context-artifacts/{workspace_hash}/{session_path_key}`；
    `session_id` 不再作为裸 path segment，不再对其调用 `safe_segment`。
  - 读取路径（`read_artifact` / `read_typed_artifact`）优先新 key，新路径不存在时
    fallback 到 legacy `{session_id}` 路径（仅读、仅当磁盘存在）；legacy 路径构造
    不经过加固后的 `safe_segment`，以兼容 mac 旧目录名中的 `:`。
  - `safe_segment` 加固：拒绝 Windows 保留字符 `\ / < > : " | ? *`、控制字符、
    尾随点/空格与保留设备名（`CON`/`PRN`/`AUX`/`NUL`/`COM1-9`/`LPT1-9`，含带扩展名
    变体）；仍应用于 `artifact_id` 等裸 segment。
  - 增加 regression tests：带冒号 `session_id` 的 round-trip、目录名不含 `:`、
    legacy fallback 读取、`safe_segment` 加固矩阵。
- `dev-guidelines/backend/native-provider-continuation-contract.md`：补充 artifact
  存储路径 key 与 legacy 兼容读取的 executable contract。
- `openspec/changes/README.md`：登记本 change 的 active proposal 行。

## 方案取舍

### 方案 A：路径 key 使用短 sha256 前缀 + legacy 读取 fallback（采用）

`session_path_key = sha256(session_id)[0..16]`。任何非法字符都被哈希消解，长度恒定，
与 `workspace_hash` 先例一致；读取 fallback 保证 mac 旧布局无损。改动集中在
`artifact_store` 一个文件，风险面最小。

### 方案 B：只加固 `safe_segment` + `:` 替换为 `-`（不采用）

能修当前 `claude:<uuid>` 案例，但保留名（`CON` 等）与未来字段仍可能漏；
且替换映射需要维护可逆性，`? * " < > |` 的合法替换集与保留名规则易再出错。

### 方案 C：full `sha256`（64 hex）作为 key（不采用）

与 A 语义相同但路径更长；当前 artifact 文件路径在常见 Windows 用户名下已接近
`MAX_PATH`，虽 Rust std 会为超长绝对路径自动加 `\\?\` verbatim 前缀，但保持 key
短小能整体避免该类问题，并减少非 Rust 消费者（备份/同步工具）踩坑概率。

### 方案 D：启动期批量迁移旧布局（不采用）

迁移涉及 `rename` 大量目录、需要处理崩溃中断与并发，收益仅是消除 fallback 分支，
与「不引入回归」目标冲突。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `native-provider-continuation`：明确 artifact 存储路径 MUST 使用 platform-safe
  key，不得将 logical `sessionId` 直接作为路径段；读取 MUST 兼容 legacy
  `{sessionId}` 布局。

## Impact

- Backend：`src-tauri/src/shared_context/artifact_store.rs`（唯一生产代码改动点）。
- Contract：`dev-guidelines/backend/native-provider-continuation-contract.md` 与本
  change 的 delta spec。
- Dependencies：无新增；IPC payload shape 不变；frontend 零改动。

## 验收标准

- `write_typed_artifact(root, ws, "claude:<uuid>", ...)` 后，artifact 目录名不含
  `:` 且 round-trip 读取成功。
- 手工构造 legacy 布局（`{hash}/claude:<uuid>/<artifact>.json`）后，
  `read_typed_artifact` / `read_artifact` 能读取；`scan_orphan_artifacts` 仍按
  record 引用判定，不因路径布局变化误删被引用 artifact。
- `safe_segment` 对 Windows 非法字符 / 控制字符 / 保留名 / 尾随点空格返回 error。
- macOS 现有 `artifact_store` tests 全部保持通过（写入、tamper、并发、orphan 扫描）。
- `cargo test -p cc-gui shared_context` 与 `openspec validate
  fix-native-continuation-artifact-path-windows-compat --strict --no-interactive`
  通过。
