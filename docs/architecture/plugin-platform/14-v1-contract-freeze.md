---
type: architecture
status: active
---

# 14 · V1 Contract Freeze

> 主线入口：[Mossx Plugin Platform](README.md)
> 决策日志：[Decision Log](09-decision-log.md)
> 取证与对比：[Open Decisions](12-open-decisions-and-deepseek-comparison.md)
> 状态：2026-08-16 完成 Contract / Pilot / Marketplace Freeze。本文是实施解析器、Host、SDK 与 OpenSpec change 的单一字段事实源。

## 0. 冻结口径

1. 本文冻结的是 **V1 可实施 Contract**，不是已经落地的 runtime。
2. 未在本文出现的字段、event、capability、codec、channel 一律 **fail closed**。
3. 实现必须按本文生成 JSON Schema 与 conformance fixtures；手写类型只能做 adapter。
4. 数值是 Core Policy 默认值与硬上限。Manifest 可在区间内收窄，不能突破上限，不能声明 infinite。
5. DeepSeek/Cordis 只提供 transferable pattern；Mossx 的 trust、process isolation、storage 与 Marketplace 约束优先。

## 1. Identity、Publisher 与 Artifact 坐标（DP-010）

```yaml
pluginId: com.mossx.notes
version: 1.0.0
displayName: Notes
description: Workspace-local notes
publisher:
  id: com.mossx
  displayName: Mossx
  homepage: https://mossx.dev
repository:
  type: git
  url: https://github.com/mossx/mossx-plugin-notes
  commit: "0000000000000000000000000000000000000000"
license: MIT
```

规则：

| 字段 | 规则 |
|---|---|
| `pluginId` | Reverse-DNS；发布后不可变；官方 `com.mossx.*` |
| `publisher.id` | Reverse-DNS；与 `pluginId` 前缀不必相同，但官方插件必须是 `com.mossx` |
| `repository.commit` | 完整 40-char SHA；Marketplace artifact 必填 |
| `displayName` / `homepage` | 展示信息，不参与 identity |
| local / Git 开发制品 | `publisher.id` 仍必填；Registry 标记 `unverified`；trust tier 仍为 `local` |

Ownership / recovery：

- Registry 将 `publisher.id` 绑定到已验证域名或 `io.github.<owner>`。
- `pluginId` 永不因 rename、仓库迁移、公司更名而改变。
- publisher transfer：旧签名 key 与新签名 key 对同一 `TransferStatement` 双签，Registry 公示不少于 7 天后再切换。
- 丢失签名 key：冻结该 publisher 的新发布；已安装 LKG 继续运行；恢复走人工 Registry ticket，禁止自动接管。
- GitHub owner rename 只更新 provenance display，不改 `pluginId` / `publisher.id`。

## 2. 三轴版本、Channel 与 Range（DP-013）

```yaml
manifestVersion: 1
version: 1.4.2
channel: stable
compatibility:
  coreApi: ">=1.0.0 <2.0.0"
```

| 轴 | 规则 |
|---|---|
| `manifestVersion` | 正整数。V1 Core 接受 `1`。未知值安装前拒绝 |
| `version` | SemVer 2.0。同一 `pluginId + version` 只能对应一个 artifact hash |
| `compatibility.coreApi` | npm 比较符：`>` `>=` `<` `<=` `=` `\|\|` 空格 AND。禁止 `*`、禁止无上界 |
| `channel` | 仅 `stable` \| `beta`。缺省 `stable` |
| pre-release | 仅 `-beta.<n>` 可进入 `beta` channel；`stable` 拒绝 pre-release |

解析顺序：`manifestVersion` → `coreApi` 与当前 Core Contract → channel policy → SemVer 最大满足版本。

自动更新：

| Trust | 权限未扩大且兼容 | 权限扩大 / destructive migration |
|---|---|---|
| `system` | 自动 stage + health gate 后激活 | 暂停并展示 diff / 确认 |
| `verified` | 自动 stage，用户确认后激活 | 暂停并展示 diff / 确认 |
| `local` | 永不自动 | 永不自动 |

LKG：每个 `pluginId` 至少保留上一成功 generation 的 artifact + checkpoint，直到新版本稳定或用户卸载。V1 不做百分比灰度；Registry pin 足以做定向发布。

## 3. Named Activation Unit（DP-001）

最小启停单元是 Manifest 中的 **Activation Unit**，不是整个 Plugin，也不是裸 Entry。

```yaml
activationUnits:
  - id: notes-main
    entries: [notes-worker]
    events:
      - type: onView
        viewId: notes.main
      - type: onCommand
        commandId: notes.create
```

规则：

- `id` 在 artifact 内唯一，作为 single-flight、generation、日志主键。
- `entries` 至少一项；Host 计算这些 Entry 的 Physical DAG **required closure** 一并启动。
- optional physical edge 不进入默认 closure；只有被另一个已启动 unit 直接点名才启动。
- 同一 `entryId` 可被多个 unit 引用。Host 维护 generation-scoped **refcount**。
- unit 停止时减计数；计数到 0 后等待 `sharedEntryIdleMs`（默认 5000，上限 30000）再按 DAG 反向停止。
- 仍被其他 live unit 的 required edge 引用的 Entry 不得停止。
- 并发命中同一 unit：single-flight，共享同一 generation。
- 调用方取消只取消自己的等待；coordinator 在无等待者且尚未 publish 时可中止。
- 禁止“激活整个 plugin”的隐式 unit。需要常驻时显式声明 `onStartup` 并满足白名单。

DeepSeek 对照：`cordis:group` + `isolate` 是命名启停组；`fiber.dispose()` 回收整棵子树。Mossx 把它提升为安装前可审计的 Activation Unit，并加上跨 unit 的物理 refcount。

## 4. Activation Event Catalog（DP-002）

V1 只接受下列 Closed event：

| `type` | 必填字段 | 谁触发 | 默认行为 |
|---|---|---|---|
| `onView` | `viewId` | 用户打开已声明 View / placeholder | lazy |
| `onCommand` | `commandId` | 用户执行已声明 Command | lazy |
| `onEngine` | `engineId` | 选择或恢复该 Engine session | lazy |
| `onWorkspace` | `reason`: `open` \| `grant` | Workspace 打开或授权变化 | lazy；只启动声明了该 event 的 unit |
| `onSettings` | `pageId` | 打开插件设置页 | lazy |
| `onStartup` | 无 | Core 启动后、first-interactive 之后 | 仅 system 或 policy whitelist |

禁止 V1：`onFile`、`onLanguage`、`onUri`、`onWebview`、自定义 event、用插件代码计算激活条件。

Prewarm：

- 插件不得声明无条件预热。
- Core Policy 可在 first-interactive 之后预热 **一个** 默认 Engine unit。
- Marketplace / Registry / 普通插件不得进入 first-interactive。

`onStartup` 白名单：仅 `trustTier=system` 且 Core Policy 列出的 `pluginId`。其他 artifact 含 `onStartup` 则安装前拒绝。

## 5. Entry Kind Closed Schema（DP-003）

公共字段（所有 kind）：

| 字段 | 约束 |
|---|---|
| `id` | `^[a-z][a-z0-9-]{0,63}$`，artifact 内唯一 |
| `kind` | `worker` \| `process` \| `ui` \| `migration` |
| `criticality` | `required` \| `optional`，默认 `required` |
| `dependsOn` | `{ entryId, criticality }[]`，可空 |
| `budgets` | 可选；不得突破 §8 上限 |

### 5.1 `worker`

| 字段 | 约束 |
|---|---|
| `path` | artifact-relative，必须以 `.js` 结尾 |
| `runtime` | 仅 `quickjs` |
| `export` | 可选，默认 `activate` |

禁止：Node builtin、dynamic `import()` 任意 URL、native addon。

### 5.2 `process`

| 字段 | 约束 |
|---|---|
| `platforms` | map：`PlatformId -> artifact-relative executable path` |
| `argv` | 可选 string[]，不含用户输入拼接 |
| `cwd` | 仅 `plugin-data` \| `workspace-root`，默认 `plugin-data` |
| `stdio` | 固定 framed control on stdin/stdout；stderr 为日志 |

`PlatformId` V1：`darwin-arm64`、`darwin-x64`、`windows-x64`、`windows-arm64`、`linux-x64`、`linux-arm64`。

Windows 路径必须以 `.exe` 结尾。禁止 `.dll` / `.dylib` / `.so` 作为 process path。

### 5.3 `ui`

| 字段 | 约束 |
|---|---|
| `mode` | `declarative` \| `sandbox` \| `trusted-react` |
| `path` | declarative 为 `.json`；sandbox 为 html 入口；trusted-react 为 versioned ESM bundle |
| `slot` | 必须是 §7 slot catalog 之一 |
| `trustedReact` | 仅 `trusted-react` 需要；`true` 且 trust 必须是 `system` |

V1 `trusted-react` 仅 `system`。`verified` / `local` 声明该 mode 则安装前拒绝。

### 5.4 `migration`

| 字段 | 约束 |
|---|---|
| `path` | artifact-relative script，由 Core Migration Runner 加载，不进入常规 DAG |
| `fromSchema` | 正整数 |
| `toSchema` | 正整数且 `> fromSchema` |
| `destructive` | boolean，默认 `false` |
| `exportRequired` | boolean，默认 `false` |

同一 `(fromSchema, toSchema)` 只能有一个 migration entry。

## 6. Physical Entry DAG（DP-004）

- 边只来自 Manifest `dependsOn`。运行时不得增删边或改 placement。
- cycle、自依赖、未知 `entryId`：安装前拒绝。
- required 边指向的 Entry 在当前平台缺失：incompatible，不启动任何代码。
- optional 边缺失：跳过该分支，不失败。
- Host 按拓扑启动、反向停止。
- 任一层 required 启动失败：反向停止已启动节点，清理 staging graph，unit 失败。
- Migration Entry 禁止出现在 `dependsOn` 或 `activationUnits.entries`。
- UI Entry 可以 dependOn Worker/Process；Worker 可以 dependOn Process；Process 不得 dependOn UI。
- 共享 Entry 只通过 refcount 存活，不复制进程。

## 7. Platform Artifact Selection（DP-005）

选择算法：

1. 读取当前 `os` + `arch`，映射到唯一 `PlatformId`。
2. 每个 required `process` Entry 必须含该 key。
3. **禁止 fallback**（例如 darwin-x64 不得用 darwin-arm64）。
4. 文件必须存在于 integrity set，hash 匹配。
5. 不匹配则判定 `incompatible`，Marketplace 显示“当前平台不可用”，不得下载后降级。

Worker / declarative UI 视为跨平台；trusted-react / sandbox 资源同样走 integrity，不按平台分叉，除非插件另打独立 artifact version。

## 8. Runtime Budget & Health（DP-008）

| 预算 | 默认 | 最小 | 硬上限 |
|---|---:|---:|---:|
| Activation deadline | 10_000 ms | 1_000 | 30_000 |
| Worker memory | 128 MiB | 32 | 256 |
| Process memory | 512 MiB | 64 | 2048 |
| Control request deadline | 10_000 ms | 200 | 30_000 |
| Shared entry idle | 5_000 ms | 0 | 30_000 |
| Deactivate grace | 500 ms | 100 | 2_000 |
| Concurrent activation | 2 | 1 | 4 |
| Heartbeat interval | 2_000 ms | 1_000 | 5_000 |
| Worker missed heartbeats | 3 | 2 | 5 |
| Process missed heartbeats | 5 | 3 | 8 |
| Control frame | 1 MiB | — | 1 MiB |
| Data frame payload | 1 MiB | — | 1 MiB |
| Open streams / generation | 8 | 1 | 16 |
| Stream window | 32 frames or 8 MiB | — | 32 / 8 MiB |
| UI render budget | 16 ms / frame | — | 连续 3 帧超限则 fallback |
| Template instances / generation | 声明值 | 1 | 256 |
| First-interactive ordinary plugins | 0 | 0 | 0 |

熔断顺序：限流 → 重启 isolation unit（最多 3 次 / 5 min）→ quarantine。不依赖插件 `deactivate()`。

Health gate（atomic publish 前全部满足）：

1. required Physical closure 全部 running；
2. required runtime capabilities ready；
3. 至少一次成功 heartbeat；
4. envelope validation 通过；
5. 无 quota breach。

DeepSeek 对照：`PROCESS_SHUTDOWN_TIMEOUT_MS = 5000`、`assertEntriesActivated` 把 pending 当启动失败。Mossx 把“无限 waiting”改成 Core-bounded deadline。

## 9. Capability Catalog V1（DP-006）

每个 Capability 绑定：`id + contractVersion + schemaHash + allowedRoles + trustMinimum`。

`schemaHash` 由 `packages/plugin-contract/schemas/capabilities/<id>.v1.json` 在发布 Core Contract 时生成。文档冻结 ID 与语义；hash 随 schema 文件进入 lock。

### 9.1 Brokered resource

| ID | Roles | 默认 scope | trustMinimum |
|---|---|---|---|
| `mossx.workspace.read` | consumer | current workspace + path glob | local |
| `mossx.workspace.write` | consumer | current workspace + path glob | local |
| `mossx.git.read` | consumer | current workspace repo | local |
| `mossx.git.write` | consumer | current workspace repo，不含 force-push / 改 config | verified |
| `mossx.network.fetch` | consumer | https host allowlist + method | local |
| `mossx.process.spawn` | consumer | executable allowlist；强制 Restricted Process | local |
| `mossx.storage.readwrite` | consumer | 本 plugin namespace | local |
| `mossx.notifications.publish` | consumer | user-visible non-secret | verified |

### 9.2 Contribution / provider

| ID | Roles | 说明 |
|---|---|---|
| `mossx.engine.provider` | provider | exact Engine Contribution |
| `mossx.search.provider` | provider | 可 template |
| `mossx.context.provider` | provider | 可 template |
| `mossx.command` | provider | exact |
| `mossx.tool` | provider | 可 template |
| `mossx.ui.view` | provider | exact |
| `mossx.ui.panel` | provider | exact |
| `mossx.ui.slot.workspace.main` | consumer | slot 授权 |
| `mossx.ui.slot.workspace.rightPanel` | consumer | |
| `mossx.ui.slot.sidebar.secondary` | consumer | |
| `mossx.ui.slot.composer.toolbar` | consumer | |
| `mossx.ui.slot.conversation.attachmentRenderer` | consumer | |
| `mossx.ui.slot.settings.plugin` | consumer | |
| `mossx.ui.slot.status.lowFrequency` | consumer | |
| `mossx.settings.page` | provider | exact |
| `mossx.status.item` | provider | 可 template |

V1 跨插件只能 provide/require 上表。`<pluginId>.*` 仅同插件 generation 私有。插件不得创造 `mossx.*`。

## 10. Contribution Envelope（DP-007）

### 10.1 Exact declaration

```yaml
contributions:
  - id: notes.main
    type: mossx.ui.view
    entryId: notes-ui
    slot: workspace.main
    mode: trusted-react
```

必须 exact：`mossx.ui.view`、`mossx.ui.panel`、`mossx.command`、`mossx.engine.provider`、`mossx.settings.page`。

### 10.2 Bounded template

仅下列 type 可 `dynamicEligible`：`mossx.tool`、`mossx.search.provider`、`mossx.context.provider`、`mossx.status.item`。

```yaml
contributionTemplates:
  - id: discovered-tools
    type: mossx.tool
    entryId: main-worker
    keyPrefix: com.example.notes.tool.
    scopes: [workspace]
    maxInstances: 32
```

| 字段 | 规则 |
|---|---|
| `keyPrefix` | 必须以 `pluginId + "."` 开头 |
| `scopes` | `workspace` \| `session` \| `global` 的非空子集 |
| `maxInstances` | 必填，1–256，按 generation + template + scope 计数 |
| 匹配 | runtime key 必须 `startsWith(keyPrefix)` 且唯一命中一个 template 或 exact id |
| 零匹配 / 多匹配 | 拒绝该次 registration |
| 禁止 | 用 template 产生 Trusted React、新 slot、新 capability、新 process、新 EngineId |

disable / fuse / generation swap 时计数清零。

## 11. Manifest Schema Evolution（DP-009）

| 情况 | V1 行为 |
|---|---|
| 未知 top-level 字段 | 拒绝 |
| 已知对象内的未知字段 | 拒绝 |
| 未知 `kind` / event / capability / contribution type | 拒绝 |
| `extensions.<publisherDns>.*` | 允许；Core 忽略；不得改变权限、placement、activation |
| deprecated 字段 | V1 无；未来 N-1 窗口内接受并诊断 |
| Core 支持的 Manifest Schema | 仅当前 `1`。引入 `2` 时 Core 必须同时解析 `1` 与 `2` |
| JSON 中的 `null` | 视为缺省，再走 required 校验 |

禁止 JSON Schema `additionalProperties: true` 出现在安全相关对象上。

## 12. Storage / Migration Metadata（DP-012）

```yaml
storage:
  schemaVersion: 1
  format: sqlite-v1
  migrations:
    - from: 1
      to: 2
      entryId: schema-v2
      destructive: false
      exportRequired: false
  checkpoint:
    required: true
    retainPrevious: 2
```

| 规则 | 值 |
|---|---|
| namespace | `app-data/plugin-runtime/data/<pluginId>/` |
| format V1 | 仅 `sqlite-v1` + sidecar `blobs/` |
| 更新前 | 必须成功创建并校验 checkpoint |
| compatible migration | 有 checkpoint 即可，无需额外确认 |
| destructive | 展示 from/to、影响面、回退限制；用户确认后才跑 |
| `exportRequired: true` | 确认前必须完成用户可见 export |
| 默认 | 已校验 checkpoint 即可，不强制 export |
| 失败 | 恢复 checkpoint；失败则 quarantine，禁止旧代码打开未知 schema |
| retainPrevious | 默认 2，范围 1–5 |

四个版本轴继续独立记录：`pluginVersion`、`contractVersion`、`storageSchemaVersion`、`checkpointFormatVersion`。

## 13. IPC Binary Contract（DP-016）

### 13.1 Control frame

```text
offset  size  field
0       4     magic = 0x4D585043  ("MXPC", big-endian ASCII)
4       1     version = 1
5       1     flags = 0
6       4     payload_len  u32le
10      N     UTF-8 JSON-RPC 2.0 object
```

- `payload_len` 上限 `1048576`。
- 禁止 newline-delimited JSON。
- 非法 magic / version / 截断 / 非 JSON / schema mismatch：断开该 generation 并 fuse。

### 13.2 Data frame

```text
offset  size  field
0       4     magic = 0x4D585044  ("MXPD")
4       1     version = 1
5       1     flags
6       4     stream_id  u32le
10      4     seq        u32le
14      4     payload_len u32le
18      N     payload
```

flags：

| bit | 含义 |
|---|---|
| 0 | `END` half-close |
| 1 | `CANCEL` |
| 2 | `ACK`（payload 为 `acked_seq` u32le） |
| 3–7 | 保留，必须 0 |

V1 codec 仅：

| codec | 内容 |
|---|---|
| `engine-event-v1` | 每帧一个 UTF-8 JSON canonical engine event |
| `blob-v1` | 原始字节；完整 blob 以 `END` 结束 |
| `log-v1` | UTF-8 JSON log record |

禁止 V1：compression、shared memory、自定义 codec。flags/reserved 为未来预留。

### 13.3 Handshake

Core/Host 先发：

```json
{
  "jsonrpc": "2.0",
  "id": "hs-1",
  "method": "mossx.handshake.hello",
  "params": {
    "protocolVersion": 1,
    "coreContract": "1.0.0",
    "nonce": "<32-byte hex>",
    "generation": 1
  }
}
```

对端必须在 2s 内回复 `protocolVersion=1`、回显 nonce、声明 `pluginId/version/generation`。major 不匹配则拒绝激活。

Process 启动：Core 通过 CLOEXEC 之外的一次性 env `MOSSX_HANDSHAKE_NONCE` 交付 nonce；插件不得把 nonce 写入日志或磁盘。

### 13.4 Stream / 背压 / 取消

- 只有 `data.open` 成功后才允许 MXPD。
- 未 ACK 窗口：32 帧或 8 MiB，先到先限。
- 超窗口继续发送：Data Plane 暂停读并记 quota；连续违规 fuse。
- `CANCEL` 后该 stream 的后续非 ACK 帧丢弃。
- generation 切换 / disable / fuse：撤销全部 handle，不 resume。
- 进程重启 = 新 generation；V1 **不**做跨进程 reconnect/resume。

### 13.5 Transport

保持 [10 · IPC](10-ipc-transport-and-wire-protocol.md) 已确认矩阵。Named Pipe / UDS 由 Core 创建，ACL 仅当前用户 + Host pid。禁止 local TCP。

## 14. Process SDK Languages（DP-017）

| 语言 | V1 地位 |
|---|---|
| TypeScript | 官方 Worker SDK（QuickJS）+ Node Process SDK |
| Rust | 官方 Host/Core 与 Process SDK |
| Go | 只发布 generated JSON Schema types；无官方 runtime helper |
| Python / 其他 | 走 framed stdio + JSON Schema conformance；无官方 SDK |

语言不是 ABI。任何语言只要通过 `tests/plugin-conformance` 即可作为 Process Entry。

## 15. Marketplace Sources 与依赖（DP-014 / DP-015）

V1 允许的来源：

| 来源 | Trust | 自动更新 | 备注 |
|---|---|---|---|
| Mossx curated Registry | system / verified | 按 §2 | 唯一远程发现入口 |
| local path | local | 否 | Restricted Process |
| Git URL / GitHub spec | local | 否 | 先构建为 `.mossx-plugin` 再安装；禁止安装期执行任意 prepare 作为权限面 |
| 私有 Registry | — | — | Schema 预留 `source.kind=private-registry`，V1 拒绝解析 |

禁止：任意 npm registry 直接作为插件安装源、未签名 tarball 覆盖 verified、把 pnpm/Git 源码目录当正式 artifact。

Plugin-to-plugin：

- V1 **禁止** artifact 级 plugin dependency 与跨插件 `<pluginId>.*` require。
- 普通 library 必须打进自己的 artifact。
- 跨插件协作只通过 `mossx.*` Platform Capability。
- V2 才开放 signed Capability Contract Artifact。

## 16. Supply Chain（DP-011）

每个 `.mossx-plugin` 必须含：

```text
manifest.json
integrity.json      # sha256 per file + merkleRoot
signature.json      # Ed25519 over pluginId|version|artifactHash|manifestHash
sbom.cdx.json       # Marketplace 必填；local 可选
provenance.json     # source repo/commit/builderId；Marketplace 必填
```

| 事件 | 行为 |
|---|---|
| hash / signature mismatch | 拒绝；删除 candidate |
| Registry revocation | 禁用该 version；提示安全版本；已运行 generation 进入 bounded drain 后停用 |
| key rotation | 旧 key 签署的 `KeyDelegation` + 新 key；Core 同时信任 overlap window（最多 30 天） |
| 离线 | 已验证 LKG 可启动；不能安装新的远程 artifact；若上次成功 revocation check 超过 7 天且现已联网，更新前必须刷新 |
| 用户绕过 revocation | V1 **不允许** |

## 17. Product Migration Boundary（DP-018）

| 选择 | V1 |
|---|---|
| 第一个 Engine Pilot | `com.mossx.engine.claude`。它是 0.8.9 唯一残留 compatibility adapter；Contract + Host 就绪后迁出，不把已删 CLI 拷回 Core |
| 第一个 Feature Pilot | `com.mossx.notes`。Storage / UI / migration 边界最清晰 |
| 其后 Feature | 项目知识地图 → 内置浏览器 → 意图画布 |
| 其他 CLI | Claude 稳定后再以独立仓库接入，不再进 Core |
| Git / Search foundation | V1 留 Core；暂不改成 system plugin |
| Trusted React | **仅 system**。verified / local 用 Declarative 或 Sandbox |

单 owner：禁止 Core 与 Plugin 长期双写同一数据域。

## 18. 完整 Manifest 最小样例

```yaml
manifestVersion: 1
pluginId: com.mossx.notes
version: 1.0.0
displayName: Notes
description: Workspace-local notes
publisher:
  id: com.mossx
  displayName: Mossx
  homepage: https://mossx.dev
repository:
  type: git
  url: https://github.com/mossx/mossx-plugin-notes
  commit: "0000000000000000000000000000000000000000"
license: MIT
channel: stable
compatibility:
  coreApi: ">=1.0.0 <2.0.0"
  platforms:
    - darwin-arm64
    - darwin-x64
    - windows-x64
    - windows-arm64
    - linux-x64
    - linux-arm64

entries:
  - id: notes-worker
    kind: worker
    path: dist/worker.js
    runtime: quickjs
    criticality: required
  - id: notes-ui
    kind: ui
    mode: trusted-react
    path: dist/ui/notes.js
    slot: workspace.main
    trustedReact: true
    dependsOn:
      - entryId: notes-worker
        criticality: required
  - id: schema-v2
    kind: migration
    path: migrations/v2.js
    fromSchema: 1
    toSchema: 2
    destructive: false

activationUnits:
  - id: notes-main
    entries: [notes-worker, notes-ui]
    events:
      - type: onView
        viewId: notes.main
      - type: onCommand
        commandId: notes.create

contributions:
  - id: notes.main
    type: mossx.ui.view
    entryId: notes-ui
    slot: workspace.main
    mode: trusted-react
  - id: notes.create
    type: mossx.command
    entryId: notes-worker
    commandId: notes.create

capabilities:
  - id: mossx.storage.readwrite
    role: consumer
    scopes: [namespace:self]
  - id: mossx.ui.slot.workspace.main
    role: consumer

storage:
  schemaVersion: 1
  format: sqlite-v1
  migrations:
    - from: 1
      to: 2
      entryId: schema-v2
      destructive: false
      exportRequired: false
  checkpoint:
    required: true
    retainPrevious: 2

budgets:
  activationDeadlineMs: 10000
```

## 18.1 从 DeepSeek 闭包吸收、但不得照抄的实施不变量

这些不改变 D-031～D-048，只防止实现时把 DeepSeek 的便利路径写进 Mossx：

1. **installation-first for system pins**：`com.mossx.*` system artifact 必须从 Core 发行版 / lockfile pin 解析，禁止被用户可写 cache 里的同名 `pluginId` 覆盖。对照 DeepSeek `resolveBundleDir` 的 install-anchor-first。
2. **hash 分工**：`integrity.json` 的 sha256 是供应链完整性；UI bundle 的 cache-bust/HMR rev 不得充当签名或 lockfile hash。对照 `dsh-client-modules` `shortHash`（sha1 前 12 hex，只用于 URL rev）。
3. **Settings 不是自助入口**：插件不能因为装上了就出现在 Core Settings chrome；必须 exact declare `mossx.settings.page` 且通过 envelope。对照 DeepSeek host allowlist。
4. **P8 slimming 用 disable-not-delete**：Core compatibility adapter 先停用再删源码，避免 composition 重排时静默复活。对照 DeepSeek Web overlay 对 agent-plane 行的 `disabled`。
5. **两图正交**：npm/library 依赖图（V1 打进自己的 artifact）≠ Runtime Capability Graph。一边成功不蕴含另一边成功。对照 DeepSeek package graph vs `inject`。
6. **相对路径开发源**：local path 必须锚到用户 invoking directory，禁止相对 profile/data 目录自链。对照 `anchorPathSpec`。

## 19. 实施入口

按此顺序建立小型 OpenSpec change，不要把本文当成一个总包实现：

1. `plugin-manifest-v1-parser`（§1–§7、§9–§11、§18）
2. `plugin-ipc-v1-framing`（§13）
3. `extension-host-activation-supervisor`（§3、§4、§6、§8）
4. `plugin-storage-checkpoint-v1`（§12）
5. `engine-claude-pilot` 与 `notes-feature-pilot`（§17）

P0 fitness checks 必须以本文 fixtures 为准：未知字段、未知 event、平台缺失、越界 template、跨插件 private capability、`onStartup` 非白名单，全部 fail closed。
