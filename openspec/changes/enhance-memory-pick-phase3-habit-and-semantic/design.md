# Design: enhance-memory-pick-phase3-habit-and-semantic

> **Change**: `enhance-memory-pick-phase3-habit-and-semantic`  
> **Status**: **实现已落地（Rust ONNX Runtime 已接线；模型文件需执行 `scripts/download-embed-model.sh` 下载）**  
> **前置**: Phase-1 闸门 · Phase-2 `memoryRetrieveKernel` + telemetry + Instruction  
> **硬约束**: 方案 A 零外置安装；JSON 主库不换；`PICK_MATCH_MIN_DISPLAY_MS=1000` **禁止缩短**

---

## 0. 定稿一览（按你的要求直接定死）

| 主题 | **就这么做** |
|------|----------------|
| 解决什么 | **查得更准**（同义/换说法）；不是换库、不是为了砍匹配 1s |
| 主存储 | **继续现有 JSON 记忆**；向量是旁路 index |
| Embedding | **应用内 ONNX 小模型，运行时按需下载到 `~/.ccgui/models/embedding/`**（~91MB） |
| 用户安装 | **零**。禁止 Ollama / 自装 runtime / 必选云 Key。首次语义搜索显示「下载本地语义模型」入口 |
| 模型失败 | health=unavailable + downloadable=true → 显示下载入口；失败时 **lexical**，记忆照常用 |
| Session 持久化 | **localStorage**，键见 §4 |
| dismiss 恢复 | Composer「恢复记忆参考」→ **mode=pick** |
| 索引时机 | create/update/complete/delete 成功后 **异步队列**；失败不挡采集 |
| 匹配 1s | 产品展示，**与检索快慢解耦，禁止改小 1000** |
| 实现顺序 | **W1 持久化+恢复 → W2/W3 模型与索引 → W4 异步建索引 → W5 回归** |

---

## 1. 目标

| ID | 目标 |
|----|------|
| G1 | 生产 hybrid **默认可达**（随包模型 + index；失败 lexical） |
| G2 | session 习惯 **刷新仍在** |
| G3 | dismiss **可恢复**（默认 pick） |
| G4 | 索引旁路 **零回归采集** |
| G5 | 匹配 UI **最短 1s 不变** |

---

## 2. 架构

```text
【主数据·不变】
  project-memory JSON（workspace 隔离）     ← 真相源 / 注入正文

【旁路·P3】
  ~/.ccgui/models/embedding/               ← 运行时下载（~91MB · 用户触发）
  {workspace}/embed-index.v1.json          ← 向量索引 sidecar

  complete/create/update 成功 ──enqueue──► EmbeddingIndexWorker（并发 1）
                                              │
                                              ▼ ort infer → 写 index

  send → matching UI 至少 1000ms ──► memoryRetrieveKernel
              │                         ├── lexical
              │                         └── provider+index → hybrid
              ▼
         Pick Gate / inject（P1/P2）

  memoryPickSessionStore ↔ localStorage
  Composer：dismissed → 恢复 → pick
```

---

## 3. Embedding（方案 A 定稿）

### 3.1 问题定位

- **主：准**（语义近邻、少噪声/漏召）。  
- **非：慢**。慢靠超时与候选上限；matching **1s 是产品态**。

### 3.2 运行时

| 层 | 定稿 |
|----|------|
| 推理 | **Rust/Tauri** 用 ONNX Runtime（`ort`）在 invoke 命令里跑；WebView **不**跑重模型 |
| 前端 | `ProjectMemoryEmbeddingProvider` 生产实现 = 调 `project_memory_embed_*` |
| 模型文件 | **运行时按需下载到 `~/.ccgui/models/embedding/`**（~91MB），不打包进安装包 |
| 模型下载 | 用户记忆参考菜单 →「下载本地语义模型」→ Rust `reqwest` 流式下载，进度事件推送前端 |
| 模型级别 | all-MiniLM-L6-v2（384维 · ~90MB ONNX + 0.5MB tokenizer · 中英文可用） |
| 版本号 | `embeddingVersion = "memory-embed-v1"`；换模型必须 bump + 全量 rebuild |
| health | 资源缺失 → `unavailable` + `downloadable=true`；**禁止**引导用户去装第三方软件 |
| 开发/CI | 无模型文件 → 自动 lexical；开发者可跑 `bash scripts/download-embed-model.sh` 预下载 |

**2026-08-10 变更**：从「随包装进安装包」改为「运行时按需下载到 `~/.ccgui/models/embedding/`」，避免安装包增大 ~91MB。

### 3.3 索引

| 项 | 定稿 |
|----|------|
| 路径 | 各 workspace 记忆目录下 **`embed-index.v1.json`** |
| 行字段 | `memoryId, vector, contentHash, embeddingVersion, memoryUpdatedAt, indexedAt` |
| 检索 | 加载 index → exact cosine topK（P3 不上独立向量库） |
| index 空 | **跳过 semantic**，`retrievalMode=lexical` |
| 删除记忆 | 同步删 index 行 |

### 3.4 与检索 / 1s 展示

- kernel：provider available 且 index 非空才走 semantic 分支，再 hybridRerank。  
- `PICK_MATCH_MIN_DISPLAY_MS = 1000`：**检索 0ms 完成也要等满 1s** 再 awaiting/auto-skip。  
- 实现点：`memoryPickGateStore.settleAfterMinDisplay`；P3 **禁止**改小该常量。

### 3.5 Worker

| 规则 | 定稿 |
|------|------|
| 触发 | create/update/**complete**/delete 成功后 enqueue（**capture 输入确权可不 embed**） |
| 并发 | **1** |
| 失败 | telemetry + log；不 throw 到发送/采集返回值 |
| version 变更 | 启动后 idle **后台** rebuild |

---

## 4. Session 持久化（定稿）

```ts
type PersistedMemoryPickSessionPolicy = {
  v: 1;
  workspaceId: string;
  threadId: string;
  composerMode: "off" | "pick" | "always";
  dismissed: boolean;
  firstPickRequired: boolean;
  alwaysPreferredCount: number;
  updatedAt: number;
};
```

| 项 | 定稿 |
|----|------|
| 介质 | **localStorage**（对齐 `manualInjectionMode`） |
| Key | `mossx.memoryPick.session.v1:${workspaceId}:${threadId}` |
| 写 | policy 变更即 persist |
| 读 | 内存 miss 时 hydrate |
| 不存 | 闸门临时 selectedIds / phase |

---

## 5. Dismiss 恢复（定稿）

| 项 | 定稿 |
|----|------|
| 入口 | Composer 记忆参考菜单：**恢复记忆参考** |
| 结果 | `dismissed=false`，`composerMode="pick"`，`firstPickRequired=false` |
| 不恢复 always | **是**（防一恢复就读秒） |

---

## 6. 波次（定稿）

| Wave | 内容 |
|------|------|
| **W1** | localStorage session + Composer 恢复（无模型，可先上） |
| **W2** | Tauri ONNX + 随包模型 + embed 命令 + 前端 provider |
| **W3** | `embed-index.v1.json` + kernel/scout 接线 hybrid |
| **W4** | 异步索引 worker + version rebuild |
| **W5** | 测试（含 MIN_DISPLAY≥1000）+ 文档 + commit |

---

## 7. 触点

| 区域 | 路径方向 |
|------|----------|
| Session | `memoryPickSessionStore.ts` + `memoryPickSessionPersist.ts` |
| Composer | `ButtonArea.tsx` 记忆菜单 |
| Kernel / Scout | 注入 bundled provider + index |
| Tauri | `project_memory_embed` 模块 + resources 模型 |
| Index | workspace 下 `embed-index.v1.json` |
| Worker | complete 等成功路径 **仅 enqueue** |
| 常量 | `PICK_MATCH_MIN_DISPLAY_MS` **只读不改小** |

---

## 8. 测试

1. persist always/dismiss roundtrip  
2. restore → pick，再发送可 show-ui  
3. 无 onnx → lexical，无「请安装」文案  
4. mock available + index → hybrid  
5. complete 后 enqueue；embed fail 不影响 complete  
6. retrieve 立即返回时仍 ≥1000ms 再 settle  
7. P1/P2 回归  

---

## 9. 与 P2

| P2 | P3 |
|----|-----|
| kernel 算法 | **真**随包 provider + 磁盘 index |
| emptyReason 时间线 | 不变 |
| Instruction 转接 | 不变 |
| 内存 session | **localStorage** |
| 匹配 1s | **冻结不得缩短** |
