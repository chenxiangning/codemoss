# Vendored Frontend 约定（tokentracker-dashboard）

`src/features/extensions/tokentracker-dashboard/` 是从上游 TokenTracker（MIT）vendor 的 dashboard 前端闭包，服务「拓展-使用统计」与「拓展-Skills」。本页固化其维护约定。

## 目录性质

- **vendored, not authored**：除登记在案的裁剪/适配点外，文件与上游 `TokenTracker/dashboard/src` 逐字节一致。禁止重排版、重命名、拆分行数（大文件走 `check:large-files:new-file-baseline` 豁免，当前豁免：`ActivityHeatmap.jsx`、`use-trend-data.ts`、`ActivityHeatmap3D.jsx`、`SkillsPage.jsx`）。
- `.jsx` 不在 lint 范围（lint 只查 `.ts/.tsx`）；vendored `.ts` 必须通过 lint/typecheck；vendored 文件里既有的 react-hooks warning 不清零。
- 同步上游时先 diff 裁剪点清单（见 OpenSpec change `add-tokentracker-usage-dashboard`），再逐文件对齐。

## 裁剪边界（不vendor / 已删除）

cloud（InsForge/leaderboard/account 聚合）、auth gate、router、dnd 排序、mock-data（10 行 stub）、limits/achievements/分享/install 卡片、ContextBreakdownPanel、设备卡片。`lib/api.ts` 仅保留 10 个 local slug + `triggerLocalSync`。

## Skills 闭包（2026-07-24 追加；同日后端改为内置）

- `pages/SkillsPage.jsx` + `pages/SkillDetailPanel.jsx` + `lib/skills-api.ts`：上游 skills 模块整套交互（My/Browse 双 tab、agent target 同步、批量操作、回收站 Undo、更新检测、skills.sh 搜索/Popular）原样 vendored。
- **后端内置，不依赖 tokentracker-cli**：upstream `skills-manager.js` / `skill-usage.js` 已逐语义移植为 Rust `src-tauri/src/skills_hub.rs`（commands `skills_hub_query` / `skills_hub_mutate`，协议与 upstream HTTP 端点 1:1）。`skills-api.ts` 在 Tauri 内走 `invoke`，浏览器 dev 预览（非 Tauri）回退 `/tt-dev` fetch。local-auth token 机制不移植（IPC 可信）。
- 有意偏差（登记）：SSOT 目录 `~/.ccgui/skills/`（非 upstream 的 `~/.tokentracker/skills/`）；skill_usage 不输出 cost（LiteLLM 定价表未移植），`SkillDetailPanel.jsx` 的 cost 行改为仅在有 cost 时渲染；排序用 codepoint 代替 localeCompare。
- 其他适配点：① SkillsPage localhost 门禁改为 `isTauriRuntime() || IS_LOCAL_HOST`；② 随 SkillsPage 补 vendor 的组件：`ui/components/ConfirmModal.jsx`、`Input.jsx`、`DismissibleHint.jsx`、`Toast.jsx`（`ToastProvider` 挂在 `TokenTrackerSkillsView`，是回收站 Undo toast 的宿主）、`components/LocalOnlyNotice.jsx`。
- 宿主侧：`TokenTrackerServerGate`（CLI detect/install/ensure 门控）仅供 usage；`SkillsDashboardSection` 无门控直接渲染，locale/theme 桥接由 `useTokenTrackerViewBridge()` 共用 hook 提供；两个 vendored 页各自经 `TokenTrackerDashboardView.tsx` / `TokenTrackerSkillsView.tsx` 懒加载。
- `tt_proxy` / `useTokenTrackerServer` / `extensions.usage.*` 门控文案此后只服务 usage dashboard。

## WKWebView 渲染修复（2026-07-25，Skills 页视觉问题）

- **品牌 logo 内联化**：上游 `ProviderIcon.jsx` 对彩色品牌 logo 走 `<img src="/brand-logos/*.svg">`，macOS WKWebView 不绘制这些 SVG-in-`<img>`（agent dot 全空）。修复：5 个 agent 用得到的 logo（claude/codex/antigravity/gemini/opencode）复制到 `assets/brand-logos/` 并以 `?raw` 内联渲染（`PROVIDER_INLINE_SVG_MAP`，根标签 width/height 规整为 100%）；其余 logo 条目仍走 `<img>`。回归测试 `pages/ProviderIcon.test.tsx`。
- **宿主全局 button 规则排除**：`src/styles/buttons.css` 的 `button:not(...)` 全局规则（radius 10px / padding 8×14 / font-weight 600）曾污染 vendored 页的裸 `<button>`（skills tab、agent dot）；选择器已扩展为 `button:not(:where(.markdown-codeblock-copy, .tt-dashboard button))`。修改全局规则时不得把 `.tt-dashboard` 子树重新纳入。
- **UA focus ring**：`tokentracker-dashboard.css` 的 `.tt-dashboard *:focus` 抑制规则追加 `box-shadow: none !important`（macOS 26 Safari/WKWebView 用圆角 box-shadow 画焦点环；upstream 意图本就是 dashboard 内无焦点环）。

## 数据通道（fetch 只出现在 dev 预览 fallback）

- usage dashboard 一律经 `lib/tt-transport.ts` → `invoke("tt_proxy", { method, path, headers, body })`；Rust 侧 allowlist 仅 `/functions/tokentracker-*` 与 `/api/local-auth`。
- skills 在 Tauri 内经 `invoke("skills_hub_query" / "skills_hub_mutate")` 直查内置 Rust 后端；仅浏览器 dev 预览（非 Tauri）时 `lib/skills-api.ts` 回退 `/tt-dev` fetch。
- 浏览器 dev 预览走 `/tt-dev` vite proxy（`vite.config.ts`），预览入口 `tt-dashboard-preview.html` + `preview/main.tsx`（`?view=skills` 预览 Skills 页）；`useTokenTrackerServer` 在非 Tauri 环境跳过 detect/ensure 直接 ready。

## CLI 安装边界

- 未安装 CLI 时，门控（`TokenTrackerServerGate`，仅 usage section 使用）MAY 提供一键安装，但只能调用 `tt_install_cli` 这类固定 backend command；frontend 禁止拼接或传入任意 shell command。
- 安装期间必须进入显式 `installing` 状态；成功后重走 `detect -> ensure server`，失败进入可恢复 error 状态。

## 样式（Tailwind v4 关键坑）

- **`--color-oai-*` token 必须留在 `globals.css` 的 `@theme`**：v4 只为 utilities-emitting compilation 可见的 token 生成类；放别处（如不 import tailwind 的 `tokentracker-dashboard.css`）会导致颜色 utility（含 `dark:` 变体）静默不生成——2026-07-24 暗色失效即此根因。
- `--radius-*` / `--font-mono` 与上游 `:root` 变量一律 scope 在 `.tt-dashboard` / `.tt-dashboard.dark`，**禁止**进 `@theme`（会改 app 全局圆角/字体）。
- 其 ThemeProvider 把 `.dark` 写到 `.tt-dashboard` wrapper（不是 `<html>`）；`globals.css` 的 `@custom-variant dark` 已扩展 `.dark` class 匹配。

## 性能边界

- vendored tree 只能经 `TokenTrackerDashboardView.tsx` / `TokenTrackerSkillsView.tsx`（`React.lazy`）异步加载，禁止任何静态 import 把它拉进 startup chunk。
- 数据 state 留在 extensions 子树，禁挂 app-shell 根链；vendored auto-refresh 为 30s 自适应，不得再加秒级轮询。
