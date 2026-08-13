## 1. Contract

- [x] 1.1 [P0, depends: none] 固化 proposal：CLI 检测/安装引导、server 生命周期、`tt_proxy` 数据通道、vendored dashboard 范围（截图五卡片）与裁剪清单、scoped Tailwind 适配、状态机与验收口径。

## 2. Backend（Rust + service 桥）

- [x] 2.1 [P0, depends: 1.1] 新增 `src-tauri/src/tokentracker.rs`：`tt_detect_cli`（probe `tokentracker`/`tracker`/`tokentracker-cli --version`，复用 engine/status.rs 的 async command 模式 + fix-path-env）、`tt_install_cli`（固定执行 `npm install -g tokentracker-cli`，180s timeout，安装后复检 CLI）、`tt_server_status`（probe 已记端口 + 7680..=7684 的 `/functions/tokentracker-user-status`）、`tt_ensure_server`（free port 扫描 + detached spawn `serve --no-open --port <p>`，env `TOKENTRACKER_NO_TELEMETRY=1`，轮询 ready ≤20s）、`tt_proxy`（allowlist `/functions/tokentracker-*` 与 `/api/local-auth`，支持 method/headers/body，20s timeout，返回 JSON）。
- [x] 2.2 [P0, depends: 2.1] `command_registry.rs` 注册 5 个 command；`cargo check` 通过。
- [x] 2.3 [P0, depends: 2.2] 新增 `src/types/tokentracker.ts` 与 `src/services/tauri/tokentracker.ts`（`ttDetectCli`/`ttInstallCli`/`ttServerStatus`/`ttEnsureServer`/`ttProxyRequest`），`src/services/tauri.ts` barrel re-export。

## 3. Vendor dashboard 前端

- [x] 3.1 [P0, depends: 1.1] 按最小闭包 vendor 到 `src/features/extensions/tokentracker-dashboard/`：content（copy.csv + en/zh/zh-TW json）、lib（api/copy/locale/currency/exchange-rate/token-format/format/cn/date-range/details/daily/detail-sort/daily-breakdown/model-breakdown/activity-heatmap/trend-stats/timezone/provider-display/safe-browser/local-usage-auto-refresh/adaptive-refresh/local-storage-lru/auth-token/local-api-auth/native-bridge + mock-data stub）、hooks、ui/foundation、ui/components、ui/dashboard/components（StatsPanel/ActivityHeatmap/ActivityHeatmap3D/TrendMonitor/TrendMonitorZoomModal/UsageOverview/DataDetails/ProjectDetailModal/ProviderIcon/DateRangePopover/project-usage-utils）、ui/dashboard/views/DashboardView、pages/DashboardPage；`public/brand-logos/` 11 个 svg。
- [x] 3.2 [P0, depends: 3.1] 裁剪：删 cloud（InsForge/leaderboard/account 聚合）、auth gate、router Link、dnd（固定顺序渲染）、mock 分支、limits/achievements/分享/install 卡片、ContextBreakdownPanel 挂载、设备卡片；`oai-gray-350/450/750` 死类修正为邻近阶。
- [x] 3.3 [P0, depends: 3.1] api.ts transport 改为 `invoke("tt_proxy")`（保留函数签名与 PATHS）；`triggerLocalSync` 经 `/api/local-auth` + POST local-sync；删除 `isLocalhostHost` cloud 分支。
- [x] 3.4 [P0, depends: 3.1] Tailwind v4 适配：新增 `src/styles/tokentracker-dashboard.css`（`@theme` 不泄漏——oai 色阶/`--radius-*`/`--font-mono`/`:root` 变量全部 scope 到 `.tt-dashboard`，`.dark` 反色挂 `:root.dark .tt-dashboard`；`@utility oai-text-*`/`oai-scrollbar`/`heatmap-scroll-thin`；`tt-*` keyframes；`.rdp-*`）；`globals.css` 的 `@custom-variant dark` 增加 `.dark` class 匹配；bootstrap 引入新 css。
- [x] 3.5 [P0, depends: 3.1] `package.json` 增加 `motion`、`@base-ui/react`、`react-day-picker`、`date-fns` 并 install。

## 4. Integration（ExtensionsView + 状态机 + i18n）

- [x] 4.1 [P0, depends: 2.3, 3.3] 新增 `UsageDashboardSection.tsx` + `hooks/useTokenTrackerServer.ts`：状态机 checking/guide/installing/starting/ready/error；guide 卡片（一键安装、安装过程反馈、命令复制、`openUrl` npm 页面、重新检测、hooks/telemetry 说明）；ready 后 `React.lazy` 渲染 vendored DashboardPage（外层包 ThemeProvider>LocaleProvider>TokenFormatProvider>CurrencyProvider 与 `.tt-dashboard` wrapper）。
- [x] 4.2 [P0, depends: 4.1] locale 桥接：app i18n language → `tokentracker-locale`（zh→zh-CN、zh-TW→zh-TW、ja→ja、ko→ko、其他→en）。
- [x] 4.3 [P0, depends: 4.1] `ExtensionsView.tsx`：usage tab 渲染 `UsageDashboardSection`，其余 tab 空态不变；`extensions.css` 增补 `extensions-usage-*`。
- [x] 4.4 [P1, depends: 4.1] 10 个 locale 目录增补 `extensions.usage.*` chrome 文案（guide/error/retry 等），zh/en parity。
- [x] 4.5 [P1, depends: 3.3] vite dev 增加 `/tt-dev` proxy（仅 dev，方便浏览器内预览 vendored dashboard 迭代）。

## 5. Tests

- [x] 5.1 [P0, depends: 4.1] `UsageDashboardSection.test.tsx`：mock `services/tauri` 覆盖 guide/installing/starting/ready/error 转换、重新检测、一键安装成功/失败。
- [x] 5.2 [P0, depends: 4.3] 更新 `ExtensionsView.test.tsx`：usage tab 渲染新 section（其余 tab 空态断言保留）。
- [x] 5.3 [P1, depends: 3.3] vendored `lib/api.ts` transport 单测（query 拼接、错误传播、allowlist 行为 mock invoke）。
- [x] 5.4 [P1, depends: 4.4] i18n parity 断言更新。

## 6. Verification

- [x] 6.1 [P0, depends: 5.x] `npm run lint && npm run typecheck && npm test`（focused 先行）；`npm run check:large-files`（vendored 大文件走 new-file baseline 豁免）；`npm run build` 确认 motion 等在异步 chunk。
- [x] 6.2 [P0, depends: 6.1] 真实 `tokentracker serve` 下 `tauri dev` 端到端验证 + 截图 QA（对照参考图五卡片）。
- [x] 6.3 [P1, depends: 6.2] OpenSpec strict validation；更新 `dev-guidelines/frontend/` 相关指引（vendored 目录约定）。

## Verification Record

- Focused Vitest: `src/features/extensions` 26 tests passed（UsageDashboardSection 10 例 + ExtensionsView + tt-transport 6 例 + i18n parity）；全量 `npm test` 913 test files passed。
- Static gates: `npm run lint` 0 error（6 warning 为 vendored 既有 exhaustive-deps）、`npm run typecheck` 通过、`npm run check:large-files` 通过（3 个 vendored 大文件走 new-file baseline 豁免：ActivityHeatmap.jsx 1028 / use-trend-data.ts 825 / ActivityHeatmap3D.jsx 814）。
- Build: `npm run build` 通过；vendored dashboard 隔离在 `TokenTrackerDashboardView-*.js` 异步 chunk（~272KB gzip），startup App chunk 未引入 motion/react-day-picker。
- 真实数据 E2E（2026-07-24）：本机 `npm i -g tokentracker-cli` + `tokentracker serve --no-open --port 7680`（TOKENTRACKER_NO_TELEMETRY=1）。浏览器预览页 `tt-dashboard-preview.html` 与官方 dashboard（127.0.0.1:7680）同视口对照：浅色/暗色/总计/月视图全部一致（数值完全相同：11.2B tokens / $9,74x / CODEX 62% / CLAUDE 35%）。
- 真实 app E2E：`tauri dev` 启动后点击侧栏「拓展」→ 使用统计 tab 渲染 vendored dashboard，数据经 `tt_detect_cli`（hermes 安装的 CLI 亦检出）→ `tt_ensure_server`（复用已运行 server）→ `tt_proxy` 链路返回。
- QA 中发现并修复：oai 色板 `@theme` 原先放在不产 utility 的 `tokentracker-dashboard.css`，导致全部 oai 颜色 utility（含 dark 变体）未生成；已移至 `globals.css` 的 `@theme`（v4 只有 utilities-emitting compilation 可见的 token 才会生成类）。
