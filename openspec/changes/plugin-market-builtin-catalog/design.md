# Design

## 现状

- `PluginRackSection` 已挂在 `appMode === "market"`（`renderAppShell.tsx` marketNode），入口来自侧栏「插件市场」。
- 数据源：`pluginLocalCatalog.ts`（45 个内置包种子）、`pluginRack.ts`（12 个 Host 只读插头）、`pluginLocalStage.ts`（本地 lockfile 安装态）。
- 旧的 `plugin-rack-market-sibling` / `plugin-rack-declared-later-plugs` 约束为「只读、MUST NOT 安装」，本次将其升级为可安装市场。

## 变更

### 前端组件（`PluginRackSection.tsx`）

- 移除「Host 插排只读分组」与「本地过渡仓」双区结构，改为单一「内置插件市场」：
  - `groupByKind(catalog)` 按 `engine / feature` 分组（`KIND_ORDER` 保证顺序），组标题带数量计数。
  - 每张卡片：head 区（displayName + 描述 + pluginId + ownerClass 徽章）+ dl 区（安装状态 / 版本 / 权限）+ 安装/卸载按钮。
- 按钮点击调用 `stageLocalPlugin / unstageLocalPlugin`，`setStagedIds` 与 `setLockfileVersions` 驱动状态刷新，实现卸载后可重装。

### 数据（`pluginLocalCatalog.ts`）

- `CatalogSeed` 与 `LocalCatalogPackage` 新增 `description` 字段，45 个种子全部补中文描述（如 `com.mossx.terminal` → 「终端：内置命令行」）。

### i18n（10 个 `sidebar.ts`）

- `extensions.rack.*` 术语统一：title=插件市场 / catalogTitle=内置插件 / catalogStage=安装 / catalogUnstage=卸载 / catalogInstalled=已安装。
- 补齐 `fr/es/ja/ko/pt-BR/ru/hi/zh-TW` 8 种语言缺失的 `extensions.rack` 段。

### 样式（`extensions.css`）

- 新增 `.extensions-plugin-rack-card-head`、`.extensions-plugin-rack-description`、`.extensions-plugin-rack-badge`、`.extensions-plugin-rack-count`。

### 测试

- `PluginRackSection.test.tsx` 对齐新 UI：分组渲染、描述可见、安装→已安装→卸载→未安装闭环、错误态。
- `pluginLocalCatalog.test.ts` 继续断言 45 包目录与 `plugin.json` 存在（新增 description 字段不破坏断言）。
