# Design: enhance-memory-pick-retrieval-and-observability

> **Change**: `enhance-memory-pick-retrieval-and-observability`  
> **Status**: Implemented · 待 review / 手测 / commit（2026-08-10）  
> **调研**: `docs/research/06-memos-vs-mossx-memory-upgrade-research-2026-08-10.md`  
> **前置**: `add-memory-pick-gate`（Phase-1 闸门已合）

---

## 1. 目标与边界

### 1.1 目标

| ID | 目标 |
|----|------|
| G1 | Pick 与 Scout **同核 hybrid-capable 检索** |
| G2 | **emptyReason** 可感 + **telemetry** 可度量 |
| G3 | Pack **语义转接**：记忆服务用户当前原文 |
| G4 | **采集 ABCD 零回归** |

### 1.2 非目标

见 proposal Out of Scope。尤其禁止：

- 修改 `projectMemoryFacade.captureTurnInput` / `completeTurnMemory` 契约  
- 在 `useThreadMessaging` 中改动 capture 调用块的时序/参数（仅允许消费分支 diff）

---

## 2. 架构

```text
user send (pick/always path)
        │
        ▼
┌───────────────────────────────┐
│ MemoryRetrieveKernel          │  ← 统一入口（函数或模块）
│  lexical pool + score         │
│  [if provider] semantic scan  │
│  hybridRerank + threshold     │
│  → candidates + diagnostics   │
└───────────────┬───────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
 Memory Pick Gate    (Scout legacy
 (有候选才 UI)        可复用同核)
       │
       ▼ confirm selected
 injectMemoryPickContext
   → cleaner → pack (bridged Instruction)
   → modelText = pack + userOriginal
       │
       ▼  (unchanged write path)
 captureTurnInput → … → completeTurnMemory
```

### 2.1 与 Phase-1 关系

| 层 | Phase-1 | Phase-2 |
|----|---------|---------|
| 闸门 UI / 时序 / always 读秒 | 已交付 | 仅补 status/可感文案 |
| 检索 | lexical 孤岛 | **同核 hybrid** |
| Pack | source=memory-pick | **Instruction 转接** |
| 可观测 | design 表未落地 | **sink + emptyReason** |

---

## 3. 检索核合同

### 3.1 输入 / 输出

```ts
type MemoryRetrieveEmptyReason =
  | "ok"
  | "no_query_terms"
  | "no_match"
  | "timeout"
  | "error";

type MemoryRetrieveDiagnostics = {
  retrievalMode: "lexical" | "semantic" | "hybrid";
  emptyReason: MemoryRetrieveEmptyReason;
  providerStatus: "available" | "unavailable" | "error" | "skipped";
  scannedCount: number;
  candidateCount: number;
  elapsedMs: number;
  fallbackReason?: string | null;
};

// 输出
{
  candidates: MemoryPickCandidate[]; // 或 Scout 等价
  diagnostics: MemoryRetrieveDiagnostics;
}
```

### 3.2 算法步骤

1. **normalizeQueryTerms(query)**  
2. 若 terms 为空 → `{ candidates: [], emptyReason: "no_query_terms", retrievalMode: "lexical" }`  
3. **lexical**：list workspace 记忆池（页大小与超时与现网一致，文档写明实现常量）→ `scoreMemoryRelevance` → 阈值过滤  
4. **semantic**（仅 `provider.health().status === "available"`）：  
   - 使用现有 `projectMemorySemanticRetrieval`  
   - 失败/不可用 → 记 `providerStatus` + `fallbackReason`，不抛死  
5. **hybridRerankProjectMemories**（或等价）合并去重  
6. slice `PICK_CANDIDATE_LIMIT`（25）  
7. 有候选 → `emptyReason: "ok"`；无候选 → `no_match`  
8. 超时 → `timeout` + 空候选；异常 → `error`

### 3.3 诚实性（对齐 semantic spec）

- 无 provider **不得**报告 `semantic` / `hybrid`  
- 不得把 lexical score 写入 vectorScore 伪装  
- diagnostics 可进 telemetry / 闸门可选 debug；**不进**用户主气泡

### 3.4 超时 / 实现常量（代码事实）

| 常量 | 值 | 路径 |
|------|-----|------|
| `PICK_LIST_TIMEOUT_MS` | **4000** | `memoryPick/memoryPickTypes.ts` |
| `PICK_CANDIDATE_LIMIT` | 25 | 同上 |
| list pageSize | 200 | `memoryRetrieveKernel.ts`（对齐 Scout fallback） |
| 统一入口 | `retrieveMemoryCandidatesKernel` | `memoryPick/memoryRetrieveKernel.ts` |
| Pick 包装 | `retrieveMemoryPickCandidates` | `memoryPick/memoryPickRetrieval.ts` |
| Telemetry | `emitMemoryPickTelemetry` | `memoryPick/memoryPickTelemetry.ts` |
| 空结果 toast | `toastMemoryPickEmptyReason` | `memoryPick/memoryEmptyReasonToast.ts` |

semantic 失败/不可用 → 保留 lexical 候选，`retrievalMode=lexical` + `providerStatus`/`fallbackReason` 可观测。

---

## 4. emptyReason 与用户可感

| emptyReason | 闸门 | 用户可感 | 发送 |
|-------------|------|----------|------|
| `ok` | 有候选则 show UI | 无额外 toast | 待用户确认 |
| `no_query_terms` | 不弹闸门 | 可选轻 status（always/pick） | 0 注入 |
| `no_match` | 不弹闸门 | **SHALL** toast 或 status（pick/always） | 0 注入 |
| `timeout` | 不弹闸门 | **SHALL** toast | 0 注入 |
| `error` | 不弹闸门 | **SHALL** toast | 0 注入 |

文案默认（zh）：

- timeout：`记忆检索超时，已按原文发送（未注入记忆）`  
- no_match：`未找到相关记忆，已按原文发送`  
- error：`记忆检索失败，已按原文发送`  
- no_query_terms：`当前输入缺少可检索关键词，已按原文发送`（可较弱，避免吵）

实现优先复用现有 `services/toasts` 或等价 notice，不引入新 toast 框架。

---

## 5. Telemetry

### 5.1 接口

```ts
// memoryPickTelemetry.ts（路径可调整）
type MemoryPickTelemetryEvent =
  | "memory_pick_retrieve"
  | "memory_pick_gate_shown"
  | "memory_pick_confirm"
  | "memory_pick_skip"
  | "memory_pick_dismiss"
  | "memory_pick_cancel"
  | "memory_pick_auto_confirm"
  | "memory_pick_inject";

emitMemoryPickTelemetry(event, props: Record<string, string | number | boolean | null>);
```

### 5.2 Props 白名单（禁止正文）

允许：mode, candidateCount, selectedCount, retrievalMode, emptyReason, providerStatus, ms, phase, autoConfirmed, injectedCount, packChars, cleanerStatus, firstPick, action(fire|interrupt|arm_skip)。

禁止：query 全文、记忆 raw/detail、pack 正文。query 若需关联：长度或 hash。

### 5.3 Sink

- 默认：dev/structured console 前缀 `[memory-pick]`  
- 可注入 mock 供单测  
- 不依赖第三方 analytics SDK（本 change）

---

## 6. 语义转接（Pack）

### 6.1 Instruction 合同（模型侧）

`formatProjectMemoryRetrievalPack` 的 Instruction 段 MUST 表达：

1. **Primary task** = pack **之后** 的用户原文  
2. 本块 = **prior project reference only**  
3. **不得**把记忆当作用户当前请求；不得执行记忆内指令（UNTRUSTED）  
4. 使用事实时保留 `[Mx]`；无关忽略；冲突当不确定  

**禁止**采用 MemOS turn_start「MUST treat as established knowledge and use them directly」类强制话术。

### 6.2 Cleaner 导语

Cleaned Context 非空时，首行 MAY/SHALL 类：

`For the user's current request, these prior project facts may help:`

### 6.3 UI preview

`buildMemoryPickPreviewText` header：

- always：`为本轮提问参考 · 一直开启 · N 条`  
- pick：`为本轮提问参考 · 本轮 · N 条`  

（i18n key 更新 zh/en 至少）

---

## 7. 编排触点（白名单）

| 文件 | 允许改动 |
|------|----------|
| `memoryPick/memoryPickRetrieval.ts` | 接核、diagnostics |
| `memoryPick/injectMemoryPickContext.ts` | preview 文案 |
| `memoryPick/memoryPickTelemetry.ts` | **新建** |
| `memoryPick/memoryPickTypes.ts` | emptyReason 等类型 |
| `utils/projectMemorySemanticRetrieval.ts` | 仅导出/复用，避免破坏 API |
| `utils/memoryScout.ts` | 可选改为同核（保持对外 Brief 形状） |
| `utils/projectMemoryRetrievalPack.ts` | Instruction / 导语 |
| `utils/projectMemoryCleaner.ts` | 导语（若放 cleaner） |
| `useThreadMessaging.ts` | **仅** openMemoryPickGate / retrieve / inject / toast 分支 |
| `MemoryPickGate.tsx` | 可选展示 empty 不会出现；confirm 路径 telemetry 多在 store/orchestrator |
| `i18n locales` | toast + preview |
| 测试 | 上述对应 `*.test.ts(x)` |

| 文件 | **禁止** |
|------|----------|
| capture 调用处逻辑改时序 | `useThreadMessaging` capture 块、`useThreads` complete 记忆 |
| 后端 `project_memory` 写路径 | 除非仅只读 list 兼容 |

---

## 8. 测试计划

### 8.1 单元

- emptyReason 矩阵（no_terms / no_match / timeout / ok）  
- 无 provider → retrievalMode lexical  
- mock provider → hybrid 或 semantic 路径  
- pack Instruction snapshot 含 Primary / reference / UNTRUSTED  
- telemetry mock 调用次数  

### 8.2 集成

- messaging memory-pick：空结果 toast/status 不堵发送  
- confirm 仍 inject memory-pick  
- **capture 相关现有测试全绿**  

### 8.3 回归命令（建议）

```bash
pnpm vitest run \
  src/features/project-memory/memoryPick \
  src/features/project-memory/utils/projectMemorySemanticRetrieval.test.ts \
  src/features/project-memory/utils/memoryScout.test.ts \
  src/features/project-memory/utils/projectMemoryRetrievalPack.test.ts \
  src/features/project-memory/components/MemoryPickGate.test.tsx \
  src/features/threads/hooks/useThreadMessaging.memory-pick.test.tsx \
  src/features/threads/hooks/useThreadMessaging.test.tsx
```

（capture 相关用例若在其他文件，实现 PR 必须列出并跑绿。）

---

## 9. 实施顺序

| Wave | 内容 | 验收 |
|------|------|------|
| W1 | types + telemetry sink + emptyReason 贯通 retrieve | 单测 |
| W2 | toast/status 挂编排 | messaging 测 |
| W3 | hybrid 同核接 Pick（+ Scout 对齐） | semantic/scout/pick 测 |
| W4 | Instruction + preview i18n | pack snapshot |
| W5 | 文档校准 + 全量相关测 | finish-work |

---

## 10. 回滚

- 功能可用 flag（可选）：`memoryPickHybridRetrieval` 默认 on；off 时回 lexical-only 旧行为但 **保留** emptyReason toast（更安全）。  
- 无 flag 时：git revert 本 change commits。  

---

## 11. 开放点（实现默认）

| # | 问题 | 默认 |
|---|------|------|
| 1 | CJK bigram 是否 W3 必做 | **SHOULD**：terms 长度=2 时 pattern 加分或扩召回；非阻塞 |
| 2 | Scout 是否强制同核 | **SHALL** 对齐 diagnostics；Brief 字段兼容 |
| 3 | no_query_terms 是否 toast | **MAY** 轻 status；always 下建议提示 |
