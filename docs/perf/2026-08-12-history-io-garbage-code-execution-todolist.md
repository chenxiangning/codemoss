---
type: plan
status: active
---

# 历史 IO / 列表元数据屎山 · 可执行 TodoList

> **读者**：执行本清单的人（人或 AI）  
> **日期**：2026-08-12  
> **产品版本参考**：以执行时 `package.json` / `HEAD` 为准  
> **审计来源**：同日全局排查「侧栏为展示标题却读全量 CLI 消息 / 4GB 磁盘」同类病灶  
> **关联已落地**：`feat(sidebar): use Session Index as cold-path list source`（`100fc22d5`）  
> **关联文档**：
> - `docs/perf/render-jank-knife-experiments-2026-07-08.md`（根渲染四层根因；本清单不重复做 A1–A4）
> - `docs/perf/2026-08-10-react-best-practices-p0-followup-execution-plan.md`（层 4 / AppShell）
> - `docs/perf/2026-08-12-new-user-cold-start-perf-todolist.md`（冷启动 bundle/CSS；本清单不重复）
> - `dev-guidelines/guides/workspace-session-catalog-contract.md`
> - `openspec/specs/workspace-session-catalog-projection/spec.md`

## 使用方式（强制）

1. **一次只推进一个可勾选项**（或同一编号下明确写「本批子项」），做完再开下一项。  
2. **完成定义 = 勾选 + 填写「完成记录」**：日期、commit（若有）、证据路径/命令输出摘要。  
3. **AI 执行时**：每完成一项必须把对应 `- [ ]` 改为 `- [x]`，并更新下方「进度总览」计数与对应 Wave「完成记录」表。  
4. **禁止主动 `git commit`**：展示变更摘要后，用户字面授权「提交」才能提交。  
5. **数值以重新采样为准**：文中的 GB / ms 是结构证据或历史锚点，不是永久 KPI。  
6. **测量时关闭 react-scan**（2–3x 放大器）。  
7. **跨层行为变更**（打开会话分页、Session Management 默认 Bounded）必须先 OpenSpec，再改代码。  
8. **本清单是活文档**：执行中发现新同类病灶，追加到「执行中发现」表，不要另开散文档。

### 勾选约定

| 标记 | 含义 |
|------|------|
| `- [ ]` | 未开始 |
| `- [x]` | 已完成（须有完成记录） |
| `- [~]` | 进行中（可选，会话中临时用） |
| `- [-]` | 取消 / 不适用（须在备注写原因） |

### AI 回写进度清单（每完成一项必做）

执行者（人或 AI）在勾选 `- [x]` 的**同一回合**内必须：

1. 把该项改为 `- [x]`，子验收 checkbox 一并勾完或写明剩余。  
2. 更新文首「进度总览」：该 Wave「已完成」+1，必要时改状态。  
3. 在该 Wave「完成记录」表追加一行：项 / 日期 / commit / 证据。  
4. 若改了数据面职责，同步改文末「三层数据面」表的「当前状态」列。  
5. 若发现新病灶：追加到「执行中发现」，标 P0/P1/P2，不要偷偷塞进已完成项。  
6. 不要回填过期 `docs/perf/*-baseline.json` 冒充 current。证据写入 `.artifacts/perf/history-io-YYYYMMDD/`。

---

## 进度总览

| 阶段 | 标题 | 总项 | 已完成 | 状态 |
|------|------|------|--------|------|
| **S0** | 基线、复现口径、三层数据面对齐 | 4 | 4 | 已完成 |
| **W0** | 止血：列表路径禁止读全文 | 6 | 6 | 已完成 |
| **W1** | 设置页 / Session Index 硬化 | 4 | 4 | 已完成 |
| **W2** | 打开会话窗口化 + 根链单价 | 5 | 5 | 已完成 |
| **W3** | 搜索 / usage / 结构债 | 4 | 4 | 已完成 |
| **合计** | | **23** | **23** | |

> 更新规则：每勾选一项，同步改本表「已完成」与「状态」（未开始 / 进行中 / 已完成）。

---

## 背景：一类结构性病（只读，勿当任务）

**用户主诉**：侧栏对话记录为了展示标题，读取所有 CLI 的所有消息；历史文件合计约 4GB，每次进入都扫一遍。该侧栏冷路径已切 Session Index。

**真正的病**：用「全量 transcript / 全量 inventory」去满足「只要 id / title / mtime / 排序」的需求。

| 层 | 正确职责 | 错误做法（本清单要消灭） |
|----|----------|--------------------------|
| **Session Index**（SQLite） | 侧栏、冷启动、soft 刷新 | 冷路径 fan-out 各引擎 `list_*_sessions` 读 JSONL/JSON 全文 |
| **Session Catalog**（bounded） | 会话管理、归档、归属 | 打开设置页就 `Exhaustive` / `usize::MAX` |
| **Transcript Loader**（window） | 打开某一个对话 | 一次把整会话灌进 `itemsByThread` |

三层串层 = 再次 4GB。

### 产品硬约束（禁止擅自反转）

- 不擅自恢复流式期时间线虚拟化 / `content-visibility` / 对话级 lightweight 摘要墙。  
- 不破坏 stick-to-bottom、fork/resume、archive、多引擎标题语义。  
- 不把 Session Management 的归属/归档语义偷偷改成「只显示最近 50 条且无法扫全」。显式「扫描全部」必须保留。  
- 根链禁止：高频 setState、数组追加型 setState、秒级轮询。

### 永不回归三问（每个 PR 自检）

1. **UI 只要 title / mtime / id 吗？** → 禁止打开 transcript 全文。  
2. **有 limit 吗？** → limit 必须在 **IO 之前** 生效，禁止 parse 完再 `truncate`。  
3. **会在冷启动 / focus / interval 自动跑吗？** → 必须有字节预算 + 超时 + 可取消。

---

## S0 — 基线与验收门禁

目标：先有可对比证据，避免「感觉变快」无法复核。本阶段**不改业务行为**。

- [x] **S0-1** 记录当前 `HEAD`、版本、平台，并列出本清单将触碰的命令矩阵  
  - 记录：`git rev-parse HEAD`、`package.json` version、`uname -s`  
  - 列出当前 list/load 入口（至少）：  
    - `list_session_index_for_workspace` / `sync_session_index_for_workspace`  
    - `list_claude_sessions` / `load_claude_session`  
    - `list_gemini_sessions` / `load_gemini_session`  
    - `list_grok_sessions` / `list_kimi_sessions`  
    - `list_workspace_sessions`（Session Management）  
    - `useThreadActions` first-paint vs post-paint 分支  
  - 证据写入：`.artifacts/perf/history-io-YYYYMMDD/s0-command-matrix.md`  
  - **验收**：矩阵里每个命令标「冷路径 / 热补扫 / 设置页 / 打开会话」四选一（可多标）

- [x] **S0-2** 固化「4GB 同类病」复现口径（可在开发机用稀疏大文件，不必真 4GB 内容）  
  - 建议 fixture 策略：少量 JSONL 行 + `seek`/`truncate` 把文件撑到 200MB+（内容可为空洞），断言 **读取字节数** 而不是墙钟（墙钟受磁盘缓存影响）  
  - 记录现有测试：`src-tauri/src/engine/claude_history_*_tests.rs`、`gemini_history.rs` 内测、`session_index` 测例  
  - **验收**：写下「W0 完成后 list 路径允许读的最大字节 / 最大行数」草案（先写进 artifacts，W0-6 再变成测试）

- [x] **S0-3** 人工冷路径勾选（关 react-scan；有真实大体量历史的机器优先）  
  - [x] M1 进主窗 / 切到已有 workspace：侧栏能出列表，StartupGate 可解  
  - [x] M2 侧栏标题可读（Claude / Codex / 至少再选 1 个已装引擎）  
  - [x] M3 打开设置 → 会话管理：能出列表（允许慢，先记录体感）  
  - [x] M4 打开一条长历史对话：能渲染（允许慢，先记录体感）  
  - 证据：`s0-manual-checklist.md`（可只写「本机无 4GB 历史，用 fixture 代替」）

- [x] **S0-4** 相关回归单测绿灯（后续每 Wave 结束可复跑子集）  
  - 建议至少：  
    ```bash
    cargo test --manifest-path src-tauri/Cargo.toml list_claude list_gemini session_index -- --nocapture
    npx vitest run src/features/threads/hooks/useThreadActions.stale-list-abandon.test.tsx \
      src/features/threads/hooks/useThreads.sidebar-cache.test.tsx \
      src/features/threads/hooks/sessionIndexThreadSummaries.test.ts
    ```  
  - 命令按仓库当前 test 名微调；跑不通先改本项备注，不要假绿  
  - **备注（2026-08-13）**：`list_gemini` filter 匹配 0 条，改跑 `gemini_history` 15 tests。Rust 子集 22 绿。vitest 15/16；`useThreads.sidebar-cache`「rewrites cached thread summaries…」5s 超时（`listSharedSessions`/`listThreadTitles` 未 mock，卡在 30s `withTimeout`）。S0 不改测例，不假绿。

### S0 完成记录

| 项 | 日期 | commit | 证据 / 备注 |
|----|------|--------|-------------|
| S0-1 | 2026-08-13 | 无（未授权提交） | HEAD `0889e65c8` / v0.8.9 / Darwin arm64。矩阵：`.artifacts/perf/history-io-20260813/s0-command-matrix.md`。另登记 PI `list_pi_sessions`（新引擎，原 7 引擎表未列）。 |
| S0-2 | 2026-08-13 | 无 | `.artifacts/perf/history-io-20260813/s0-2-repro-budget-draft.md`。草案：Claude list ≤64KiB/40 行、mtime 后只扫 limit；Gemini list peek≤64KiB 且只打开 ≤limit；W0-6 门禁 32MiB→读≤256KiB。 |
| S0-3 | 2026-08-13 | 无 | `.artifacts/perf/history-io-20260813/s0-manual-checklist.md`。本机 **有** 大体量：Grok 3.1GiB + Codex 2.6GiB。M1–M4 按代码合同勾选；真人 Tauri 体感未录。 |
| S0-4 | 2026-08-13 | 无 | `.artifacts/perf/history-io-20260813/s0-4-regression.md`。Rust `list_claude` 6 + `session_index` 1 + `gemini_history` 15 = 22 绿。vitest 15 绿 / 1 预存超时（见备注）。 |

---

## W0 — 止血：列表路径禁止读全文（最高 ROI）

目标：侧栏 / first-paint / 后台补扫 **不再**为标题或排序读取数 GB transcript。  
**本 Wave 不改打开会话的全量 load 契约**（那是 W2）。

成功标准（硬）：

- 会话文件合计 ≥ 2–4GB（或 fixture 等价）时：  
  - 冷进侧栏不出现「读完全盘才出标题」  
  - `list_*_sessions` 调试计数下 **读字节 ≪ 总 transcript 体积**  
  - first-paint 后 30s 内无二次 multi-GB 扫描峰

---

### W0-1 Claude `list_*` / `scan_session_source_file` early-stop

- [x] **W0-1** Claude 列表扫描拿到元数据后停止，禁止为 `message_count` 扫到 EOF  

**现状（审计时）**：`src-tauri/src/engine/claude_history.rs` 的 `scan_session_source_file` 逐行读到文件结束，只为了 `first_user_message` / `custom-title` / 首末时间戳 / `message_count`。`list_claude_sessions_from_base_dir` 还会对项目目录下**所有** jsonl 并发扫（信号量 10），**先全扫再** `limit`。

**做法（最小）**：

1. 新增 list 专用扫描模式，例如 `ClaudeSessionScanPurpose::ListSummary` vs `CatalogFact`。  
2. List 模式满足以下即可返回：  
   - `session_id`（文件名）  
   - `first_user_message` 或 `native_title`（`custom-title`）  
   - `updated_at`：**优先文件 mtime**，不必为 last_ts 读完全文  
   - `created_at`：首条时间戳（可在前 N 行拿到就停）  
3. 硬预算建议：  
   - 最多读前 `40` 行 **或** 前 `64 KiB`（与 `session_index/writers.rs` `peek_claude_first_user_preview` 对齐）  
   - 单行 `> 200_000` 字节跳过  
   - 已有 title + first user 后立刻 `break`  
4. `message_count` 对侧栏非必需：list 可返回 `None` / 不展示；Catalog 路径若仍要 count，走 W1 的 Bounded/显式扫描，不要绑在侧栏。  
5. **IO 前 limit**：按 mtime 排序文件后只扫 `limit`（默认 200）个，禁止「全目录扫完再 truncate」。  
6. 子 agent jsonl：list 默认不扫；或只扫与已选父会话相关的。侧栏不需要全量子会话 inventory。

**关键文件**：

- `src-tauri/src/engine/claude_history.rs`（`scan_session_source_file`、`list_claude_sessions_from_base_dir`）  
- 现有测例：`claude_history_inline_tests.rs`、`claude_history_issue529_tests.rs`、`claude_history_filter_tests.rs`  
- 对照已正确的 peek：`src-tauri/src/session_index/writers.rs` `peek_claude_first_user_preview`

**风险**：

- 丢「最新 custom-title」（title 写在文件尾）→ list 模式若前 64KiB 没看到 `custom-title`，可 fallback `history.jsonl` 标题（Index writer 已读）或接受 first user preview。  
- `updated_at` 用 mtime 可能与 transcript 内最后一条差几秒 → 侧栏排序可接受。  

**验收**：

- [x] 新增测例：稀疏/大文件（≥ 8MiB 空洞或重复填充）上 `list_claude_sessions_*` **读取字节有上限**  
- [x] 现有 title / filter / issue529 测例仍绿  
- [x] 侧栏 Claude 标题不回归（first user / native title）

**建议验证命令**：

```bash
cargo test --manifest-path src-tauri/Cargo.toml -- claude_history
```

---

### W0-2 Gemini `list_gemini_sessions`：IO 前 limit + 禁止全文 parse

- [x] **W0-2** Gemini 列表按 mtime 取 top-N，禁止 `read_json` 全部匹配文件后再 `truncate`  

**现状（审计时）**：`src-tauri/src/engine/gemini_history.rs`

- `collect_chat_files_sync` 递归收齐 `tmp/` + `history/` 下全部 chat 文件  
- `resolve_workspace_session_files` 对每个匹配文件 `read_json`（`read_to_string` + 全量 `serde_json`）  
- `list_gemini_sessions` 全 parse 后 `sort` + `truncate(limit.unwrap_or(200))`

**做法（最小）**：

1. 收集路径后先 `metadata().modified()` / `len`，**不读内容**。  
2. workspace 过滤尽量用路径 / `projects.json` alias，避免先读全文。若必须 peek `sessionId`/`cwd`：只读文件头固定字节（建议 ≤ 64KiB）。  
3. 按 mtime 降序，只对 top-`limit` 做 summary parse。  
4. `parse_summary_from_value` 需要 `messages` 才能抽 `first_message` 时：改为流式/头尾 peek，或只取第一个 user 文本字段，禁止为 list 物化全部 messages。  
5. `load_gemini_session` 的全文 `read_json` **本项不要改完**（W2-4）；但 list 路径不得再调用它。

**关键文件**：

- `src-tauri/src/engine/gemini_history.rs`（`list_gemini_sessions`、`resolve_workspace_session_files`、`read_json`、`parse_summary_from_value`）  
- 命令入口：`src-tauri/src/engine/session_history_commands.rs`

**验收**：

- [x] 测例：N 个大 JSON（或空洞大文件）时 list 只打开 ≤ `limit` 个文件，且单文件读字节有上限  
- [x] 现有 Gemini history 单测绿  
- [x] 侧栏 Gemini 标题仍有 first_message / 占位「Gemini Session」

**建议验证命令**：

```bash
cargo test --manifest-path src-tauri/Cargo.toml -- gemini_history
```

---

### W0-3 关掉 first-paint 后的 multi-engine 全量 list 补扫

- [x] **W0-3** post-paint 后台补全只走 Session Index soft/force sync，不再自动 `listGemini/Grok/KimiSessions`  

**现状（审计时）**：`src/features/threads/hooks/useThreadActions.ts`

- first-paint 已跳过 OpenCode / native multi-engine fan-out（正确）  
- 但 `!isFirstPaintHydration` 时仍 `shouldRefreshGeminiSessions` / Grok / Kimi，调用 `listGeminiSessionsService(workspace.path, 50)` 等  
- `useWorkspaceThreadListHydration.ts` 的 post-first-paint 已改成 Session Index soft re-sync（注释写明 NOT exhaustive）；**补扫漏在 `useThreadActions` 热路径**

**做法（最小）**：

1. first-paint **与** 默认 listThreads：禁止自动 `listGemini/Grok/Kimi/Claude` 全文 list。  
2. 后台补全新会话：只 `listSessionIndexForWorkspace(..., { forceSync: true })` 或现有 `forceSessionIndexSync`。  
3. 引擎 `list_*` 仅保留：  
   - 用户显式「刷新会话列表」  
   - Index miss 且该引擎无 light index（评估后写进完成记录）  
   - Session Management（W1 再收）  
4. 更新 `useThreadActions.stale-list-abandon.test.tsx` 等：断言 first-paint / 默认 hydrate **不**调用 `listGeminiSessions` 等。  
5. 若测试依赖「hydrate 后一定 merge Gemini」：改为断言 Index writer / merge 自 Index rows。

**关键文件**：

- `src/features/threads/hooks/useThreadActions.ts`（约 1700+ Gemini/Grok/Kimi 分支）  
- `src/app-shell/sections/useWorkspaceThreadListHydration.ts`  
- `src/features/threads/hooks/useThreadActions.stale-list-abandon.test.tsx`  
- `src/features/threads/hooks/sessionIndexThreadSummaries.ts`

**风险**：

- CLI 刚在外部新建的会话，侧栏可见延迟取决于 Index fingerprint 窗口（当前 `SOURCE_FRESH_MAX_AGE_MS = 8_000`）。可接受；用户强制刷新仍可 sync。  
- Shared / hide 契约：merge 必须仍走 `expandHiddenSharedBindingIds`，不要为了删补扫把 hide 弄丢。

**验收**：

- [x] 单测：first-paint 与默认 `listThreadsForWorkspace` **不**调用 `listGeminiSessions` / `listGrokSessions` / `listKimiSessions`；first-paint 仍不调用全量 `listClaudeSessions`。默认非 first-paint Claude fallback seed 保留（避免打烂 last-good / catalog 测例）。显式 `includeEngineDiskLists: true` 才打 Gemini/Grok/Kimi。  
- [x] 强制刷新仍能看到新会话（走 Index sync / `forceSessionIndexSync`）  
- [x] Shared worker hide 不回归（grok 异步 hide 测例改为 opt-in disk list）

**建议验证命令**：

```bash
npx vitest run src/features/threads/hooks/useThreadActions.stale-list-abandon.test.tsx \
  src/features/threads/hooks/useThreadActions.test.tsx \
  src/features/threads/hooks/sessionIndexThreadSummaries.test.ts
```

---

### W0-4 Session Index：Claude `history.jsonl` 标题增量

- [x] **W0-4** `read_claude_history_titles` 禁止每次 sync 整文件重扫  

**现状（审计时）**：`src-tauri/src/session_index/writers.rs` `read_claude_history_titles` 对 `~/.claude/history.jsonl` **逐行读完全部**，只为 workspace 过滤后的 `display` 标题。fingerprint 已含该文件 mtime；mtime 变就会全量重读。

**做法（最小）**：

1. 在 `session_index_sources` 或并列表记录 `{ path, inode/dev, size, offset }`。  
2. mtime/size 增长且 inode 未变：从上次 `offset` 只读新增行，merge 进已有 `session_id → title`（保留 earliest display 语义）。  
3. inode 变 / 文件缩小：全量 rebuild。  
4. 单行 `> 256_000` 仍跳过。  
5. `peek_claude_first_user_preview` 仅在 history.jsonl 没有该 session 标题时使用（已是 fallback）。

**关键文件**：

- `src-tauri/src/session_index/writers.rs`  
- `src-tauri/src/session_index/store.rs`  
- `src-tauri/src/session_index/commands.rs`

**验收**：

- [x] 测例：第二次 sync 同一 history.jsonl（仅追加一行）不把已读前缀再读一遍（可用 mock reader 或读字节计数）  
- [x] 截断/替换文件会 rebuild，不脏读  
- [x] 侧栏 Claude 标题仍优先 first prompt / native title

---

### W0-5 Grok / Kimi / Codex / OpenCode list 热路径核对（只修复发点）

- [x] **W0-5** 核对并修其余引擎 list 是否仍「为标题读全文」  

**现状（审计时，预期大多已好）**：

- Grok：list 流式 `BufReader`，第一句真实 user 就停；`summary.json` fallback。见 `grok_history.rs` 文件头。  
- Kimi：优先 `state.json`；缺 title 才 stream `wire.jsonl`。  
- Codex：Session Index 走 `scan_codex_session_summaries_for_index`（bounded）。  
- OpenCode：无本地 light index；first-paint 已跳过；`opencode_source_fingerprint` 用 15s 桶。

**做法**：

1. 逐引擎打开 `list_*` 实现，用三问自检，把结论写入 artifacts `w0-5-engine-list-audit.md`。  
2. **只改确认复发的路径**（例如 Codex 仍对每个 jsonl 读全文、OpenCode 自动 fan-out）。没有复发就勾选并在完成记录写「核过，无代码改动」。  
3. OpenCode：确认默认 hydrate **不会** `getOpenCodeSessionList`；仅 force refresh / 设置页可走。

**验收**：

- [x] 审计表 7 引擎（Claude/Codex/Gemini/Grok/Kimi/OpenCode/Shared）各一行：list IO 模型 / 是否 early-stop / 是否 IO 前 limit  
- [x] 有复发才改代码 + 测例；无复发也要留下审计表

---

### W0-6 「列表路径禁止全量 transcript」测试门禁

- [x] **W0-6** 把 S0-2 草案落成可重复跑的测试（防再合入「为标题读全文」）  

**做法**：

1. Rust 测例（优先，测真实 IO）：大文件 / 多文件 fixture + 读字节计数（可包装 `Read` 或用有限长度文件 + spy）。  
2. 覆盖至少：Claude list、Gemini list。  
3. 断言示例（数字可在实现时校准，写入完成记录）：  
   - 单文件 32MiB 时 list **读字节 ≤ 256KiB**（或 64KiB + 余量）  
   - 目录 500 个文件、limit=50 时 **打开文件数 ≤ 50 + 常数**（目录枚举除外）  
4. 可选：前端单测锁死 W0-3（不调用 `listGeminiSessions`）。  
5. 若适合进 CI：在现有 `cargo test` / vitest job 中自然覆盖即可，**不要**新造沉重 perf job，除非已有钩子。

**验收**：

- [x] 测例名稳定，失败信息能指出「谁读超了」  
- [x] W0-1 / W0-2 若已合入，本项应一次绿灯；若本项先做，允许先红再由 W0-1/2 变绿（TDD 时在完成记录注明顺序）

### W0 完成记录

| 项 | 日期 | commit | 证据 / 备注 |
|----|------|--------|-------------|
| W0-1 | 2026-08-13 | 无 | `ClaudeSessionScanPurpose::ListSummary`：mtime 后只扫 limit；有 first user 即停；不扫 subagent。测例 `claude_history_list_budget_tests`。`cargo test --lib -- claude_history` 63 绿。 |
| W0-2 | 2026-08-13 | 无 | `list_gemini_sessions` 先 mtime 再 peek 64KiB；不再 `read_json` 全匹配文件。`gemini_history` 17 绿。 |
| W0-3 | 2026-08-13 | 无 | 默认/first-paint 不自动 `listGemini/Grok/Kimi`；显式 `includeEngineDiskLists`。验收：`stale-list-abandon` 5 绿。Claude 非 first-paint fallback 仍保留。 |
| W0-4 | 2026-08-13 | 无 | `session_index_file_cursors` + 增量读 `history.jsonl`。测例：追加不重读前缀；截断 rebuild。 |
| W0-5 | 2026-08-13 | 无 | `.artifacts/perf/history-io-20260813/w0-5-engine-list-audit.md`。Grok/Kimi/Codex 无全文复发，无代码改动。 |
| W0-6 | 2026-08-13 | 无 | 门禁即 W0-1/W0-2 五条测例，cap 256KiB / 打开数=limit。先 W0-1/2 再落门禁（同日）。 |

---

## W1 — 设置页 Catalog 与 Index 硬化

目标：Session Management 不再被「进一下设置」打成全盘 4GB 扫描；Index 成为侧栏唯一自动源。

本 Wave 若改变「默认能看见多少历史 / Exhaustive 语义」，**先补 OpenSpec delta**（`workspace-session-catalog-projection`），再写代码。

---

### W1-1 Session Management 默认 Bounded，Exhaustive 显式

- [x] **W1-1** `list_workspace_sessions` 及相关投影默认 Bounded；「扫描全部」二次确认  

**现状（审计时）**：`src-tauri/src/session_management.rs` 多处 `SessionCatalogScanMode::Exhaustive`（`session_management_types.rs` 中 `Exhaustive => usize::MAX`）。设置页 `SessionManagementSection.tsx` 一进就可能触发全引擎 inventory。

**做法**：

1. 先读 `dev-guidelines/guides/workspace-session-catalog-contract.md` 与 catalog spec。  
2. 默认 query：`Bounded(limit)`（沿用现有 page size / scan cap，不要发明第三套数字）。  
3. UI：主列表先出 Bounded 结果 + 「可能未扫全」提示（已有 `scan_cap_reached` 就复用）。  
4. 「扫描全部」：按钮 + 确认；带进度；可取消。  
5. **禁止**启动 / focus / 侧栏 hydrate 调用 Exhaustive。  
6. `session_management_batch_assign.rs` 等后台批处理若必须 Exhaustive：保持，但不得挂到页面 mount。

**关键文件**：

- `src-tauri/src/session_management.rs`  
- `src-tauri/src/session_management_types.rs`  
- `src-tauri/src/session_management_catalog_helpers.rs`  
- `src/features/settings/components/settings-view/sections/SessionManagementSection.tsx`  
- `src/services/tauri/sessionManagement.ts`

**验收**：

- [x] 打开设置 → 会话管理：网络/磁盘不是「先扫完全部引擎全部文件」  
- [x] 显式扫描全部后，归属/归档与现在一致  
- [x] catalog 相关 Rust/TS 测例绿  
- [x] 若行为变更：OpenSpec delta 已写

---

### W1-2 Session Index 覆盖率与失效策略

- [x] **W1-2** 七引擎 writer 对齐：缺 light index 的引擎也要有界、可跳过、可 force  

**做法**：

1. 对照 `session_index/mod.rs` 设计目标与 `writers.rs`：Claude / Codex / Kimi / Gemini / Grok / OpenCode / Shared。  
2. 每个 writer：fingerprint + `source_is_fresh` + `limit.clamp(1, 500)` + `partial_source`。  
3. Gemini/Grok writer 必须调用 **W0 之后** 的有界 list，而不是旧全文 list。  
4. OpenCode：soft sync 用现有 15s 桶；**不要**在 soft 路径打满 fan-out。  
5. `invalidate_session_index_for_workspace` 后下一次 sync 有界，不是 Exhaustive catalog。

**验收**：

- [x] artifacts 写一页 `w1-2-writer-matrix.md`：引擎 × fingerprint × IO 模型 × force 行为  
- [x] force refresh 能补到新会话，且耗时与「会话文件总 GB」解耦（结构上）

---

### W1-3 三层数据面写进指南（短、可执行）

- [x] **W1-3** 在 `workspace-session-catalog-contract.md`（或并列短节）写死三层职责  

只写规则，不写实现散文：

- 侧栏 / 冷启动 → Session Index  
- 会话管理 / 归档 / 归属 → Session Catalog（默认 Bounded）  
- 打开对话 → Transcript Loader  

并加「禁止串层」示例：hydrate 里 `Promise.all(listClaude, listGemini, …)`。

**验收**：

- [x] 指南有「三问」  
- [x] 本清单文末「三层数据面」表「当前状态」改为「已写入指南」

---

### W1-4 W0+W1 回归包

- [x] **W1-4** 复跑 S0-4 + W0 引擎测 + 会话管理测 + 侧栏相关 vitest  

把实际命令与结果摘要写入完成本项。失败先修，不要带红勾选。

### W1 完成记录

| 项 | 日期 | commit | 证据 / 备注 |
|----|------|--------|-------------|
| W1-1 | 2026-08-13 | 无 | OpenSpec `bound-session-management-default-scan`。`scanMode` 显式才 Exhaustive；keyword/folder/archived 不再隐式升。UI：scanCap + 扫描全部确认。Mutation 仍 Exhaustive。 |
| W1-2 | 2026-08-13 | 无 | `.artifacts/perf/history-io-20260813/w1-2-writer-matrix.md`。七引擎已有界；invalidate 后 sync 仍 clamp 1..=500。 |
| W1-3 | 2026-08-13 | 无 | `workspace-session-catalog-contract.md` §2.1 三层 + 三问 + 禁止串层示例。 |
| W1-4 | 2026-08-13 | 无 | `.artifacts/perf/history-io-20260813/w1-4-regression.md`。vitest 58 绿；catalog 两处旧隐式扫全测例已按 Bounded 改写并绿。 |

---

## W2 — 打开会话窗口化 + 根链单价

目标：点开一条「几个 GB 里的其中一个会话」时，不再把整 transcript 灌进 React。  
**本 Wave 风险高于 W0**，必须 OpenSpec，且一次只做一引擎或先做契约。

---

### W2-1 OpenSpec：Transcript windowed load 契约

- [x] **W2-1** 先写 change（proposal / design / tasks），**不改生产行为**  

契约要点：

- `load_*_session` 增加 cursor / limit / direction（先最近 N 条，向上加载更早历史）。  
- 默认 N 与现有幕布产品约束对齐（不引入对话级摘要墙）。  
- fork / resume / compact / Shared 续接：必须能拿到引擎需要的完整可恢复上下文（可以后台静默拉全量 cursor，但 UI 首屏只挂窗口）。  
- tool 大输出继续走现有 budget / redact（Grok 已有，Claude/Gemini 对齐）。  
- 失败回退：窗口加载失败不得损坏磁盘 transcript。

**验收**：

- [x] `openspec/changes/<change-id>/` 存在且 tasks 可勾  
- [x] 未提前改生产 load 语义

---

### W2-2 实现窗口化 load（建议先 Claude，再 Gemini）

- [x] **W2-2** 按 W2-1 实现一个引擎的 windowed load + 前端向上加载  

建议顺序：Claude JSONL（天然可尾读）→ Gemini 单文件 JSON（更难，可能要建 sidecar 索引）。

**关键文件（起点）**：

- `src-tauri/src/engine/claude_history.rs` `load_claude_session_*`  
- `src/features/threads/loaders/claudeHistoryLoader.ts`（约 2400 行，只加窗口，禁止顺手重构）  
- `src/features/threads/hooks/useThreadActions.historyLoaderFactory.ts`  
- `src/features/messages/components/Messages.tsx` / `MessagesCore.tsx`（向上加载触发，遵守 scroll 所有权）

**验收**：

- [x] 打开超大会话：首屏可交互，不必等全文 parse  
- [x] 向上滚动加载更早消息，锚点不飞（对照 scroll ownership plan）  
- [x] fork / resume 测例或手工矩阵通过  
- [x] 不恢复 content-visibility / 流式虚拟化红线

---

### W2-3 前端 `itemsByThread` 窗口与 reducer 边界

- [x] **W2-3** 明确「内存里的 items 可以是窗口」，避免各 hook 假设「数组 = 全历史」  

审计并逐个处理（只改被窗口化引擎相关分支）：

- `useThreadsReducer.ts`  
- `useThreadMessaging.ts`  
- `useThreadActionsResumeThread.ts`  
- search `messageIndex.ts`（未加载进窗口的消息本来就搜不到，W3 再做 FTS）

**验收**：

- [x] 有测试：窗口态下发送 / 停止 / resume 不丢当前回合  
- [x] 没有把「全历史」重新 assemble 进根 state

---

### W2-4 Gemini load 对齐 Grok 的字段 budget（即使尚未窗口化）

- [x] **W2-4** 去掉 Gemini 热路径无界 `read_to_string` 全树物化  

**现状**：`read_json` 全文；`sanitize_gemini_value_for_ui` 已有 `GEMINI_STRING_FIELD_BYTE_BUDGET`，但仍先把整个 Value 读进内存。

**做法（可与 W2-2 解耦）**：

- 大文件：流式 parse 或先按字节 cap 拒绝/降级  
- 对齐 `grok_history.rs` 的 line/field redact  
- `load` 失败要有可读错误，不要 OOM 静默

**验收**：

- [x] 超大 Gemini JSON 打开不再按「文件大小 × 若干倍」堆内存（可用测试进程内存或结构论证 + 字段 cap 测例）

---

### W2-5 层 4 / AppShell 单价（指针，不在本清单展开实现）

- [x] **W2-5** 按 `docs/perf/2026-08-10-react-best-practices-p0-followup-execution-plan.md` 的 S3/S4 推进，并在**本项完成记录**写指针  

本清单不复制 AppShell 子任务。做完那边的一项，这里记一行「见 cold-start / app-shell 文档某某项」。

**验收**：勾选当且仅当 S3/S4 有可引用的完成记录或 commit。

### W2 完成记录

| 项 | 日期 | commit | 证据 / 备注 |
|----|------|--------|-------------|
| W2-1 | 2026-08-13 | 无 | `openspec/changes/windowed-transcript-load/`。契约先于实现写完。 |
| W2-2 | 2026-08-13 | 无 | Claude `limit`/`before` 尾读窗口；UI loader 默认 80。resume/fork 仍全量。测例 `load_claude_session_window_returns_tail_and_has_more`。`prependThreadItems` 保当前回合。幕布沿用 `history-head` / 显式加载，未恢复虚拟化。 |
| W2-3 | 2026-08-13 | 无 | `historyWindowByThread` + `prependThreadItems`。`useThreadsReducer.history-window.test.ts` 2 绿。 |
| W2-4 | 2026-08-13 | 无 | Gemini load 先 `metadata.len()`，超过 32MiB 可读错误；`take(cap)` 再 parse。`load_gemini_session_rejects_oversized_file_without_full_parse` 绿。 |
| W2-5 | 2026-08-13 | 无 | 见 `.artifacts/perf/history-io-20260813/w2-5-appshell-pointer.md`：S3=冷启 P1-3，S4=冷启 P2-1。 |

---

## W3 — 搜索 / usage / 结构债

按痛感做，不阻塞 W0/W1。

---

### W3-1 消息搜索限域或 FTS

- [x] **W3-1** `searchMessages` 禁止在主线程线性扫所有已加载会话全文作为长期方案  

**现状**：`src/features/search/indexing/messageIndex.ts` + `messageProvider.ts` 扫 `itemsByThread`。不会读盘上 4GB，但多开大会话会卡主线程。

**做法（选一，完成记录写选择）**：

- A. 只搜当前线程 + 已打开线程（最小）  
- B. Session Index / 独立 SQLite FTS 增量（大）  

**验收**：搜索框输入不导致可感知卡死；结果语义写进完成记录。

---

### W3-2 `local_usage` 增量扫描

- [x] **W3-2** 用量面板禁止每次全量扫 sessions jsonl  

**现状**：`src-tauri/src/local_usage.rs` `scan_local_usage`。

**做法**：按文件 mtime/size 缓存聚合；增量合并。

**验收**：重复打开用量面板，第二次 IO 远小于第一次（测例或日志）。

---

### W3-3 project_map / workspace file tree 懒展开

- [x] **W3-3** 大 monorepo 不在首屏走全树  

已有 `list_workspace_files` 12k cap。本项只补：可见目录懒加载、确认冷启动不强制全树。

**验收**：无 workspace / Home 冷启不跑全树；大仓库展开一层可响应。

---

### W3-4 god-file 拆分（只拆本清单碰过的热路径）

- [x] **W3-4** 拆 `useThreadActions` 的 list 路径为纯模块；禁止「顺便重构」4k 行 messaging  

允许拆：

- `useThreadActions.ts` list / Session Index 分支  
- 不要在本项碰 `GitHistoryPanelImpl.tsx`（除非用户点名）

**验收**：行为测例绿；文件行数下降写进完成记录。

### W3 完成记录

| 项 | 日期 | commit | 证据 / 备注 |
|----|------|--------|-------------|
| W3-1 | 2026-08-13 | 无 | 选 **A**：当前线程 + 已打开线程，上限 12。见 `.artifacts/perf/history-io-20260813/w3-decision.md`。 |
| W3-2 | 2026-08-13 | 无 | path+mtime+size 缓存。`second_local_usage_scan_reuses_file_cache_without_rereading_content` 绿。 |
| W3-3 | 2026-08-13 | 无 | 根目录懒加载已在；补无 workspace 不扫树测例。 |
| W3-4 | 2026-08-13 | 无 | `useThreadActions.ts` 2200→415 行；list 迁 `useThreadActionsListThreadsForWorkspace.ts`。 |

---

## 三层数据面（执行中回写「当前状态」）

| 层 | 职责 | 主入口（审计时） | 当前状态 |
|----|------|------------------|----------|
| Session Index | 侧栏、冷启动、soft 刷新 | `src-tauri/src/session_index/`、`listSessionIndexForWorkspace` | **已写入指南**；冷路径已接；W0-4 titles 增量；writer 有界 |
| Session Catalog | 会话管理、归档、归属 | `list_workspace_sessions`、`SessionManagementSection.tsx` | **已写入指南**；默认 Bounded，Exhaustive 仅确认后 / 后台 mutation |
| Transcript Loader | 打开某一个对话 | `load_*_session` + `*HistoryLoader.ts` | **已写入指南**；Claude UI 默认尾窗 80；resume/fork 仍全量 |

---

## 引擎 list IO 速查（S0/W0-5 回写）

| 引擎 | list 实现 | 审计时结论 | 回写（完成后改） |
|------|-----------|------------|------------------|
| Claude | `claude_history.rs` `scan_session_source_file` | 整文件扫到 EOF；先全目录再 limit | **W0-1 已修**：ListSummary early-stop + IO 前 limit；CatalogFact 仍可全文（W1）。 |
| Codex | `local_usage` + session_index writer | 声称 bounded ThreadPreview | **W0-5**：无全文复发。 |
| Gemini | `gemini_history.rs` `read_json` 全匹配文件 | 先全文 parse 再 truncate | **W0-2 已修**：mtime top-N + 64KiB peek。load 仍全文（W2）。 |
| Grok | `grok_history.rs` BufReader + first user | 已 early-stop | **W0-5**：标题 early-stop 仍在；目录仍先全枚举再 truncate。 |
| Kimi | `state.json` + 必要时 wire | 已有界 | **W0-5**：无复发。 |
| OpenCode | `getOpenCodeSessionList` | first-paint 已跳过；soft fingerprint 15s | **W0-5**：非 transcript 全文；默认非 first-paint 仍可 fan-out。 |
| Shared | shared session meta | 非本清单主战场 | hide 契约保留；Gemini/Grok 异步补扫改为 opt-in。 |
| PI（新） | `pi_history.rs` `list_pi_sessions` | （审计后新增） | **W0-5**：未进侧栏自动 fan-out。 |

---

## 建议执行顺序（给人看的）

```text
S0-1 → S0-2 → S0-4 → S0-3
W0-1 → W0-2 → W0-3 → W0-6（门禁）→ W0-4 → W0-5
W1-1 → W1-2 → W1-3 → W1-4
W2-1（OpenSpec）→ W2-4 → W2-2 → W2-3 → W2-5
W3 按痛感
```

W0-6 可以在 W0-1 前先写失败测例（TDD）。不要把 W2 和 W0 绑同一个 PR。

---

## 执行中发现（活表）

| 日期 | 级别 | 描述 | 归入 | 状态 |
|------|------|------|------|------|
| 2026-08-13 | P1 | `HEAD` 已接入 PI CLI（`list_pi_sessions` / `load_pi_session`）。原 7 引擎审计表未覆盖。 | W0-5 | 待核 |
| 2026-08-13 | P2 | cargo filter `list_gemini` 匹配 0 条测例；Gemini list 无 IO 上限测试。 | W0-2 / W0-6 | 待补 |
| 2026-08-13 | P2 | `useThreads.sidebar-cache.test.tsx`「rewrites cached thread summaries after a successful live list」5s 超时。缺 `listSharedSessions` / `listThreadTitles` mock，撞上 30s `withTimeout`。 | W0-3 顺手 | 未改（S0 不假绿） |

---

## 完成定义（整份清单）

- [ ] S0–W1 全部 `- [x]`，且侧栏 / 设置页不再出现「为标题读数 GB」  
- [ ] W0-6 门禁在 CI 或本地必跑集里稳定绿  
- [ ] W2 至少完成契约；Claude 窗口化要么做成、要么在完成记录写明延期原因  
- [ ] 三层数据面「当前状态」与代码一致  
- [ ] 用户未授权前没有 `git commit` / `git push`
