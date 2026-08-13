## Context

Sidebar 已把 Session Index 作为 cold-start 的 list-level 权威。
`listThreadsForWorkspace` 在取得 Index page 后立即 mapper，并显式传入空
`hiddenSharedBindingIds`。Shared summary 与 V2 binding 要等后续
`list_shared_sessions`。

`list_workspace_shared_sessions` 只收集：

- V0 `bindings_by_engine` / `bindings_by_target` 的当前 `native_thread_id`
- 当前 `shared_binding_state.native_session_id`

rebuild 后旧 id 写在 `provisioning_json.archivedNativeSessionId`，且只留
最近一次。Claude Index writer 扫 project 根目录全部 `*.jsonl`，历史容器
会以 `Claude Session` 常驻。Claude writer 的 `parent_session_id` 恒为
`None`，既有 `useThreadRows` parent-id 下崽对 Index Claude 行无效。

既有 Shared V2 send / Binding lifecycle 与 parent-id 树隐藏都不应当为修
Index projection 而改写。workspace session catalog contract 已要求：
普通 native projection 的 Shared exclusion 取 legacy metadata 与 canonical
V2 binding 的并集；本 change 把「并集」补全到 archived / 历史 id，并接到
Index 同一次 IPC。

## Goals / Non-Goals

**Goals:**

- Index 首屏、soft refresh、continuity、最终 sidebar merge 共用同一份
  Shared native owner visibility 事实。
- hide 权威 = 当前 V0/V2 ∪ archived ∪ 有界历史 native id ∪ 精确协议 hint。
- ownership 不可用时 fail-closed；未过滤快照不得沉淀为 last-good。
- visibility reader 只读、短超时，不走 `SharedEventWriter` 命令通道。
- 保持 Index bounded I/O；不以 full catalog / 全文 transcript 为前置。

**Non-Goals:**

- 不改 Shared V2 materialize/send/recovery，不改 Claude `--session-id` /
  `--resume`。
- 不删除历史 native 文件，不把 parent-id hide 改成 store deletion。
- 不以 generic title / `Agent N` 作为 ownership 证据。

## Decisions

### 1. 同 IPC 返回 companion projection，hide 必须含历史 id

`list_session_index_for_workspace` 增加
`SharedNativeVisibilityProjection`：

- `available` / `freshness`（`verified` | `partial` | `unavailable`）
- `hiddenNativeIds`：normalized raw + 将由 FE `expandHiddenSharedBindingIds`
  再扩 `engine:raw`
- `protocolHiddenNativeIds`：Index 行 title / nativeTitle 命中精确 MOSSX
  program token 的 session id
- `reason`：partial/unavailable 的 typed 原因

输入（按优先级并集）：

1. workspace `shared-sessions/*/meta.json` 的 V0
   `bindings_by_engine` / `bindings_by_target`
2. 只读打开 `shared-event-log-v2.sqlite3` 的
   `shared_binding_state.native_session_id`
3. 同表 `provisioning_json.archivedNativeSessionId`
4. 有界扫描对应 session 的 `binding.*` 事件 payload 中的
   `nativeSessionId` / `archivedNativeSessionId`（硬上限，禁止全表事件扫）
5. 当前 Index page 上协议命中的 session id

路径从 `AppState.storage_path` 的 parent 推导 event log 文件，与
`SharedEventWriter` 打开同一文件，但使用 `SQLITE_OPEN_READ_ONLY` + 短
`busy_timeout`（目标 ≤ 200ms）。禁止 `binding_states_for_session` 走
writer actor。

**选择原因：** 消灭「Index 已返回、Shared RPC 未返回」的空集合窗口，同时
补上 rebuild 后 hide set 丢历史 id 的常驻泄漏。

**替代方案：**

- 等 `list_shared_sessions`：拒绝（第二条 RPC + 仍缺 archived）。
- 只在 Index SQLite 缓存 ownership：拒绝作唯一权威（rebuild 后过期）。

### 2. 无 verified 事实则 fail-closed，且未过滤行不得沉淀

Frontend 仅在下列之一成立时对 ordinary native Index 行做 early-paint：

- 本次 projection `available == true` 且 `freshness == verified`
- 存在该 workspace 的 last-**verified** hide set（仅完整 verified
  projection 可写入；collab-only / partial hide 不得转正）

存在 Shared session 且只读 V2 查询失败时，projection 必须
`unavailable`，不得用 V0 残集冒充 first-paint 通行证。early-paint 必须
保留已有 / last-good 的 `shared:*` 行，禁止整表只写 Index native。

否则：保留当前已验证 sidebar / last-good，或让受影响 native 维持 pending；
**禁止** `hiddenSharedBindingIds: new Set()` 写入。

后续 refresh / `list_shared_sessions` 只能与 verified hide **取并集**。
early-paint 未发生时，abandon 自然不会留下未过滤 `setThreads`。
`rememberLastGoodThreadSummaries` 仍只在 final strip 之后调用；并加测试
钉死：unfiltered Index 行不得进入 last-good。

空 workspace、零 Shared session：`available=true` 且 hide 为空，必须照常
画出普通 native 行。fail-closed 不是「先藏起所有 Claude」。

### 3. 单一 predicate，parent-id 树规则保持独立

抽取纯函数：输入 thread id、durable hide、protocol-hidden → 是否排除
ordinary native row。

- `shared:*` / `threadKind === "shared"` 永远可见
- 只认 durable identity + 精确协议 hint，不读展示标题
- `useThreadRows` parent-id 下崽仍是 presentation rule，本 change 不改
  其语义

Claude writer 在 bounded header / `subagent:{parent}:{agent}` id 能解析时
写入 `parent_session_id`。这是增强，不是宣称 Index Claude 树已经完整。
writer 仍只扫 project 根 `*.jsonl`，不把 subagents 目录拉进本轮范围。

### 4. 协议 fallback 只在 raw Index 字段上判定

FE 标题已被 `sanitizeNativeSessionTitle` 洗成 `Claude Session`，不能当
证据。分类必须发生在 backend：看 Index 尚未 sanitize 的 `title` /
`nativeTitle`（即 writer 从 history / 首条 user peek 写入的原文）。

命中集合仅限程序 token 行首：

- `MOSSX_CONTEXT_PACKAGE`
- `MOSSX_CONTEXT_ACCEPTED`
- `MOSSX_NATIVE_CONTEXT_V1`
- `MOSSX_SHARED_CONTEXT_V1`

`Claude Session`、`Agent N`、Markdown、普通 user prompt 不是证据。
本轮只消费 Claude writer 已写入的字段；不把 Codex/Kimi writer 扩 scope。

### 5. 不改 native lifecycle；负向回归矩阵锁住旧路径

测试负向矩阵：普通 native create/resume/delete、Shared child re-parent、
curtain / Strip、`useThreadRows` 真下崽、无 Shared 的父子树。

## Risks / Trade-offs

- [只读 event log 被 writer 长事务挡住] → 短 busy_timeout；失败标
  `partial`/`unavailable`，用 last-verified 或 pending，不以空 hide 画。
- [多代 rebuild 早于 last-archive 的 id 不在 binding 表] → 协议 hint +
  有界 binding 事件扫描；仍可能漏「首条已是真人 prompt」的极旧容器，
  不为此扫全文 JSONL。
- [fail-closed 被理解成藏起全部 Claude] → spec/测试钉死：
  `available && hide empty` 必须画出普通 native。
- [identity 前缀漏网] → backend 给 raw，FE 复用
  `expandHiddenSharedBindingIds`。
- [旧 fallback 再注入] → 所有 `setThreads` 前复用同一 predicate。

## Migration Plan

1. 先落地只读 visibility reader + IPC 字段 + Rust 单测。
2. 再改 FE early-paint / union / last-verified；禁止空 hide。
3. Claude writer 补 parent；协议 hint 从已有 title 字段收集。
4. focused Rust / Vitest / typecheck；冷启手测无 full-catalog。
5. 回滚面：FE 停消费 projection 即可回到旧 Index 行为；不回滚用户数据。
   无 Shared event schema migration。

## Open Questions

- 有界 binding 事件扫描的具体 fact_type 白名单以实现时 `rg` 为准；不得
  变成全表 `payload_json LIKE`。
- Codex/Kimi 历史容器的协议 hint 不在本轮；若实机再出现非 Claude 常驻
  泄漏，另开 change。
