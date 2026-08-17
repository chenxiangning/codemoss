# Proposal: plugin-rack-visual-strip

> OpenSpec change id: `plugin-rack-visual-strip`  
> Wave：用户目标收口刀（插排可视化 100%，3/9 口径）  
> 依赖：`archive/2026-08-17-project-map-plugin-install-loop`（D-052 三根真实装/卸已齐）  
> 架构：`15` §3 不允许跳到 Slim。本刀只改插排呈现，不改 allowlist、不改 Host boot。

## Why

三根 pilot 已经能真实装/卸，但 Extensions 页仍是设置卡片列表。用户要的是「插排」：一眼看出 3 个插座可插拔、9 个插座封死。现在做，是因为协议层已到 7/9 + D-052，视觉层是目标里最后一块，再不做就会把 75% 的卡片列表误读成插排已完成。

## What Changes

- 独立 HTML 原型：引用项目 design tokens，演示 3 真可插拔 + 9 只读封口。
- `PluginRackSection` 从 engine/feature 卡片列表升级为可视化插排（Host 条 + 可插拔仓 + 只读仓）。
- 可插拔仓仅 `com.mossx.engine.claude` / `com.mossx.notes` / `com.mossx.project-map` 有安装或卸载按钮，按钮仍调产品 `install_plugin` / `uninstall_plugin`。
- 其余 9 根 later-plugin 以封口插座呈现，MUST NOT 出现安装/卸载按钮。
- 进度盘 Rack 可视化按 3/9 口径标到 ~100%。远程 Marketplace 文案仍关。

## 目标与边界

1. 用户打开插排页 MUST 看到一条插排，而不是按 Engines/Features 分组的设置卡。
2. 三个 allowlisted 插座 MUST 可插拔：`desiredState=installed` 显示已插入 + 卸载；`uninstalled` 显示空座 + 安装。
3. 九个 later-plugin 插座 MUST 可见且只读，文案标明后续/封口。
4. 安装/卸载语义 MUST 与 D-052 一致：只调现有产品命令，不新增第二条实现。
5. 原型与实现 MUST 只使用 `design-tokens.md` / `tokens.css` 已列 token，禁止自造色值、字号、圆角。

## 非目标

- MUST NOT Slim / 删 Core。
- MUST NOT 开 Marketplace / 12 根全可写。
- MUST NOT 给 0/9 later-plugin 装按钮。
- MUST NOT 做 Host 真 boot / LKG。
- MUST NOT 改 allowlist、lockfile、24 条 command 闸门。

## 技术方案取舍

| 选项 | 做法 | 结论 |
|---|---|---|
| A. 保留卡片列表，只改文案/分组 | 便宜，但用户仍看不到「插排」 | 拒绝。75% 就是这个状态 |
| B. Host 条 + 可插拔仓 3 座 + 只读仓 9 座 | 视觉隐喻对齐产品语言；按钮仍 3 个 | **采用** |
| C. 12 座全可点，0/9 点了给 toast | 看起来完整，实际是假按钮 | 拒绝。违反 D-049 / D-052 |

## 验收标准

- HTML 原型在 `docs/prototypes/plugin-rack-visual/`，引用 tokens，3 座可点、9 座不可点。
- `PluginRackSection` 渲染 live bank + later bank；`getAllByRole("button")` 长度为 3。
- later-plugin 区域不含 Install / Uninstall。
- focused vitest + CSS layout 断言通过。
- 进度盘 Rack UI 按 3/9 口径到 ~100%；Allowed / Real uninstall / End-state 数字不因本刀上涨。

## Capabilities

### New Capabilities

- `plugin-rack-visual-strip-v1`: 插排页的可视化呈现合同：Host 条、3 可插拔插座、9 封口插座、禁止假按钮。

### Modified Capabilities

- `plugin-rack-real-install-loop-v1`: Rack UI 场景从「卡片」改为「插座」；可写按钮集合不变（Notes + Claude + Project Map）。

## Impact

- Frontend：`PluginRackSection.tsx`、`PluginRackSection.test.tsx`、`src/styles/extensions.css`、`extensions-layout.test.ts`、`src/i18n/locales/{en,zh}/sidebar.ts`
- Docs：`docs/prototypes/plugin-rack-visual/`、`16-progress-dashboard.md`、`09-decision-log.md`（D-053）
- Backend / allowlist / lockfile：**无改动**
