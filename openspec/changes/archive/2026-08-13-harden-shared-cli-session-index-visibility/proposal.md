## Why

Shared CLI 为执行创建的 native session container 是 `shared:*` 的内部 Binding，
不得成为用户可见的普通会话。截图中侧栏一排 fallback 标题 `Claude Session`
（跨小时到数天）是这条既有规则被 Session Index 新数据面打断后的常驻泄漏，
不是 Claude native create/resume 写错，也不是 Codex 那种 `parentThreadId`
子代理升根。

既有治理已经覆盖：

- native catalog / 异步 refresh 的 hide set（含 raw / `engine:raw`）
- `MOSSX_*` 标题闸
- `useThreadRows` 的 parent-id 下崽隐藏（依赖 `parentThreadId` 仍在）

`rewrite-sidebar-session-index` 把侧栏权威改成 Session Index，并禁止
post-first-paint 自动 full-catalog，但首屏显式传入空 hide set；Claude writer
也不写 `parent_session_id`。结果是：

1. **闪一下**：Index early-paint 在 `list_shared_sessions` 返回前用空 hide 写入。
2. **一直在**：`list_shared_sessions` 的 hide set 只有 **当前** V0
   `native_thread_id` ∪ 当前 V2 `native_session_id`，不含
   `archivedNativeSessionId` 与更早 rebuild 留下的磁盘容器。Index 已是最终
   list 权威，这些历史行不会再被 catalog 清掉。FE `sanitizeNativeSessionTitle`
   把 MOSSX 首条洗成空，显示成 `Claude Session`，标题闸失效。

这不是缺一条新的「下崽规则」，是新 list 数据面没继承
「Shared Hidden Native Binding 不得进入普通 Native projection」。

## 目标与边界

- Session Index first-paint、soft refresh、continuity merge 与最终 sidebar
  写入普通 native row 前，使用同一份 durable Shared ownership projection。
- hide set 必须包含：legacy V0 binding、当前 V2 `native_session_id`、
  `provisioning_json.archivedNativeSessionId`，以及能廉价扫到的历史
  `nativeSessionId`。
- `shared:*` canonical row 仍是唯一用户入口；未证明 Shared ownership 的
  用户 native 会话（含合法弱标题 `Claude Session`）必须继续可见。
- 无 ownership 事实时 fail-closed：禁止空 hide 投影新 Index native 行；
  未过滤 early-paint 不得成为 last-good / sidebarSnapshot。
- 保持 Session Index 有界 I/O；visibility reader 只读、可超时，不得和
  `SharedEventWriter` recovery/projection 抢同一把 actor 锁。
- Claude writer 在既有 bounded header 内补 `parent_session_id`（能解析才写），
  并让协议级 control-plane 容器进入 projection；不按 generic title 隐藏。

## 非目标

- 不修改 Claude/Codex/Kimi/Grok/OpenCode native session 的 create、resume、
  fork、delete 或 transcript restore lifecycle。
- 不修改 Shared V2 provisioning、ACK、recovery 或 explicit rebuild 语义。
- 不删除、迁移或批量清理用户的 native history 文件。
- 不按 `Claude Session`、`Agent N` 或普通用户标题作模糊隐藏。
- 不把 parent-id 树隐藏改成 store-level deletion；幕布 / Strip /
  `childSubagentThreads` 数据源保持不变。
- 不把「Index Claude 已有完整 parent 树」写成已交付事实。writer 只做
  bounded 补齐；`useThreadRows` 规则独立保留。

## What Changes

- Session Index list IPC 同次返回 `SharedNativeVisibilityProjection`
  （availability / freshness / hidden ids / protocol-hidden ids）。
- 投影输入 = V0 metadata ∪ 当前 V2 binding ∪ archived native id ∪
  有界历史 native id；用独立只读 SQLite 连接读取 event log，超时或失败
  标 partial/unavailable，不走 `SharedEventWriter` 命令通道。
- Frontend 只在 projection 可用或存在 last-**verified** hide 时做 Index
  early-paint；abandon / timeout 不得留下未过滤 `setThreads`。
- 同一 predicate 复用于 Index mapper、continuity/fallback 与 final gate；
  后续 Shared snapshot 与 verified hide **取并集**，不得用空集替换。
- Claude writer：bounded header 识别精确 MOSSX protocol token，把该
  session id 标进 protocol-hidden；能解析则写 `parent_session_id`。
- 契约与测试覆盖：V2-only、legacy、archived、多代 rebuild 残留、空 hide
  首屏、abandon 竞态、正常同名 native、`shared:*` 不被误藏。

## 技术方案与取舍

| 方案 | 说明 | 取舍 |
|---|---|---|
| A. 等待 `list_shared_sessions` 后再首屏 | 复用现有前端 hide set | 拒绝：把第二条 RPC 放进 cold-start，削弱 Index 性能目标。 |
| B. 依据 `Claude Session` 等标题过滤 | 改动最小 | 拒绝：标题不是 ownership proof，会误伤用户会话。 |
| C. 只修空 hide 首屏 | 治 flash | 拒绝作唯一修复：截图常驻来自 hide set 不含历史 id。 |
| D. durable hide（当前+archived+历史）同 IPC 返回 + fail-closed + 只读 reader + 协议兜底 | 不改 native/Shared lifecycle | **采用**。 |

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `shared-session-thread`: Hidden Native Binding 规则扩展到 Session Index
  first-paint / soft refresh；hide 权威含 archived / 历史 native id；
  无 ownership 时禁止空 hide 投影；协议 fallback 仅限精确 MOSSX marker。
- `workspace-sidebar-session-loading`: first-paint 完成态 = Index 行 +
  verified Shared visibility；不可用时 fail-closed，且不得退化为
  full-catalog。

## Impact

- Backend：`list_session_index_for_workspace` response、只读 visibility
  reader、Claude bounded writer 的 parent / protocol hint。
- Frontend：Index mapper、`listThreadsForWorkspace` early/final gate、
  last-verified hide 缓存。
- Specs：上述两个 capability delta；回写
  `dev-guidelines/guides/workspace-session-catalog-contract.md`。
- 无新依赖；不改 native CLI 历史格式、不改 Shared event schema。
- 若命中基石文档「canonical fact / Shared support」触发器，收口前校准
  `docs/research/mossx-multi-cli-provider-session-foundation-design.md`。

## 验收标准

- cold-start：当前 V2-only / legacy Binding 的 Claude owner 不得先闪成
  `Claude Session`；侧栏只留对应 `shared:*`。
- rebuild / 换绑后：`archivedNativeSessionId` 与仍留在 project 目录里的
  历史 Shared 容器不得作为普通 native 行常驻。
- Shared lookup 延迟、失败或 ordinary refresh：已知 ownership 不得退化
  为空集合；未过滤 Index 行不得写入 last-good。
- raw UUID 与 `engine:uuid` 的同一 Binding 都被隐藏；没有 Shared
  ownership 的 native `Claude Session` 继续可见。
- 精确 MOSSX control-plane envelope 的历史容器可被隐藏；普通用户文本、
  `Agent N`、generic title 本身不得触发隐藏。
- parent-id 下崽、native 父子树、幕布/Strip、native create/resume/delete
  行为保持不变。
- first-paint 不触发 exhaustive catalog 或完整 transcript scan；
  visibility 读取不阻塞在 `SharedEventWriter` actor。
- `openspec validate harden-shared-cli-session-index-visibility --strict --no-interactive`、
  focused Rust/Vitest 与相关 typecheck 通过。
