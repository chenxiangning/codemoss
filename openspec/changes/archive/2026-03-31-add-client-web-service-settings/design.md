## Context

mossx 当前已有远程后端基础能力（`backendMode` + `remoteBackendHost` + `remoteBackendToken`）与可独立运行的 `moss_x_daemon`。  
但在用户体验上仍缺少“服务管理控制面板”：用户需要自行在终端启动 daemon、确认监听地址、手工管理 token，并把信息再粘回设置页。

`codeg` 的历史实现证明「设置页内一键管理 Web 服务」可以显著降低使用门槛：端口配置、状态可视化、地址直达、Token 显隐/复制。  
本设计目标是复刻这套交互体验，同时保持 mossx 既有 daemon 架构，不引入与当前运行模型冲突的主进程耦合。

约束条件：

- 不破坏现有 `backendMode` 与 remote 连接语义。
- 不引入大规模架构重写，优先复用现有 Rust/TS 设置持久化与命令分发。
- 鉴权必须维持最小安全基线（无 token 不可访问）。

## 代码对齐快照（2026-03-31）

- 前端设置页：`SettingsView.tsx` 已接入 `activeSection === "web-service"` 的独立分区入口。
- 前端组件：`WebServiceSettings.tsx` 已实现端口校验、状态刷新、start/stop、daemon start/stop、Token 掩码显隐与复制。
- transport：`src/services/tauri.ts` 已定义 `WebServerStatus` 与 `startWebServer/stopWebServer/getWebServerStatus`。
- 命令接线：`src-tauri/src/command_registry.rs` 已注册全部 web service / daemon 管理命令。
- daemon runtime：`web_service_runtime.rs` 已实现 addresses 构建、鉴权、幂等 stop、结构化错误码。
- 远端不可达恢复：`src-tauri/src/web_service/mod.rs` 已实现连接失败时本地 daemon bootstrap + retry。

## Goals / Non-Goals

**Goals:**

- 在客户端设置中提供 Web 服务管理入口与完整交互链路（start/stop/status/address/token）。
- 以 `moss_x_daemon` 为服务内核，保证与现有 remote backend 体系一致。
- 提供确定性错误反馈（端口冲突、非法参数、重复启动/停止）。
- 提供可验证的命令契约和最小回归测试覆盖。

**Non-Goals:**

- 不实现公网部署能力（TLS 自动签发、反向代理、穿透）。
- 不实现多租户权限系统（RBAC/OAuth/JWT）。
- 不在本次变更中重构聊天协议或全量消息传输层。

## Decisions

### Decision 1: 采用 daemon-first 架构，而非主进程嵌入式 Web Server

- 备选 A：在 Tauri 主进程内直接内嵌 Web 服务（接近 codeg）。
- 备选 B：保持 daemon 为唯一服务内核，客户端提供启停控制台。
- 选择：**B（采用）**。
- 原因：
  - 与 mossx 现有 remote backend 模型一致，减少双服务栈并存复杂度。
  - 生命周期隔离更清晰，降低 UI 进程异常对服务可用性的影响。
  - 便于后续扩展为 headless/CI 场景（无需 UI 进程常驻）。

### Decision 2: 设置面板复刻 codeg 交互，但控制平面固定为 daemon RPC

- 端口输入、状态灯、Start/Stop、地址列表、Token 显隐/复制保持与参考实现一致。
- 状态读取统一走 `get_web_server_status`，避免前端自行推断状态。
- 控制命令仅通过 `Settings UI -> Tauri transport -> daemon RPC` 下发；Web API/WS 不承载管理命令。

### Decision 3: 双端口模型显式化，避免语义混淆

- daemon RPC 端口：沿用 `remoteBackendHost`（默认 `127.0.0.1:4732`）用于客户端控制链路。
- Web 访问端口：独立 `webPort`（默认 `3080`）用于浏览器访问。
- UI 与状态模型必须并列展示两类端口语义，避免把 daemon 端口误当 Web 地址。

### Decision 4: 命令契约保持最小集并保证幂等

- 命令：`start_web_server`、`stop_web_server`、`get_web_server_status`。
- `stop_web_server` 在 stopped 状态下必须无副作用。
- `start_web_server` 重复调用时，返回明确错误或已运行状态，不允许 silent failure。

### Decision 5: 兼容性策略采用“显式变更”原则

- 启停 Web 服务不隐式修改 `backendMode`、`remoteBackendHost`、`remoteBackendToken`。
- 远程模式切换仍由用户显式操作触发，避免现有用户行为回归。

### Decision 6: 鉴权采用“双 token 语义”

- `remoteBackendToken`：用于 daemon RPC 链路鉴权，保留现有兼容语义。
- `webAccessToken`：用于 Web API/WebSocket 访问鉴权，独立于 `remoteBackendToken` 且默认强校验。
- Web API 与 WebSocket 入口统一校验 `webAccessToken`。
- 拒绝未授权请求并返回标准化错误响应。
- Token UI 默认掩码，显隐/复制由用户显式触发。

### Decision 7: 平台兼容以 Win/macOS 为交付基线

- 新增 runtime/命令实现不得绑定单一平台特性（如仅 POSIX 信号或仅 macOS API）。
- 地址解析、端口占用检测、进程管理需采用跨平台抽象；必要平台差异通过 adapter 分层隔离。
- 验证清单至少包含 Windows + macOS 两端可启动、可鉴权、可停止。

### Decision 8: 采用“新增优先、微创接线”集成策略

- Web 服务能力优先落到新增模块（runtime/handler/transport adapter），减少改动面。
- 既有稳定模块（settings 主流程、remote 主链路）仅允许最小接线改动（命令注册、UI 挂载、i18n 增补）。
- 禁止为新功能改写老逻辑语义；若必须调整，需在任务中显式标记影响面与回滚点。

### Decision 9: daemon 不可达时自动恢复控制链路

- 当 `remote_backend::call_remote` 返回连接中断类错误时，执行 `maybe_start_local_daemon_for_remote`。
- 若本地 daemon 启动成功，立即重试原命令，避免用户手工切换到终端启动。
- 若恢复失败，返回原始错误 + 启动失败附加信息，保障可诊断性。

## Risks / Trade-offs

- [端口冲突导致启动失败] -> 启动前后统一返回结构化错误，并提供可恢复提示。
- [daemon 管理状态与 UI 展示短暂不一致] -> 所有操作后强制 refresh status，UI 只渲染服务端真值。
- [用户误操作泄露 Token] -> 默认掩码 + 显式 reveal 动作 + copy feedback，降低误读风险。
- [`remoteBackendToken` 与 `webAccessToken` 概念混淆] -> UI 文案分离命名，并在状态返回中拆分字段。
- [新增命令影响既有 remote 路径] -> 采用兼容边界测试，确保 `backendMode` 语义不被隐式篡改。
- [平台差异导致行为不一致] -> 使用跨平台抽象 + Win/mac 双端验证矩阵。
- [改动面过大引入回归] -> 采用新增模块承载与最小接线原则，限制对老代码的直接修改。

## Migration Plan

1. 在 daemon 增加 Web 服务状态模型与生命周期命令，显式区分 RPC 端口与 Web 端口（不触碰现有 remote 命令语义）。
2. 在 Tauri command registry / transport 层接入新命令。
3. 在 settings 新增独立 `web-service` 分区并挂载 Web 服务管理 UI。
4. 增加 i18n 文案（中英至少齐备）与基本交互测试。
5. 回归验证：
   - `backendMode` local/remote 现有流程
   - start/stop/status 命令幂等
   - token 鉴权拒绝路径

回滚策略：

- 若出现高风险回归，可通过 feature flag 或命令注册回退禁用 Web 服务入口；
- 保持已有 remote backend 输入框与连接流程可独立工作。

## Verification Snapshot（2026-03-31）

- `pnpm vitest run src/features/settings/components/settings-view/sections/WebServiceSettings.test.tsx` -> 3/3 通过。
- `cargo test --manifest-path src-tauri/Cargo.toml web_service -- --nocapture` -> 2/2 通过（web_service_runtime 单测）。
- 当前缺口：未在 Windows 环境执行端到端实机验证。

## Open Questions（归档前结论）

- Web 服务入口位置：已定稿为独立 `web-service` 分区，不放入 `Codex` 分区。
- 是否提供“一键填充 remoteBackendHost/token”：本轮不做，维持展示 + 复制路径。
- `webAccessToken` 生命周期：当前实现为“每次启动可重置（未显式传入时自动生成）”。
