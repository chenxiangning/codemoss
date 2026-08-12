# add-pi-engine

## Why

mossx desktop 已支持 Claude / Codex / Gemini / Grok / Kimi / OpenCode，但 **PI CLI**（`@earendil-works/pi-coding-agent`，二进制 `pi`）仅在设置导航里占位（`supported: false`）。JetBrains 端（`jetbrains-cc-gui`）已完整接入 print 模式流式、历史读写与模型发现。用户需要 desktop 一次补齐同等能力，并覆盖安装 / 卸载 / 更新、doctor、自定义路径与会话管理。

## What Changes

- 新增 `EngineType::Pi`（serde `"pi"`）全链路：检测（`pi --version` + `PI_BIN`/`~/.pi/bin`）、session（`pi --print --mode json` NDJSON）、interrupt、capability matrix、daemon 影子副本。
- 历史：`engine/pi_history.rs` 读取 `~/.pi/agent/sessions/<encoded-cwd>/<timestamp>_<sessionId>.jsonl`，提供 list / load / delete。
- CLI 生命周期：`CliInstallEngine::Pi`（npm `@earendil-works/pi-coding-agent`）支持 install / update / uninstall；`pi_doctor`。
- 前端：RealtimeAdapter / HistoryLoader / provider picker / 侧栏 / 设置 tab / 10 语言 i18n；`cliEngineNav` 标记 supported。
- Shared Session：**不**加入 `SHARED_SESSION_SUPPORTED_ENGINES`（与 Gemini 同形态，决策记录）。

## Capabilities

### New Capabilities

- `pi-engine-runtime`: 发送 / 流式 / thinking / tool / 中断 / session 续聊。
- `pi-session-history`: 列表 / 加载 / 删除本机 PI 会话。
- `pi-cli-lifecycle`: 安装 / 升级 / 卸载 / doctor / 自定义路径。

### Modified Capabilities

- `engine-capability-matrix`: fixture 与生成物增加 `pi` 行。

## Impact

- 代码：`src-tauri/src/engine/**`、`codex/{installer,doctor}`、`session_management*`、daemon、`src/features/**`、`src/i18n/**`、engine gates 脚本。
- 数据：读写 `~/.pi/**` 与 settings `piBin`；不改写用户 PI auth。
- 兼容：未安装时显示 not-installed，不影响其他引擎。

## 非目标

- 不做 Shared Session / RPC 长连接 / mid-turn steering（后续可基于 `pi --mode rpc`）。
- 不做多 provider CRUD 物化（PI 使用原生 `~/.pi` / models.json / auth）。
- 不做 pricing / context-ledger 专属成本核算。

## 风险

- NDJSON schema 随 pi 版本演进：未知 type 跳过。
- npm 全局安装与 curl install.sh 并存：检测路径需覆盖 `PI_BIN` / `~/.pi/bin` / PATH。
