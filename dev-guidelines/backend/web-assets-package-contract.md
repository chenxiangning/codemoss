# Web Assets Package Contract

## Scenario: Downloadable Web Service frontend assets

### 1. Scope / Trigger

- Trigger：修改 Web Service frontend assets 的 Release artifact、下载/校验/解压、Tauri command、设置页状态或 daemon asset candidate。
- 目标：一份 platform-neutral ZIP 经 desktop 安全安装到 App Data，并被新启动或已运行的本地 daemon 在下一次 Web Service start 时解析。

### 2. Signatures

- Rust status：`WebAssetsStatus { state, installed_version, required_version, last_error, installation_required }`
- Tauri commands：
  - `get_web_assets_status() -> Result<WebAssetsStatus, String>`
  - `install_web_assets() -> Result<WebAssetsStatus, String>`
  - `install_web_assets_from_file(archive_path: String) -> Result<WebAssetsStatus, String>`
- TypeScript bridge：
  - `getWebAssetsStatus(): Promise<WebAssetsStatus>`
  - `installWebAssets(): Promise<WebAssetsStatus>`
  - `installWebAssetsFromFile(archivePath: string): Promise<WebAssetsStatus>`
- Env override：`MOSSX_WEB_ASSETS_BASE_URL` 仅替换 Release asset base URL；`MOSSX_WEB_ASSETS_DIR` 仍是 daemon asset root 的最高优先级 override。
- Release artifact：`ccgui-web-assets_<version>.zip` 与 `ccgui-web-assets_<version>.zip.sha256`。

### 3. Contracts

- ZIP root MUST 包含 `manifest.json`、`index.html` 与 `assets/`；manifest fields MUST 为 `schemaVersion=1`、`assetsVersion=<App version>`、`entrypoint=index.html`。
- Managed directory 固定为 `<app-data>/web-assets/current`；`.ccgui-web-assets-version` MUST 最后写入并与 App version 相等。
- Install MUST single-flight，MUST 下载到临时文件、解压到唯一 staging directory、验证后再替换 `current`。
- 用户主动触发 remote reinstall 时 MUST bypass ready shortcut，真实请求当前 App version 对应的 Release checksum 与 ZIP。
- Local import MUST 由用户显式选择 `.zip`，MUST 读取相邻 `<archive>.sha256`，并先复制到 managed temp 后复用同一校验与 activation contract。
- ZIP extraction MUST 使用 `enclosed_name()`，拒绝 traversal、symlink、duplicate entry，并限制 archive bytes、entry count 与 unpacked bytes。
- Packaged local daemon 缺少 ready assets 时 `start_web_server` MUST 返回 `WEB_ASSETS_NOT_READY`；remote daemon 和 development build MUST NOT 被 desktop-local assets gate 阻断。
- `WebServiceRuntime` candidate priority MUST 为 explicit env → `<data-dir>/web-assets/current` → existing development/bundle candidates。

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| managed directory 不存在 | `state=missing`，提供安装动作 | 自动后台下载 |
| marker/manifest/version/index 无效 | `state=failed` + `lastError` | 把损坏目录报告为 ready |
| checksum 不匹配 | 删除本次 download/staging，保留 current | 继续解压或覆盖 current |
| ready 状态重新下载安装失败 | 返回本次真实错误并继续报告 current 为 ready | 跳过 Release 请求、显示假成功或禁用仍可用资源 |
| ZIP traversal/symlink/duplicate/bomb | 拒绝 archive | 信任 raw ZIP path 或无限解压 |
| activation rename 失败 | 尝试恢复 backup，并返回路径上下文 | 吞掉错误并返回成功 |
| daemon 已运行后安装 | 下一次 Web Service start 从 data-dir 解析 | 要求重启 desktop/daemon |
| remote/development runtime | 保留既有 start/fallback | 被本地 managed status 错误 gate |
| local picker 取消 | 保持当前状态，不 invoke install command | 报错或清空 ready 状态 |
| local ZIP/checksum 无效 | `state=failed`，保留 current | 绕过 SHA-256 或激活无效 staging |

### 5. Good / Base / Bad Cases

- Good：`install_web_assets` 返回统一 camelCase status，React 只维护 transient `checking/installing`。
- Good：Release job build once，三个 platform installers 依赖同一 ZIP/checksum。
- Base：offline/404 返回 failed，用户可重试，旧 current 不变。
- Bad：直接解压到 `current`、每个平台各生成一份同名 ZIP、只在新 daemon spawn 时注入 env。

### 6. Tests Required

- Rust `assets_package` tests MUST 覆盖 version mismatch、checksum mismatch、unsafe ZIP、missing entrypoint、activation replacement 与旧 current 保留。
- daemon tests MUST 断言 data-dir candidate 存在且 explicit env 保持在它之前。
- `src/services/tauri.test.ts` MUST 断言三个 command 名与 local `archivePath` payload 无 drift。
- `WebServiceSettings.test.tsx` MUST 覆盖 missing gate、成功安装、failed recovery、single-flight、remote 与 development bypass。
- Release smoke MUST 执行 frontend build、ZIP integrity test，并读取 manifest 与 SHA-256。

### 7. Wrong vs Correct

#### Wrong

```rust
zip_archive.extract(app_data.join("web-assets/current"))?;
```

#### Correct

```rust
extract_archive(&archive_path, &staging_dir)?;
validate_installation_contents(&staging_dir, &required_version)?;
activate_staging(&assets_root, &staging_dir)?;
```
