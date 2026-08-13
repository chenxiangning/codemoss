# workspace-junk-dir-ignore Spec Delta

## ADDED Requirements

### Requirement: Build-artifact junk dirs MUST include temp family names

`is_special_build_artifact_dir_name` / 文件树等价名单 MUST 把 `temp`、`tmp`、`.tmp` 视为构建产物目录，与既有 `target`、`dist`、`build` 同类。workspace listing 与 file tree 对这类路径 MUST 按特殊目录处理，不得当普通源码树展开。

#### Scenario: temp family paths are special directories

- **WHEN** 系统判断相对路径 `apps/web/tmp`、`service/temp`、`pkg/.tmp`
- **THEN** `is_special_directory_path` MUST 返回 true

#### Scenario: existing target and node_modules stay special

- **WHEN** 系统判断 `target` 或 `apps/web/node_modules`
- **THEN** 它们 MUST 仍被识别为特殊目录

### Requirement: Codex thread start MUST upsert a managed junk-dir ignore block

Shared 与 Native 在本地 `thread/start` 之前 MUST 对 workspace 根目录的 `.codexignore` 做 best-effort upsert。托管段 MUST 用 `# BEGIN mossx-managed-junk-dirs` / `# END mossx-managed-junk-dirs` 包围，内容 MUST 来自与特殊目录名单同源的 ignore patterns（含 `node_modules/`、`target/`、`temp/`、`tmp/`、`.tmp/`）。用户写在托管段之外的规则 MUST 保留。upsert 失败 MUST NOT 阻断开会话。

#### Scenario: missing codexignore is created with managed block

- **WHEN** workspace 根没有 `.codexignore` 且本地 Codex thread 即将 start
- **THEN** 系统 MUST 创建该文件并写入完整托管段

#### Scenario: existing user rules outside the managed block are preserved

- **WHEN** `.codexignore` 已有用户规则且可能已有旧托管段
- **THEN** upsert 后用户段 MUST 仍在
- **AND** 托管段 MUST 被替换为当前名单，不得出现两份 BEGIN/END

#### Scenario: remote mode does not write local ignore

- **WHEN** 应用处于 remote backend mode
- **THEN** 系统 MUST NOT 向本地 workspace 写 `.codexignore`
