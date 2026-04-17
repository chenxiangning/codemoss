## 1. Backend Web Service Runtime（P0）

- [x] 1.1 [P0][依赖:无] 设计并实现 `WebServerInfo`/运行态存储结构（输入：daemon 当前监听与鉴权信息；输出：统一状态 DTO）；验证：`cargo check --manifest-path src-tauri/Cargo.toml`。
- [x] 1.2 [P0][依赖:1.1] 实现 `start_web_server` 命令（输入：port/host 可选参数；输出：running 状态 + addresses/token）；验证：端口可用场景启动成功、返回字段齐全。
- [x] 1.3 [P0][依赖:1.2] 实现 `stop_web_server` 幂等语义（输入：停止请求；输出：稳定 stopped 状态）；验证：连续两次 stop 均无崩溃且状态一致。
- [x] 1.4 [P0][依赖:1.1] 实现 `get_web_server_status` 命令（输入：无；输出：running/null 或完整状态）；验证：未启动/已启动两种状态返回正确。
- [x] 1.5 [P0][依赖:1.1] 落实双端口状态模型（输入：RPC endpoint + webPort；输出：可区分字段）；验证：状态返回可同时识别 `remoteBackendHost` 与 `webPort`。

## 2. Auth and Transport Contract（P0）

- [x] 2.1 [P0][依赖:1.2] 在 Web API 与 WS 入口接入 `webAccessToken` 鉴权（输入：Authorization 或 query token；输出：授权通过/401 拒绝）；验证：无 token 请求被拒绝、合法 token 可访问。
- [x] 2.2 [P0][依赖:2.1] 明确 token 分离策略（输入：`remoteBackendToken` 与 `webAccessToken`；输出：独立语义与错误提示）；验证：`remoteBackendToken` 为空时 Web 入口仍拒绝未授权请求。
- [x] 2.3 [P0][依赖:1.4] 将控制命令注册到 daemon RPC 分发与前端 transport（输入：命令名与参数映射；输出：TS 可调用 API）；验证：`pnpm tsc --noEmit`。
- [x] 2.4 [P1][依赖:2.3] 增加错误码/错误消息规范化（输入：端口冲突、参数非法、重复启动等异常）；输出：前端可渲染的 recoverable 错误文本；验证：单测或手测覆盖至少 3 类错误。

## 3. Settings UI Replication（P0）

- [x] 3.1 [P0][依赖:2.3] 在 settings 增加 Web 服务管理区块（输入：状态接口返回；输出：端口输入、状态灯、Start/Stop 按钮）；验证：UI 可进入、控件可交互。
- [x] 3.2 [P0][依赖:3.1] 实现地址展示与打开动作（输入：addresses[]；输出：localhost/LAN 地址卡片）；验证：至少一条 localhost 地址可见并可触发打开。
- [x] 3.3 [P0][依赖:3.1] 实现 Token 掩码/显隐/复制交互（输入：token 字符串；输出：受控显示与复制反馈）；验证：复制后剪贴板与反馈一致。
- [x] 3.4 [P0][依赖:3.1] 实现端口合法性校验与启动失败提示（输入：用户端口输入 + start 错误）；输出：阻断与错误文案；验证：非法端口不会发起启动命令。

## 4. Compatibility and Regression Guard（P0）

- [x] 4.1 [P0][依赖:3.4] 验证 `backendMode` 兼容边界（输入：local/remote 现有配置）；输出：启停 Web 服务不隐式改写模式字段；验证：设置保存前后字段 diff 无非预期变化。
- [x] 4.2 [P0][依赖:4.1] 补充前端测试（输入：Web 服务设置交互）；输出：状态切换、错误提示、token 交互测试用例；验证：`pnpm vitest run src/features/settings/components/settings-view/sections/WebServiceSettings.test.tsx`。
- [x] 4.3 [P0][依赖:2.4] 补充后端测试（输入：start/stop/status + auth 场景）；输出：命令与鉴权回归用例；验证：`cargo test --manifest-path src-tauri/Cargo.toml web_service -- --nocapture`。
- [ ] 4.4 [P0][依赖:4.3] 执行 Win/mac 兼容验证（输入：两平台构建与最小手测）；输出：平台差异记录与修复结论；验证：Win/mac 均通过 start/stop/status + auth 核心用例。
  - 归档备注（2026-03-31）：本次仅在当前环境完成代码与自动化测试复核，Windows 实机验证待补。
- [x] 4.5 [P0][依赖:3.4] 执行“新增优先”改动面审计（输入：变更文件清单）；输出：新增文件占比与老文件改动必要性说明；验证：核心逻辑主要位于新增模块，老代码仅保留必要接线。
- [ ] 4.6 [P1][依赖:4.2,4.3,4.4,4.5] 完成手动验收清单（输入：proposal 验收标准）；输出：逐条验收记录；验证：所有 P0 验收项通过后才进入实现收尾。
  - 归档备注（2026-03-31）：自动化验证已通过，人工全量验收记录待补并可在后续增量 change 补齐。

## 5. 归档决策记录（2026-03-31）

- 已完成项依据：代码落地 + 自动化验证均可复核。
- 未完成项策略：保留 4.4/4.6 为显式技术债，归档后通过新 change 跟踪补齐，不阻塞当前 capability 入主 specs。
