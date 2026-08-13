# Proposal: enhance-memory-pick-phase3-habit-and-semantic

## Why

Phase-1/2 已让记忆消费 **可见、可勾、可感、语义转接正确**，但日常使用仍有两道坎：

1. **Hybrid 名存实亡**  
   检索核与合同已支持 semantic/hybrid，但生产环境通常 **没有可用 embedding provider + 持久 index**，用户体感仍接近纯词面。  
   → 「匹配质量」的产品价值卡在最后一公里。

2. **习惯留不住**  
   `composerMode` / `dismissed` / `firstPickRequired` / `alwaysPreferredCount` 仍偏 **内存 session**。  
   刷新 / 重开客户端后：always 意图、dismiss 静音、preferred n 易丢。  
   → 用户不敢养成「一直开」或「本 session 不再提示」的习惯。

Phase-3 不扩花活，只补 **真可用语义** 与 **习惯持久化**。

## 现状快照（P2 已完成后）

| 能力 | 状态 |
|------|------|
| 闸门 UI / 时序 / always 读秒 arm | ✅ |
| 统一检索核 + emptyReason 时间线 + telemetry | ✅ |
| Pack Instruction 转接（Primary / UNTRUSTED） | ✅ |
| 生产 embedding provider | ❌ 接口有、未接线 |
| 本地 embedding index 持久化 | ❌ 或未默认启用 |
| session policy 持久化 | ❌ 内存 |
| dismiss 恢复入口 | ❌ |
| 采集后异步建索引 | ❌ |
| P2 delta sync 主 specs | ❌ 可选 |

## What Changes（In Scope）

### A. 生产语义检索可用（P0）——**方案 A 已拍板**

1. **方案 A only**：应用内嵌或应用管理的本地小模型 embedding；**禁止**把 Ollama/云 API/用户自装运行时当作默认或必选路径。  
2. 实现 `ProjectMemoryEmbeddingProvider` 生产实例 + 真实 health（模型未就绪 = unavailable → lexical）。  
3. **持久 index**（按 workspace 隔离）：读写 index 记录；**不替换** JSON 主记忆库。  
4. Pick / Scout 检索路径注入该 provider（available 时 hybrid）。  
5. 模型下载/加载失败：静默回退 lexical，发送不堵；可提示「语义索引暂不可用，已用关键词匹配」类（可选，勿强迫安装）。  
6. **闸门匹配最短展示 1s 保持不变**（`PICK_MATCH_MIN_DISPLAY_MS`）；不得为「检索变快」而缩短该产品动画/状态时长。

### B. Session 习惯持久化（P0）

1. 持久化字段（至少）：  
   - `composerMode`: off \| pick \| always  
   - `dismissed`  
   - `firstPickRequired`  
   - `alwaysPreferredCount`  
2. 作用域：建议 **workspace + thread**（与现 session store 键一致）。  
3. 刷新 / 重开后恢复；与 Composer 菜单、闸门 setMode **双向一致**。

### C. Dismiss 可恢复（P1）

1. Composer 记忆参考菜单：dismissed 时可见 **重新开启**（恢复 pick 或 always，清 dismissed）。  
2. 不得要求用户清 localStorage / 换 thread 才能恢复。

### D. 异步索引旁路（P1，采集零回归）

1. 记忆 create/update/complete 成功后，**异步**更新 embedding index。  
2. 失败仅记 telemetry / 诊断，**不得**阻塞或回滚 capture/complete。  
3. 首次启用可提供 **后台全量 rebuild**（可取消、可进度，非阻塞 UI）。

### E. 治理（P2）

1. 将 P2 delta sync 进主 `openspec/specs/project-memory-*`（可本 change 顺手或独立 chore）。  
2. 文档：`05`/`06` 指针指向 P3；`add-memory-pick-gate` design 阶段表更新。

## Out of Scope

| 不做 | 原因 |
|------|------|
| 改 capture 同步语义 / ABCD 时序 | 采集正确性铁律 |
| MemOS 全栈 / 图库 / L2L3 | 过重 |
| 默认 LLM rewrite / filter | 延迟成本 |
| 设置页调 n/超时 / feature flag UI | P4 |
| 「不相关」负反馈闭环 | P4 |
| collab worker 独立 Pick | 非主路径 |

## 验收标准（Phase-3）

1. **有可用 provider 的构建/环境**：同一批记忆 + 模糊同义 query，`retrievalMode` 可为 `hybrid`/`semantic`，且候选优于纯 lexical 的至少一组 golden（fixture）。  
2. **无 provider**：仍 lexical，发送不堵，diagnostics 诚实。  
3. always / dismiss / preferredCount：**杀进程重开**后仍保持。  
4. dismissed 后可从 Composer **一键恢复**闸门/记忆参考。  
5. completeTurn 后索引异步更新：**不增加** capture 失败率；断网/embed 失败不抛到用户发送路径。  
6. 回归：P1 闸门 + P2 emptyReason 时间线 + Instruction 转接 + 采集测试仍绿。

## 风险

| 风险 | 缓解 |
|------|------|
| 本地 embed 包体/性能 | 默认 off 或按需下载；health 失败回 lexical；索引批量限流 |
| 持久化键冲突 / 串 workspace | 键含 workspaceId+threadId；迁移单测 |
| 异步索引与删除竞态 | index 删跟随 memory delete；stale contentHash 重建 |
| 用户以为 always 静默 | 持久化 **不改变**「每轮仍 show-ui」合同 |

## 拍板点（已确认 · 2026-08-10）

| # | 问题 | **已拍板** |
|---|------|------------|
| 1 | embedding 方案 | **方案 A：应用内嵌 / 随包或应用内首次拉取小模型**；**禁止**要求用户独立安装 Ollama/其它软件；不可用则 lexical |
| 2 | 用户额外安装 | **一定不要**；无独立依赖 |
| 3 | 匹配 UI 最短展示 | **`PICK_MATCH_MIN_DISPLAY_MS = 1000` 产品故意设计，禁止缩短**（与检索快慢无关） |
| 4 | 持久化介质 | 与现有 client 设置同族（localStorage / tauri store / settings——实现时写死路径） |
| 5 | 旧 thread 无持久化记录 | firstPick 规则与今一致；mode 默认 off 或读 Composer 当前值 |
| 6 | 全量 rebuild 触发 | 首次 provider available 时后台跑（可取消，不挡发送） |
| 7 | dismiss 恢复默认 mode | **pick**（避免一恢复就 always 读秒） |

## 非目标用户故事（避免范围膨胀）

- 「帮我训练记忆排序」  
- 「跨 workspace 共享记忆向量库」  
- 「云端 MemOS 同步」
