# add-pi-provider-auth

## Why

PI CLI（`add-pi-engine` 已接入并归档）在 mossx 设置页只有「引擎设置」（安装/更新/自定义路径），**没有任何供应商认证入口**：用户无法看到 PI 当前配了哪些 provider、哪些 key 已生效，只能在终端里手敲 `pi /login`。当时 proposal 的非目标写明「不做多 provider CRUD 物化（PI 使用原生 ~/.pi / models.json / auth）」——本 change **只打开 auth 这一半边界**：把 `~/.pi/agent/auth.json` 的凭证状态可视化，并提供 API Key 的 set / 删除能力；models.json 与 provider CRUD 仍是非目标。

用户决策（2026-08-14）：「先把 /login 的 key set 方式给做了」——**OAuth 订阅授权流不在本期**，订阅组只做状态只读 + 终端引导。

## What Changes

- **后端**（Rust）：新增 `src-tauri/src/engine/pi_auth.rs`，读写 `~/.pi/agent/auth.json`：
  - `pi_auth_list_providers`：返回内置 provider catalog（对齐 pi v0.84.1 `env-api-keys.ts` envMap）× 认证状态（auth.json 已配置并 mask / 环境变量生效 / 未配置；OAuth 条目识别为订阅态）。
  - `pi_auth_set_api_key` / `pi_auth_delete_credential`：原子写入（tmp + rename）、保留未知条目、`0600` 权限。
  - **安全红线**：完整 key 永不回传前端，只回 mask（prefix ≤6 + last 4）。
- **前端**：PI CLI 设置 tab 在「引擎设置」之后新增「供应商认证」区块（`PiProviderAuthSection`）：
  - 订阅授权组（6 个：Claude Pro/Max、ChatGPT Plus/Pro Codex、GitHub Copilot、xAI、OpenRouter、Radius）：只读状态 + 「在终端运行 `pi /login`」引导。
  - API Key 组：搜索过滤、三种状态行、行内展开编辑器（password 输入 + 显隐 + `!command` / `$ENV_VAR` 高级用法提示）、保存/删除。
  - 品牌图标走已有 npm 依赖 `@lobehub/icons-static-svg`（与 `providerBrandIcon.ts` 同源），不使用 prototype 里的拷贝。
- i18n：10 个 locale 全量 key。
- 设计稿：[docs/prototypes/pi-provider-auth/](../../docs/prototypes/pi-provider-auth/pi-provider-auth.html)（用户已验收效果图）。

## Capabilities

### New Capabilities

- `pi-provider-auth`：PI CLI 供应商凭证的状态可视化与 API Key 管理（auth.json contract、mask 规则、env 检测、UI 行为）。

### Modified Capabilities

- 无。不改 `pi-session-history` / `pi-thread-session-continuity` / `engine-capability-matrix`。

## Impact

- 代码：`src-tauri/src/engine/pi_auth.rs`（新）、`command_registry` / `lib.rs` 注册、`src/services/tauri/` wrapper、`src/features/vendors/components/PiProviderAuthSection.tsx`（新）、`VendorSettingsPanel.tsx`（pi tab 挂载）、`src/i18n/locales/*`（10 locale）。
- 数据：读写 `~/.pi/agent/auth.json`；不碰 `~/.pi/agent/models.json`、不碰其他引擎配置。
- 兼容：auth.json 不存在时按「全部未配置」渲染；PI 未安装不阻塞展示。

## 非目标

- 不做 OAuth / PKCE 授权流（订阅组只读 + 终端引导，后续可单开 change）。
- 不做 models.json / 自定义 provider CRUD（维持 add-pi-engine 边界）。
- 不做 key 的在线验证（调 provider API 试 key）。
- 不把 PI auth 接入 mossx provider profile / Shared Session 体系。

## 风险

- **auth.json schema 漂移**：pi 版本演进可能新增 credential type；未知条目 MUST 原样保留、只读跳过。
- **env 检测语义**：`std::env::var` 反映 mossx 进程环境（即 mossx spawn pi 时 pi 实际看到的环境），与用户 login shell 可能不同；UI 文案须如实表述为「环境变量生效中」，不承诺覆盖用户 shell。
- **并发写**：用户终端同时 `pi /login` 可能造成写冲突；原子写 + 写前重读降低窗口，不引入文件锁（pi 本身也不加锁）。
- **ADR 校准回写 Gate 判断**：本 change 不动 engine registry（pi 已注册）、不动 Shared 支持集合、不动 provider binding（mossx provider profile 体系）、不动 canonical fact / context compiler / terminal ACK / recovery——**不命中基石文档更新触发器**，收口时无需回写（判断记录于此，archive 前复核）。
