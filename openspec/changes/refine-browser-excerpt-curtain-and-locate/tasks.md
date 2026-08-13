# Tasks: refine-browser-excerpt-curtain-and-locate

## 1. 幕布 / composer 细线折叠

- [x] 抽出 `BrowserExcerptFold`，摘要卡与 composer 预览共用
- [x] 默认一行标题，点行展开全文；正文与标题相同时不重复印
- [x] MessageRow 对摘录走满宽左齐（`has-browser-excerpt`）
- [x] 展开区展示发送细节（文档坐标、视口、列表、邻居、路径、元素）
- [x] i18n 补 excerpt / locate 文案

## 2. 选择去重与点选颗粒度

- [x] `selectorHint + normalized text` 原地替换
- [x] 展示/prompt 对已堆叠重复 keep-first
- [x] 选择器 promote 到内容块；保留 tag/role/像素/doc debug

## 3. 指哪 locate 进模型

- [x] 选择器采集 `BrowserSelectionLocate`
- [x] annotation 持久化并 sanitize 邻居文案
- [x] `copySafeText` + `usageHint` 写入 v2 prompt
- [x] 无 locate 的旧 annotation 由 region+scroll 回推文档坐标

## 4. 验证

- [x] `npx vitest run src/features/browser-agent src/styles/messages-context-stack.test.ts`（87 passed）
- [x] `cargo test --lib browser_agent::toolbar::tests`（selector 相关绿）
- [ ] 手测：点选 → composer 细线 → 发送 → 展开发送细节（用户已确认总体 OK）
- [ ] typecheck 在提交前按变更范围复核

## 5. 提交卫生

- [x] 只 stage 摘录相关文件，排除 Dock tab 右键菜单 working-tree
