# 冷启 / Cmd+R 假死 · 联调二分记录

| 项 | 值 |
|----|-----|
| 日期 | 2026-08-11 |
| 现象 | 开发者模式启动后 **Cmd+R**，立刻猛点界面 → 高概率整窗假死 |
| 状态 | **已关闭（Mac 验收：不卡 + UX 正确）** |
| 详细收口报告 | [`cold-start-composer-freeze-closeout-2026-08-11.md`](./cold-start-composer-freeze-closeout-2026-08-11.md) |
| 证据图 | `docs/analysis/cold-start-bisect-2026-08-11/screenshots/` |
| 规则 | **本文件只追加、不覆盖历史**；逐步结果在 §2.3 |

---

## 1. 当前状态（最终）

| 项 | 值 |
|----|-----|
| 根因 | 完整 `Composer.tsx` 冷启立即挂载（Adapter/ChatInputBox 不卡） |
| 生产形态 | `ComposerGate` → 先 `ComposerLight`（正确工具栏 + 模型 loading）→ 停手后 `ComposerImpl` |
| 副改进 | list/restore quiet、home gate stamp、uiScale healthy rAF 等 |
| 二分脚手架 | **已全部删除** |
| Mac | **不卡**；模型位 loading→真名；输入框宽度稳定；无大空洞 |
| Win | 本轮未复测 |
| 止血 commit | `d21e1b989` |

---

## 2. 调试过程（时间序，只追加）

### 2.1 背景与失败路径（代码联调前）

| 时间线 | 内容 |
|--------|------|
| 历史 | 2026-08-05～10 冷启假死系列：uiScale / full-catalog / platform-split（见 `cold-start-click-freeze-postmortem-2026-08-10.md`） |
| 用户反馈 | 会话转圈期间整窗不可点；切工作区/对话会反复卡 |
| 错误尝试 | `StartupInteractionShield` 透明层穿透，**已回退** |
| 方向调整 | 滞后 first-paint / quiet 门控 / 修 `useWorkspaceRestore` 同 tick list；**仍卡** |

### 2.2 二分策略

目标：把「Cmd+R 猛点假死」拆到最小可复现层。

| 原则 | 说明 |
|------|------|
| 从瘦到肥 | ultra → shell-lite → app-lite → app-settings → app-workspace → essentials → FLAGS → off |
| 一次一档 | 改 `COLD_START_BISECT_TIER` 或单个 FLAG，Cmd+R 再测 |
| 只看 App | 右上角红条显示档位；以是否假死为准 |
| 记录 | 每步写入下表，**不删改已有行** |

### 2.3 二分结果日志

| 步 | 时间 | 档位 / 配置 | 操作 | 现象 | 结论 | 操作者 |
|----|------|-------------|------|------|------|--------|
| 0 | 2026-08-11 | `ultra` 探针 | Cmd+R，狂点大按钮 | **不卡**，计数≥30 | WebView/宿主可点；问题不在纯 React 探针 | 用户 |
| 1 | 2026-08-11 | `essentials` 真 App（S02/S03/S01 等关） | Cmd+R 猛点侧栏/设置 | **卡死** | 问题在完整 App 树，**不是**已关的 list restore/hydration/uiScale  alone | 用户 |
| 2 | 2026-08-11 | `shell-lite` 假侧栏+主区 | Cmd+R 狂点假侧栏/按钮 | **不卡**，计数≥36 | 假壳布局 OK；问题在真 App 挂载内容 | 用户 |
| 3 | 2026-08-11 | `app-lite` 真路由 + AppShell 短路 | Cmd+R 狂点 | **不卡**，计数≥20 | 问题在 composition/threads 树，不在路由+workspaces IPC | 用户 |
| 4 | 2026-08-11 | `essentials` + S07/S08 关 | Cmd+R 猛点真壳 | **卡死** | snapshot/事件关了仍卡 → composition 其它部分（engine/git/UI/其余 hooks） | 用户 |
| 5 | 2026-08-11 | `app-settings` | Cmd+R 猛点 | **不卡**，计数≥15 | settings 安全 | 用户 |
| 6 | 2026-08-11 | `app-workspace` | Cmd+R 猛点 | **不卡** | workspace host 安全 | 用户 |
| 7 | 2026-08-11 | `app-threads` | Cmd+R 猛点 | **不卡**，计数≥22 | useThreads 单独不卡（S07/S08 关） | 用户 |
| 8 | 2026-08-11 | `app-hooks` | Cmd+R 猛点 | **不卡**（计数可点） | composition hooks 不卡；问题在 View/Zones | 用户 |
| 9 | 2026-08-11 | `app-zones` | Cmd+R 猛点 | **不卡**，计数≥18 | ZoneProviders 不卡 | 用户 |
| 10 | 2026-08-11 | `app-view-hooks` | Cmd+R 猛点 | **不卡**，计数≥16 | section hooks 不卡；问题在 renderAppShell | 用户 |
| 11 | 2026-08-11 | `app-render-shell` | Cmd+R 猛点 | **不卡**，侧栏槽计数≥16 | AppLayout 骨架不卡 | 用户 |
| 12 | 2026-08-11 | `app-render-sidebar` | Cmd+R 猛点真侧栏 | **不卡**（侧栏可点，messages/composer 空槽计数可见） | **真 sidebar 单独不卡** | 用户 |
| 13 | 2026-08-11 | `app-render-messages` | Cmd+R 猛点 | **不卡**，空槽计数≥22 | 真 messages 单独不卡 | 用户 |
| 14 | 2026-08-11 | `app-render-composer` | Cmd+R 猛点真 composer | **卡死** | **composer 节点单独致卡**（sidebar/messages 均 OK） | 用户 |
| 15 | 2026-08-11 | `app-render-composer-plain` | Cmd+R 猛点 plain Composer | **卡死** | 非 ActiveCanvas alone；**Composer 本体** | 用户 |
| 16 | 2026-08-11 | `app-render-chatinput` | Cmd+R 猛点 | **不卡** | **ChatInputBox 不卡** | 用户 |
| 17 | 2026-08-11 | `app-render-composer-solo` | Cmd+R 猛点 | **卡死** | **Composer 本体致卡**（无 layoutNodes） | 用户 |
| 18 | 2026-08-11 | `app-render-adapter` | Cmd+R 猛点 | **不卡** | **Adapter 不卡** → 致卡在 **Composer.tsx** | 用户 |
| 19 | 2026-08-11 | essentials + DeferredComposer v1 | Cmd+R 猛点真壳 | **仍卡** | 无输入被当 quiet → 过早升级 Composer | 用户 |
| 20 | 2026-08-11 | essentials + DeferredComposer v2 | Cmd+R 猛点 / 点选择模型 | **仍卡** | 4s 无人升级或真侧栏+消息+轻壳组合；用户标注「选择模型出来后点就卡」 | 用户 |
| 21 | 2026-08-11 | essentials + DeferredComposer v3 | Cmd+R 猛点；滞后后点选择模型 | **不卡**（出来前不卡，滞后出来后也不卡） | **修复验证通过** | 用户 |
| 22 | 2026-08-11 | `off` 生产全路径 · **Mac** | 冷启/Cmd+R 全程猛点 + 切换会话/新建菜单 | **全程不卡**；仅有数秒输入框过渡 | **Mac 验收通过** | 用户 |
| 23 | 2026-08-11 | 根治：ComposerGate+ComposerLight | Cmd+R 猛点 | **不卡** | 仍有模型条硬切 UX | 用户 |
| 24 | 2026-08-11 | UX 修订：模型位 loading；Light 同宽；工具栏不撑空 | 冷启/开历史 | **用户确认：都对了也不卡了** | **根治+UX 收口** | 用户 |
| 25 | 2026-08-11 | 假死复现（用户判定） | Cmd+R 猛点 | **卡** | **根因在 `973ec1fd0` 之后** | 用户 |
| 26 | 2026-08-11 | 审查 `6f704687e` 合入 | — | **合入树=第一父，无文件 diff** | 该 merge **未改任何文件** | 分析 |
| 27 | 2026-08-11 | 定位 `dc97acd5c` 队列 drain | — | **最高嫌疑** | threadStatusById/activeItems 下灌 + S1 drain | 分析 |
| 28 | 2026-08-11 | 修：冷启门控 drain + Composer 空闲忽略 canvas 重渲 | Cmd+R 猛点 | **不卡** | 用户确认 | 用户 |
| 29 | 2026-08-11 | 队列非对抗改写：signal 无队列 empty；drain 对齐 startup-gate | — | 实现中 | 保留 S1 能力，改触发条件 | |

> 新结果请**在表末追加行**，不要改写上面已填格。

### 2.3b 截图证据索引

目录：`docs/analysis/cold-start-bisect-2026-08-11/screenshots/`

| 文件 | 对应 |
|------|------|
| `00-user-feedback-chat-freeze.jpg` | 用户反馈：转圈/点设置假死 |
| `00-user-feedback-switch-dialogue.png` | 用户反馈：切对话会反复 |
| `step-00-ultra-probe-ok.png` | 步0 探针不卡 |
| `step-01-essentials-freeze.jpg` | 步1 essentials 真壳（卡死档） |
| `step-02-shell-lite-ok.jpg` | 步2 假壳不卡 |
| `step-03-app-lite-ok.jpg` | 步3 app-lite 不卡 |
| `step-05-app-settings-ok.jpg` | 步5 settings 不卡 |
| `step-07-app-threads-ok.jpg` | 步7 useThreads 不卡 |
| `step-08-app-hooks-ok.jpg` | 步8 全 hooks 不卡 |
| `step-09-app-zones-ok.jpg` | 步9 ZoneProviders 不卡 |
| `step-10-app-view-hooks-ok.jpg` | 步10 section hooks 不卡 |
| `step-11-app-render-shell-ok.png` | 步11 AppLayout 空槽不卡 |
| `step-12-app-render-sidebar-ok.jpg` | 步12 真 sidebar 不卡 |
| `step-13-app-render-messages-ok.jpg` | 步13 真 messages 不卡 |
| `step-14-app-render-composer-FREEZE.jpg` | 步14 真 composer **卡死**（关键） |
| `step-15-plain-composer-FREEZE.jpg` | 步15 plain Composer **卡死** |
| `step-16-chatinput-ok.jpg` | 步16 ChatInputBox **不卡**（关键） |
| `step-17-composer-solo-FREEZE.jpg` | 步17 Composer solo **卡死** |
| `step-18-adapter-ok.jpg` | 步18 Adapter **不卡**（关键） |
| `step-19-essentials-deferred-v1-FREEZE.jpg` | 步19 延迟 v1 仍卡 |
| `step-20-essentials-deferred-v2-FREEZE.jpg` | 步20 延迟 v2 仍卡（点选择模型） |
| `step-21-essentials-deferred-v3-light-ok.jpg` | 步21 轻量阶段不卡 |
| `step-21-essentials-deferred-v3-full-ok.jpg` | 步21 完整 Composer 出现后不卡 |
| `step-22-prod-off-mac-ok-1.jpg` … `ok-4.jpg` | 步22 Mac 生产验收 |

> 步4/6 等未单独截图的步骤仍以 §2.3 文字为准。后续截图请命名 `step-NN-*.jpg` 放同目录并在本表追加。

### 2.4 已排除 / 仍可疑

| 状态 | 项 |
|------|-----|
| **已排除** | 纯 WebView 点按钮必挂；透明护盾方案；「仅 list IPC」作为唯一根因（essentials 已关 list 仍卡） |
| **已缩小** | 卡在 composition 内：app-lite（无 composition）不卡 |
| **已锁定** | **composer 挂载路径**（步14 单独卡死） |
| **根因** | **`Composer.tsx` 挂载**（ChatInputBox/Adapter 均不卡） |
| **修复 v1** | DeferredComposer 误把无输入当 quiet → 仍卡（步19） |
| **修复 v2** | 仅「挂载后有输入且安静」或「4s 无人点」才升级；renderFull 延迟创建 |
| **步4 结论** | snapshot+事件关了仍卡 → **非这两项单独致卡** |
| **步5 结论** | settings 不卡 |
| **步6 结论** | workspace host 不卡 |
| **步7 结论** | useThreads 单独不卡 |
| **步8 结论** | 全 hooks 不卡 |
| **步9 结论** | ZoneProviders 不卡 |
| **步10 结论** | section hooks 不卡 |
| **步11 结论** | AppLayout 空槽不卡 |
| **步12 结论** | 真 sidebar 单独不卡 |
| **步13 结论** | 真 messages 单独不卡 |
| **步14 结论** | **真 composer 单独卡死**（关键命中） |
| **步15 结论** | plain Composer 仍卡 |
| **步16 结论** | **ChatInputBox 不卡** |
| **步17 结论** | **Composer solo 卡死** → Composer 壳层 |
| **步18 结论** | **Adapter 不卡** → **根因 Composer.tsx** |
| **步19 结论** | 延迟 v1 仍卡 |
| **步20 结论** | 延迟 v2 仍卡 |
| **步21 结论** | **DeferredComposer v3 验证通过，不卡** |
| **步22 结论** | **Mac 生产形态全程不卡**（仅数秒转换过渡） |
| **步23–24 结论** | **ComposerGate+Light + 模型位 loading + 布局宽度/间距修正；用户确认 OK** |

### 2.5 代码联调改动摘要（过程资产，未提交）

| 类别 | 路径 / 说明 |
|------|-------------|
| 二分开关 | `coldStartBisectFlags.ts`：档位 + FLAGS |
| 探针 | `ColdStartBisectProbe.tsx` |
| 假壳 | `ColdStartShellLite.tsx` |
| 真入口瘦壳 | `ColdStartAppLite.tsx` / `ColdStartAppSettingsOnly.tsx` / `ColdStartAppWorkspaceHost.tsx` |
| AppShell 短路 | `AppShell.tsx` 按档位分支 |
| 角标 | `ColdStartBisectBadge.tsx` |
| bootstrap 分档 | `bootstrapApp.tsx` |
| 曾做的业务向修复（仍在树里，bisect 可关） | restore/hydration quiet 调度、pointer soft-cancel 等 |
| **Composer 延迟挂载（生产保留）** | `DeferredComposerMount.tsx` v3 + `useLayoutNodes` renderFull |

---

## 3. 档位说明

| Tier | 界面现象 | 挂什么 | 不挂什么 |
|------|----------|--------|----------|
| `ultra` | 黑底单按钮 | 最小 React | App / preload / i18n |
| `minimal-shell` | 同探针 | +preload | App |
| `shell-lite` | 假侧栏+主区 | 静态假数据 | 真 App |
| `app-lite` | 侧栏真工作区名 + 大按钮 | 真路由；`list_workspaces`；AppShell 短路 | composition / threads |
| `app-settings` | 简单页 + 大按钮 | 仅 `useAppSettingsController` | workspace / threads / composition |
| `app-workspace` | 真工作区列表 + 大按钮 | settings + `useWorkspaceSessionHost` | threads / composition |
| `app-threads` | 工作区+会话列表(可能空)+大按钮 | + `useThreads`；无 AppShellView | 完整 UI composition |
| `app-hooks` | 简单页+大按钮 | 完整 composition hooks；无 View | View / Zones |
| `app-zones` | 简单页+大按钮 | hooks + ZoneProviders；无 View | AppShellView |
| `app-view-hooks` | 简单页+大按钮 | View 内 3 section hooks；无 renderAppShell | renderAppShell DOM |
| `app-render-shell` | AppLayout + 三空槽可点 | AppLayout 骨架；无真 Sidebar/Messages | 真业务节点 |
| `essentials` | 产品真壳 | 完整 renderAppShell | FLAGS 关掉的副作用 |
| `off` | 正常产品 | 全部 | — |

改档：只改 `COLD_START_BISECT_TIER`，保存后 Cmd+R。

---

## 4. 启动动作全清单（分步排查用）

> 下列为冷启 / Cmd+R 后**可能执行**的动作。  
> bisect 用 FLAGS 关的项见「开关 ID」；无 ID 的仍在 essentials/app-lite 路径内，靠档位拆。

### 4.1 Phase B · Bootstrap（`bootstrapApp.tsx`）

| ID | 动作 | 代码锚点 | essentials 默认 | 嫌疑 | 备注 |
|----|------|----------|-----------------|------|------|
| B01 | preload client stores | `preloadClientStores` | 开 | 低 | 必备之一 |
| B02 | dynamic import App | `import("./App")` | 开 | 低 | |
| B03 | client store maintenance | `runClientStoreMaintenance` | **关** | 中 | |
| B04 | i18n ready | `i18nReady` | 开 | 低 | |
| B05 | React mount | `createRoot().render` | 开 | 低 | |
| B05b | React.StrictMode | 包一层双 mount | **关** | 中 | dev 放大副作用 |
| B05c | React.Profiler | hotspot 采样 | **关** | 低 | |
| B08 | blank-screen watchdog | `startRendererBlankScreenWatchdog` | **关** | 中 | 强制 layout |
| B09 | mark renderer ready | Tauri invoke | **关** | 低 | |
| B10 | localStorage migration | `migrateLocalStorageToFileStore` | **关** | 中 | |
| B11 | input history restore | `initInputHistoryStore` | **关** | 中 | |

### 4.2 Phase S · Shell / 业务挂载

| ID | 动作 | 代码锚点 | essentials 默认 | 嫌疑 | 备注 |
|----|------|----------|-----------------|------|------|
| S01 | uiScale CSS apply | `useUiScaleShortcuts` | **关** | 高 | WebView 布局史 |
| S02 | workspace restore → list | `useWorkspaceRestore` | **关** | 极高 | 曾同 tick 双开 list |
| S03 | auto first-paint hydration | `useWorkspaceThreadListHydration` | **关** | 极高 | |
| S04 | focus 刷新 list | `useWorkspaceRefreshOnFocus` | **关** | 高 | |
| S05 | pointer soft-cancel list | hydration 点击 cancel | **关** | 低 | 防护项 |
| S06 | home-input-ready stamp | `useAppShellWorkspaceHomeState` | **关** | 低 | |
| S07 | sidebar snapshot → reducer | `loadSidebarSnapshot` | **关** | **极高** | 步4 |
| S08 | useAppServerEvents 订阅 | `useAppServerEvents` | **关** | **极高** | 步4 |
| — | useThreads 其余 hooks/effect | composition 内 | essentials 仍跑 | 高 | snapshot/事件关后若仍卡 |
| — | useWorkspaces list IPC | `list_workspaces` | essentials **开**；app-lite 也调 | 中 | app-lite 用于区分 |
| — | settings load | `useAppSettings` | essentials **开** | 中 | |
| — | engine / dictation / liquid glass 等 | composition 内 | essentials **开** | 中 | |
| — | AppShell composition ~2.4k 行 | `useAppShellRootComposition` | essentials **开** | **极高** | app-lite 不进 |

### 4.3 Phase O · 观测

| ID | 动作 | 代码锚点 | essentials 默认 | 嫌疑 |
|----|------|----------|-----------------|------|
| O01 | frame-drop / perf 监控 | `startPerfDiagnosticsIfEnabled` | **关** | 中 |
| O02 | diagnostics 重 flush | `flushRendererDiagnosticsBuffer` | **关** | 中 |
| O03 | bootstrap runtime notices | `pushBootstrapNotice` | **关** | 低 |
| O04 | bootstrap diagnostic append | `appendRendererDiagnostic` | **关** | 低 |

### 4.4 推荐加回顺序（essentials 已卡、list 关之后）

| 序 | 动作 | 目的 |
|----|------|------|
| ① | `app-lite`（当前） | 区分「workspaces 壳」vs「threads 树」 |
| ② | 若 app-lite 不卡 → 回 essentials，再拆 threads 挂载点 | 定位 useThreads/事件 |
| ③ | 若 app-lite 卡 → 查 settings / list_workspaces / 路由 lazy | 定位更浅层 |
| ④ | 命中层再开 S02/S03/S01 做交叉验证 | 与历史 list 线对齐 |

FLAGS 加回：改 `COLD_START_BISECT_FLAGS` 对应项为 `true`。

---

## 5. 相关历史文档（只读索引）

| 文档 | 内容 |
|------|------|
| `docs/analysis/cold-start-click-freeze-postmortem-2026-08-10.md` | 6 天全链路、四条因果链、platform-split |
| `docs/analysis/windows-ccgui-startup-hang-2026-08-05.md` | uiScale / WebView2 二分 |
| `docs/analysis/windows-cold-start-click-freeze-and-uiscale-0.8-2026-08-07.md` | 列表 × 缩放交叉 |
| `docs/analysis/workspace-switch-session-catalog-performance-regression-2026-08-08.md` | 切工作区 projection 9999 |
| `openspec/changes/defer-thread-list-hydration-until-idle-or-intent/` | 滞后 first-paint 提案 |

---

## 6. 续写模板（以后每步复制追加）

```markdown
| N | YYYY-MM-DD | 档位/FLAGS | Cmd+R + … | 卡/不卡 + 简述 | 结论一句话 | 谁 |
```

写入 **§2.3 表末**，不要改历史行。

---

## 7. 手工收口清单（2026-08-11 最终形态 · 修订）

> 完整叙述见 [`cold-start-composer-freeze-closeout-2026-08-11.md`](./cold-start-composer-freeze-closeout-2026-08-11.md)。

### 7.1 生产必须保留

| 项 | 路径 | 作用 |
|----|------|------|
| **ComposerGate** | `Composer.tsx` | light → full；warm 后直开 full |
| **ComposerLight** | `ComposerLight.tsx` | Adapter + `sendReadiness`；**无** atomic catalog |
| **模型位 loading** | `ModelSelect.tsx` / `ComposerReadinessBar.tsx` | 未解析显示加载中，同位置替换真名 |
| **工具栏不撑空** | `toolbar.css` / `banners.css` | readiness 不 `1fr` 拉出大空洞 |
| **Light 同宽** | `ComposerLight` 使用 `footer.composer` | 与完整态 `max-width: 750px` 一致 |
| list/restore quiet 等 | hydration / restore / interactiveMainThread | 副改进（止血提交已含） |

### 7.2 已删除 / 勿回潮

| 项 | 说明 |
|----|------|
| 全部 ColdStart 二分脚手架 | 探针组件、flags、入口短路 |
| **外层 DeferredComposerMount** | 逻辑已内聚到 ComposerGate |
| Light 上 `onExecutionTargetChange` | 会开 atomic catalog → **假死复现** |

### 7.3 文档档案

| 项 | 说明 |
|----|------|
| 本 checklist + screenshots | 逐步日志与证据 |
| `cold-start-composer-freeze-closeout-2026-08-11.md` | **全流程详细收口** |
| OpenSpec list 滞后 change | 提案归档 |

### 7.4 最终形态问答

| 问题 | 答案 |
|------|------|
| 现在是修复成功后的样子吗？ | **是**（Mac 用户确认不卡且 UX 对） |
| 轻量层还会缺模型位吗？ | **否**：有 `sendReadiness` 静态模型位 + loading |
| 输入框还会先全宽再缩吗？ | **否**：Light 与 Full 同用 `.composer` 限宽 |
| 止血 commit？ | `d21e1b989` |
| 根治+UX 代码？ | 工作区变更，建议再 commit 一次 |
