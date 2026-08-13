# 冷启 / Cmd+R 假死 · 全流程收口报告（2026-08-11）

| 项 | 值 |
|----|-----|
| 日期 | 2026-08-11 |
| 分支 | `bump-version-0.8.7` |
| 平台验收 | **Mac** 全程不卡；Win 本轮未用生产形态复测 |
| 止血提交 | `d21e1b989` `fix(composer): 冷启延迟挂载完整 Composer，消除 Cmd+R 猛点假死` |
| 根治+UX | 工作区后续：`ComposerGate` + `ComposerLight` + 模型位 loading（见本文 §5） |
| 详细二分日志 | [`cold-start-action-bisect-checklist-2026-08-11.md`](./cold-start-action-bisect-checklist-2026-08-11.md) |
| 截图证据 | [`cold-start-bisect-2026-08-11/screenshots/`](./cold-start-bisect-2026-08-11/screenshots/) |
| 证据包索引 | [`cold-start-bisect-2026-08-11/README.md`](./cold-start-bisect-2026-08-11/README.md) |

---

## 1. 问题定义

### 1.1 用户可感现象

- 开发者模式启动后 **Cmd+R 硬刷新**，**立刻猛点**侧栏 / 设置 / 输入区 → **整窗假死**（可点无响应，需等很久或重开）。
- 切工作区、点会话、会话列表转圈期间，也曾出现整窗不可点。
- 与「仅掉帧」不同：是 **主线程被占满导致 hit-test / 输入长期无响应**。

### 1.2 历史脉络（联调前）

| 阶段 | 内容 | 结果 |
|------|------|------|
| 2026-08-05～07 | uiScale / WebView2 二分（见 `windows-ccgui-startup-hang-2026-08-05.md` 等） | 缩放路径部分收敛 |
| 2026-08-08 | 切工作区 full-catalog / projection 9999 | 列表与 projection 减负 |
| 2026-08-10 | postmortem 四条因果链、platform-split | 文档化，假死仍可复现 |
| 本轮前尝试 | `StartupInteractionShield` 透明层 | **错误方向，已回退** |
| 本轮前尝试 | list first-paint 滞后 / quiet 门控 / restore 同 tick 修复 | **仍卡** → 说明 list 不是唯一根因 |

---

## 2. 方法论：分层二分（只看 App 现象）

### 2.1 原则

1. **从瘦到肥**：探针 → 假壳 → 真路由 → settings/workspaces → threads → composition hooks → Zones → View → AppLayout 空槽 → 真 sidebar / messages / composer。  
2. **一次一档**，Cmd+R 后猛点，只报「卡 / 不卡」。  
3. **右上角红条**标档位（用户不看控制台）。  
4. **日志只追加**，截图入 `screenshots/`。  
5. 定位结束后 **删除全部 bisect 脚手架**，只留生产修复 + 档案文档。

### 2.2 二分关键结论表（浓缩）

| 步 | 配置 | 现象 | 结论 |
|----|------|------|------|
| 0 | ultra 探针 | **不卡** | WebView/宿主可点 |
| 1 / 4 | essentials 真 App（list/uiScale/snapshot 等关） | **卡死** | 问题在完整 App 树 |
| 2 | shell-lite 假壳 | **不卡** | 假布局 OK |
| 3 | app-lite 真 workspaces | **不卡** | 路由+list_workspaces OK |
| 5–6 | app-settings / app-workspace | **不卡** | settings、workspace host OK |
| 7 | app-threads（useThreads，无完整 UI） | **不卡** | threads 单独 OK |
| 8–10 | app-hooks / zones / view-hooks | **不卡** | composition hooks + section hooks OK |
| 11 | AppLayout 空槽 | **不卡** | 骨架 OK |
| 12 | 真 sidebar | **不卡** | |
| 13 | 真 messages | **不卡** | |
| **14** | **真 composer** | **卡死** | **composer 节点单独致卡** |
| 15 | plain Composer（无 ActiveCanvas 包） | **卡死** | 非 ActiveCanvas alone |
| 16 | **仅 ChatInputBox** | **不卡** | 输入框核心 OK |
| 17 | Composer solo | **卡死** | **Composer.tsx 本体** |
| 18 | **仅 ChatInputBoxAdapter** | **不卡** | Adapter OK |
| 21–22 | 止血 + 生产 off · Mac | **不卡** | 止血验收 |
| 根治+UX | ComposerGate + Light + 模型位 loading | **不卡 + 布局正确** | 用户确认 |

### 2.3 根因一句话

> **冷启/Cmd+R 时立即挂载完整 `Composer.tsx`（约 3.7k 行 + 多 store 订阅 + 重 effect）与用户早期点击撞主线程 → 假死。**  
> 对照：`ChatInputBox` / `ChatInputBoxAdapter` 单独挂载均不卡。

---

## 3. 止血方案（第一提交 `d21e1b989`）

### 3.1 手段

| 组件/改动 | 作用 |
|-----------|------|
| `DeferredComposerMount`（后删除，见 §4） | 先挂轻量 `ChatInputBox`，停手后再挂完整 Composer |
| list/restore quiet 调度 | 冷启 list IPC 错峰，点击 soft-cancel 进行中 list |
| home-input-ready stamp | 无 active 工作区时诚实开 gate |
| uiScale healthy rAF | 首帧少同步 localStorage |

### 3.2 关键约束（v1/v2 踩坑）

| 版本 | 错误 | 现象 |
|------|------|------|
| v1 | 把「无输入」当 quiet | 冷启几百 ms 就挂上完整 Composer → 一点就卡 |
| v2 | 4s 无人自动升级 | 「界面出来后点选择模型就卡」 |
| v3 | 禁止无人自动升级；仅「挂载后有输入且安静」才升级 | Mac 止血验收通过 |

### 3.3 体验

- 初始化数秒：轻量输入框 → 完整 Composer（**过渡可感，但不卡死**）。  
- 用户评价：Mac 全程不卡，只有几秒转换过程。

### 3.4 手工收口（脚手架）

已删除：`coldStartBisectFlags`、全部 `ColdStart*` 探针组件、AppShell/bootstrap/router 二分分支。  
保留：生产代码路径上的修复 + 本目录文档与截图 + OpenSpec list 滞后提案。

---

## 4. 根治方向（第二阶段 · 内置轻量层）

目标：缩短/取消「外层简陋壳」观感，**布局一开始就正确**，同时继续避免冷启挂满 `ComposerImpl`。

### 4.1 架构

```
useLayoutNodes.renderComposerNode
  └─ ActiveCanvasComposer
       └─ Composer (= ComposerGate)
            ├─ phase light  → ComposerLight  → ChatInputBoxAdapter（无 atomic catalog）
            └─ phase full   → ComposerImpl   （完整 hooks + 状态条等）
```

| 文件 | 职责 |
|------|------|
| `Composer.tsx` · `ComposerGate` | 轻量/完整切换；进程内 `composerHeavyWarmed`：warm 后直开 full |
| `ComposerLight.tsx` | 仅 Adapter + `sendReadiness` 占位；**不传** `onExecutionTargetChange` |
| `ComposerReadinessBar` | 无交互选择器时仍渲染**静态模型位**（引擎图标 + loading/真名） |
| `ModelSelect` | 未解析到已选模型时显示 **加载中 + 转圈**，禁止空缺后闪真名 |

### 4.2 为何 Light 不能开 atomic 模型选择

为「出模型位」曾传 `onExecutionTargetChange` → 触发 **atomic target catalog** 重路径 → **假死复现**。  
结论：轻量阶段只允许 **静态模型占位**；可交互 ModelSelect 仅在完整 `ComposerImpl`。

### 4.3 UX 细则（用户纠正后的标准）

| 要求 | 实现 |
|------|------|
| 进入页看到的应是**正确布局**，不是缺样式残缺 UI | Light 必须有 Readiness 模型位 + 模式/推理控件 |
| 模型位：先 loading，成功后**同位置替换** | 静态位 / ModelSelect 未解析态显示「加载中」 |
| 不要整区转场遮罩当重点 | 去掉「加载输入区…」整层遮罩 |
| 轻量层宽度与最终态一致 | Light 使用 `footer.composer` + `composer-shell`（`max-width: 750px`） |
| 模型与「全自动」之间不要大空洞 | readiness 工具栏改为 flex 不 `1fr` 撑开 |

### 4.4 与止血的关系

| 项 | 止血提交 | 根治后 |
|----|----------|--------|
| 外层 `DeferredComposerMount` | 有 | **删除**，逻辑进 `ComposerGate` |
| 冷启可点 | ChatInputBox 简陋壳 | Adapter 壳 + 正确工具栏结构 |
| 完整 Composer 挂载时机 | 停手后 | 停手后（warm 后直开 full） |

---

## 5. 最终生产形态（用户确认「都对了也不卡了」）

### 5.1 行为

1. **不卡死**（Mac 复测通过）。  
2. 冷启 / 开会话：工具栏 **有模型位**（先「加载中」再真模型名）。  
3. 输入框 **先宽后窄** 问题已修（Light 对齐 `.composer` max-width）。  
4. 模型位与 Mode 控件 **无大块空白**。  
5. warm 后再次进会话：尽量直开完整 Composer，减少再闪。

### 5.2 代码清单（最终应保留）

| 路径 | 说明 |
|------|------|
| `src/features/composer/components/Composer.tsx` | `ComposerGate` + `ComposerImpl` |
| `src/features/composer/components/ComposerLight.tsx` | 轻量 Adapter 路径 |
| `src/features/composer/components/ChatInputBox/ComposerReadinessBar.tsx` | 静态模型位 + loading |
| `src/features/composer/components/ChatInputBox/selectors/ModelSelect.tsx` | 未解析模型 loading 态 |
| `src/features/composer/components/ChatInputBox/styles/toolbar.css` | readiness 不 flex-grow |
| `src/features/composer/components/ChatInputBox/styles/banners.css` | readiness 布局微调 |
| `src/utils/interactiveMainThread.ts` | quiet 调度（list/restore 等） |
| `useWorkspaceThreadListHydration.ts` / `useWorkspaceRestore.ts` | list quiet 副改进 |
| 相关 tests | 随上 |

### 5.3 明确删除 / 勿回潮

- 全部 ColdStart 二分组件与 `coldStartBisectFlags`  
- 外层 `DeferredComposerMount`（逻辑已内聚到 Composer）  
- Light 路径上的 `onExecutionTargetChange` atomic catalog（会卡）

### 5.4 已知未做 / 后续可选

| 项 | 说明 |
|----|------|
| **Win 生产形态复测** | 本轮未做 |
| 进一步拆 `ComposerImpl` 内部 effect | 可缩短 light 时长或取消 light |
| list OpenSpec change | 已归档提案，可单独推进 |
| 轻量→完整时状态条等控件仍可能后出现 | 属完整层能力，非布局缺位 |

---

## 6. 经验教训

1. **先分层二分再优化**：list/uiScale 是历史主线，本轮证明 **Composer 挂载**才是 Cmd+R 猛点假死的充分条件。  
2. **「可点」与「布局正确」是两件事**：止血只保证不卡；模型位必须在同一工具栏结构内 loading→替换。  
3. **轻量层不能偷偷打开重路径**：为出 UI 而启用 atomic catalog 会把假死加回来。  
4. **CSS `1fr` / 缺 `.composer` max-width** 会造成「空白」和「先宽后窄」，与逻辑层无关，收口时要单独验。  
5. **二分脚手架必须删干净**，否则生产入口与红条会污染形态。

---

## 7. 验收清单（回归）

- [x] Mac Cmd+R 猛点不卡（止血 + 步24）  
- [x] 工具栏模型位始终存在（加载中 → 真名）  
- [x] 模型与「全自动」之间无大空洞  
- [x] 输入框冷启宽度与最终态一致（无先全宽再缩）  
- [ ] Win 同样路径冒烟（可选）  
- [x] 根治+UX 提交 `973ec1fd0`  
- [x] 用户纠正：`973ec1fd0` 为根治正确基线，**假死回归在该提交之后**  
- [ ] **步25–26**：重点审查 `dc97acd5c`（队列 auto-drain + 传入 threadStatusById/activeItems）；冷启安静前禁止 drain  

---

## 8. 队列 drain 非对抗改写（`dc97acd5c` 之后 · 2026-08-11 晚）

**问题**：S1 auto-drain 正确，但冷启与猛点窗同抢主线程。  
**不该做**：永久关 drain、或与业务对着干。  
**该做**：改触发与依赖。

| 改动 | 说明 |
|------|------|
| `buildQueueDrainSignal` | **无 queue/inflight → 稳定 `empty\|bg:*`**；不再强制塞 activeThreadId（免 active 心跳刷 signal） |
| 放行条件 | **`startup-gate-ready` 或 force-enter** 后，再短静默无点击才 `queueDrainReleased` |
| drain/settlement | 未放行或近 300ms 有点击则跳过；**handleSend / queueMessage 始终可用** |
| handoff 匹配 | `activeItems` 用 ref + 尾部信号，避免流式每 delta 跑 effect |
| Composer memo | 非流式忽略 canvas 大 props（与 queue 并列，减重渲） |

测试：`useQueuedSend.test.tsx` 含 empty signal 稳定性用例。

---

## 9. 关联文档

| 文档 | 用途 |
|------|------|
| `cold-start-action-bisect-checklist-2026-08-11.md` | 逐步日志、收口清单、FLAGS 历史 |
| `cold-start-click-freeze-postmortem-2026-08-10.md` | 更早全链路 postmortem |
| `openspec/changes/defer-thread-list-hydration-until-idle-or-intent/` | list 滞后提案 |
| 本文 | **本轮最终收口报告** |
