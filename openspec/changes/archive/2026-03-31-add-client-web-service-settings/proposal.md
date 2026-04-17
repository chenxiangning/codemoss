## Why

mossx 目前已经支持 `backendMode=remote`，但缺少一键启停与可视化状态入口，用户需要手工启动 daemon、拼接地址和 token，操作门槛高且易出错。  
`codeg` 已验证了「设置页直接管理 Web 服务（端口/状态/地址/Token）」交互模型，这一能力可直接降低远程访问配置成本，并提升运维可观测性。

## 现状校准（2026-03-31，基于代码复核）

- `mossx` 现状：
  - AppSettings 已包含 `backendMode`、`remoteBackendHost`、`remoteBackendToken`、`webServicePort`。
  - 前端已落地 Web 服务设置区：`src/features/settings/components/settings-view/sections/WebServiceSettings.tsx`。
  - 设置入口采用独立侧栏分区：`activeSection === "web-service"`（`SettingsView.tsx`）。
  - Tauri transport 已暴露 `start_web_server` / `stop_web_server` / `get_web_server_status`（`src/services/tauri.ts`）。
  - daemon 已落地 runtime 与命令分发：`src-tauri/src/bin/moss_x_daemon/web_service_runtime.rs`、`moss_x_daemon.rs`、`daemon_state.rs`。
  - command registry 已完成接线：`src-tauri/src/command_registry.rs`。
  - i18n 已覆盖中英文文案：`src/i18n/locales/en.part1.ts`、`src/i18n/locales/zh.part1.ts`。
- 验证命令（本次复核执行）：
  - `pnpm vitest run src/features/settings/components/settings-view/sections/WebServiceSettings.test.tsx` ✅ `3 passed`
  - `cargo test --manifest-path src-tauri/Cargo.toml web_service -- --nocapture` ✅ `2 passed`

## 目标与边界

### 目标

- 在 mossx 客户端内复刻 codeg 的 Web 服务设置模块核心体验：
  - 端口配置（默认值 + 合法范围校验）
  - 运行状态显示（running/stopped）
  - 一键启动/停止
  - daemon 状态显示与一键启动/停止（确保控制面可恢复）
  - 访问地址列表展示（localhost + LAN）
  - 访问 Token 掩码显示、显隐切换、复制
- 与现有 `backendMode/remoteBackendHost/remoteBackendToken` 保持兼容，不破坏当前 remote 工作流。
- 建立最小安全基线：Web 访问 token 与 daemon RPC token 分离建模，Web 入口强制校验 Web token。

### 边界

- 本变更优先交付“客户端可管理的 Web 服务能力”，不扩展为完整多用户权限系统。
- 本变更聚焦桌面客户端设置与 daemon/Web runtime 契约，不重构现有聊天/消息域逻辑。

## 非目标

- 不实现 OAuth/JWT/多角色权限管理。
- 不实现公网穿透、TLS 证书自动签发、反向代理编排。
- 不在本轮实现多实例服务编排（仅单实例启停与状态管理）。
- 不改变现有 daemon RPC 鉴权策略的兼容语义（`remoteBackendToken` 仍保持向后兼容）。

## 实现约束（新增）

- 平台兼容性：实现与验证范围必须覆盖 `Windows` 与 `macOS`，不得引入仅单平台可运行的关键路径实现。
- 变更策略：新功能优先新增模块/新增文件承载，老代码仅做必要接线改动；避免在既有稳定链路上做大面积重写。

## What Changes

- 新增 mossx 设置中的 Web 服务管理区块（实际落位为独立 `web-service` 分区，风格对齐现有 settings 组件）。
- 新增 daemon RPC 生命周期命令契约：`start_web_server` / `stop_web_server` / `get_web_server_status`。
- 明确控制平面路径：Settings UI -> Tauri transport -> daemon RPC；Web API/WS 不承载管理命令。
- 新增双端口语义：daemon RPC 端口（默认 `4732`）与 Web 访问端口（默认 `3080`）分离。
- 新增 Web 服务状态模型：`webPort`、`webAccessToken`、`addresses[]`、`running`。
- 启动逻辑统一为受控入口（端口冲突/参数非法/重复启动可恢复报错），停止逻辑需幂等。
- 引入 Web token 鉴权约束并提供首次访问提示文案（与截图行为一致）。
- 新增 daemon 可用性恢复策略：远端不可达时尝试本地 daemon bootstrap 后重试 Web 命令。

## 技术方案对比与取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A. 在 Tauri 主进程内嵌 Web Server（接近 codeg） | 复用 axum/tower 路由，在桌面进程直接托管服务 | 与 codeg 形态最一致，链路短 | 会把桌面生命周期与服务生命周期强耦合，进程稳定性与资源隔离压力更高 | 备选 |
| B. 以 `moss_x_daemon` 为服务内核，由客户端做“启停控制台” | 客户端仅负责管理 daemon 进程与状态，服务能力下沉 daemon | 与 mossx 现有 remote 架构一致，复用现有 token/listen 能力，隔离更好 | 需补充 daemon 管理与状态回传协议，前端适配量略大 | **采用** |

取舍说明：mossx 已有 daemon 作为远程后端核心，采用方案 B 可最大化复用既有能力并降低架构熵增；UI 层仍复刻 codeg 的交互体验，做到“体验等价、实现更贴合 mossx 现状”。

## Capabilities

### New Capabilities

- `client-web-service-settings`: 客户端提供 Web 服务启停、状态、地址、Token 的统一设置与运行时管理能力。

### Modified Capabilities

- 无（本提案以新增 capability 为主，不改动现有已归档 capability 的 Requirement）。

## 验收标准

- [x] 设置页可看到 Web 服务模块，包含端口、状态、启动/停止按钮。
- [x] 默认端口为 `3080`，端口输入非法时前端拦截并提示。
- [x] 点击启动后可返回 `running=true`，并展示至少一个 `http://127.0.0.1:<port>` 地址。
- [x] daemon RPC 端口（默认 `4732`）与 Web 访问端口（默认 `3080`）在 UI 文案与状态模型中明确区分。
- [x] 服务启动后必须展示 Token（默认掩码），支持显隐与复制。
- [x] 点击停止后状态切换为 stopped，重复停止不应导致崩溃（幂等）。
- [x] 未携带有效 `webAccessToken` 的 API/WebSocket 访问返回鉴权失败（401/拒绝）。
- [x] `remoteBackendToken` 与 `webAccessToken` 独立；前者为空时不应削弱后者校验。
- [x] 现有 `backendMode=local/remote` 行为保持可用，不出现回归。

## 回归验证快照（2026-03-31）

- 前端交互回归：
  - 命令：`pnpm vitest run src/features/settings/components/settings-view/sections/WebServiceSettings.test.tsx`
  - 结果：`3 passed`
- 后端 Web runtime 回归：
  - 命令：`cargo test --manifest-path src-tauri/Cargo.toml web_service -- --nocapture`
  - 结果：`2 passed`
- 未覆盖项（需后续补充实机验证）：
  - Windows 实机端到端手测（start/stop/status/auth）
  - 完整人工验收清单签署

## Impact

- 规范影响：
  - 新增：`openspec/specs/client-web-service-settings/spec.md`
- 前端影响（已落地）：
  - `src/features/settings/components/SettingsView.tsx`
  - `src/features/settings/components/settings-view/sections/WebServiceSettings.tsx`
  - `src/features/settings/components/settings-view/sections/WebServiceSettings.test.tsx`
  - `src/services/tauri.ts`
  - `src/i18n/locales/en.part1.ts`
  - `src/i18n/locales/zh.part1.ts`
- 后端影响（已落地）：
  - `src-tauri/src/command_registry.rs`
  - `src-tauri/src/web_service/mod.rs`
  - `src-tauri/src/web_service/daemon_bootstrap.rs`
  - `src-tauri/src/bin/moss_x_daemon.rs`
  - `src-tauri/src/bin/moss_x_daemon/daemon_state.rs`
  - `src-tauri/src/bin/moss_x_daemon/web_service_runtime.rs`
- 依赖与运行时影响：
  - 已启用 HTTP server 相关运行时依赖（axum/ws/tower 体系）
  - 已有最小回归测试覆盖（前端交互 + Rust web_service 基础用例）
