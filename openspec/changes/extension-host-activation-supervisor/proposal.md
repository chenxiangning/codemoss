# Proposal: extension-host-activation-supervisor

> OpenSpec change id: `extension-host-activation-supervisor`  
> Wave：1B（插排本体 · 内存 Host 状态机）  
> 架构：[`14` §3–§4、§6、§8](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)  
> 依赖：`plugin-ipc-v1-framing` 已落地。本 change **复用 codec，不重写 framing**。

## Why

插座已经会说话（MXPC/MXPD），但还没有人管 generation、activation 与 fuse。若先上 UDS / QuickJS，故障会和协议 bug 缠在一起。1B 只做 **默认可关闭的内存 supervisor**：能激活一个假插件、能超时、能 fuse、能单 owner。

## 目标与边界

1. Host 状态机：`idle → activating → ready | failed | fused | disabled`。
2. generation 单调递增；旧 generation 的帧 / 回调一律 fail closed。
3. Activation Unit required closure 按 parser 结果启动；任一层 required 失败则反向回滚。
4. 默认 `enabled=false`。本 change 不把 Host 挂进 App 启动链。
5. 并发激活上限 2；activation deadline 默认 10s / 硬上限 30s。
6. 不创建 Named Pipe / UDS、不 spawn 进程、不嵌 QuickJS、不迁 Claude/Notes。

## 非目标

- 真实 Worker / Process / UI runtime（1C+）
- Capability Broker 业务 API（可留只读 stub：workspace path 查询返回固定 fixture）
- Storage / checkpoint
- Marketplace
- AppShell 接线

## 技术方案对比

| 方案 | 做法 | 取舍 |
|---|---|---|
| A. 直接上 UDS + QuickJS | 一次做完 Wave 1 | 无法判断是 framing 还是 runtime 坏了 |
| B. 把 Host 挂进 `lib.rs::run` | 看起来像“插上了” | 违反零产品行为变化 |
| **C. 内存 supervisor + 假 Entry driver（采用）** | 单测驱动 | 可独立回滚；1C 只换 driver |

## Capabilities

### New Capabilities

- `plugin-host-generation-v1`：generation token、stale fail closed
- `plugin-host-activation-v1`：unit 激活、deadline、并发上限、反向回滚
- `plugin-host-fuse-v1`：kill switch / safe mode / fused 不自动复活

## Impact

- 新增 `src-tauri/src/plugin_runtime/host.rs` 与 TS 镜像测试辅助（可选）
- 单测用 in-memory driver 模拟 worker ready / timeout / crash
- `command_registry.rs` 与 AppShell 不变
- 启动路径不变：Host 必须被测试显式 `Host::new(Config { enabled: true })`

## 验收标准

1. 假插件 required closure 全部 ready 后状态为 `ready`，generation=1。
2. required Entry 超时 → 反向停止已启动节点，状态 `failed`，不留半开 generation。
3. fuse 后同一 pluginId 新激活被拒绝，直到显式 reset。
4. stale generation 的 `data.open` / control 调用返回 `stale-generation`。
5. `enabled=false` 时 `activate` 直接拒绝。
6. `openspec validate` 通过；产品行为不变。
