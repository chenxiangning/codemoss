# Spec delta: client-startup-orchestration

> OpenSpec change: `fix-windows-cold-start-freeze-residual`  
> Capability modified: `client-startup-orchestration`

## ADDED Requirements

### CSS scale-styles must use platform-split strategy

`applyUiScale` 必须按渲染引擎平台采用不同的 CSS 写入策略。

**macOS WKWebView** 懒加载 CSSOM——冷启时无 CSS inline 写入意味着 computed style tree 不构建，首次点击触发 hit-test → 同步 style recalc + layout → 主线程死锁。必须无条件写入 CSS 属性以触发 CSSOM 预热。

**Windows WebView2 (Chromium Blink)** 积极构建 CSSOM，每次 inline style mutation 触发全量 cascade re-resolution。冷启首帧 20+ 次写入空字符串累积为可测量的布局回算延迟，阻塞 compositor hit-test。必须仅清除有残留值的属性。

- **Given** 平台为 macOS
- **When** `apply(1)` 在 cold-start effect 中执行
- **Then** 无条件清除 10 个 scale 相关 CSS 属性（`clearScaleLayoutStyles`）
- **And** 无条件写 zoom（scale=1 时写 `""`，否则写 String(scale)）
- **And** 无条件写入 `--ui-scale`

- **Given** 平台为 Windows / Linux / unknown
- **When** `apply(1)` 在 cold-start effect 中执行
- **Then** 仅清除有残留值（`getPropertyValue(prop) !== ""`）的 CSS 属性
- **And** scale=1 时不写 zoom（`setResidualScaleLayoutStyles` 直接 return）
- **And** `--ui-scale` 仅 scale≠1 时写入，scale=1 且无残留时跳过

- **Given** 任何平台 + hot-reload / 前次 session 残留非 identity scale
- **When** `apply(scale)` 执行
- **Then** macOS 路径无条件覆盖残留，Windows 路径清除检测到的残留后写入新值

### blankScreenWatchdog must defer during cold-start gate window

白屏检测 `startRendererBlankScreenWatchdog` 内部调用 `getBoundingClientRect()` + `getComputedStyle()` 触发强制同步布局。冷启 gate 窗内 `StartupGateOverlay` 全覆盖视口，白屏检测无用户价值，其强制布局却会与正在进行的 React reconciliation 竞争主线程。

- **Given** 冷启 gate 未 ready（`startup-gate-ready` 未 stamp）且 `StartupGateOverlay` 已渲染
- **When** `startRendererBlankScreenWatchdog` 的 interval callback 触发
- **Then** 首次检查必须延迟到 `startDelayMs` 之后（默认 15s，覆盖 gate-ready + force-enter + uiScale phase-2 天花板）
- **And** 延迟期间不采样、不写入诊断

### StartupGateOverlay must avoid GPU shader color-mix

`color-mix(in_srgb, var(--surface-messages) 92%, transparent)` 在 Chromium/WebView2 上需要 GPU shader 计算，增加 compositor 帧成本。冷启窗内 compositor 帧时间直接决定点击响应延迟。

- **Given** `StartupGateOverlay` 渲染全屏遮罩
- **When** 背景色需按主题变量 92% opacity 渲染
- **Then** 必须使用分层 opacity（独立的 `absolute` 背景 div + `opacity: 0.92`）替代 `color-mix()`
- **And** 背景 div 使用 `background-color: var(--surface-messages, #0d0f14)` 保持主题兼容

### Diagnostics persisted store must trim on load

诊断文件跨 session 累积可能超出 `MAX_PERSISTED_RENDERER_DIAGNOSTICS_BYTES`（256KB）。首次加载到内存缓存时检查 byte budget，超出则 trim 后写回。

- **Given** `getPersistedDiagnosticsSnapshot()` 首次从 store 加载诊断条目
- **When** 计算全部条目的 JSON 字节估算值 > 256KB
- **Then** 调用 `trimDiagnosticsToByteBudget` 裁剪后再缓存
- **And** 下次 persist 自动写入已裁剪的集合
