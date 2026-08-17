# Tasks

## 1. Artifacts

- [x] 1.1 落盘 proposal / design / spec（本文件）
- [x] 1.2 `openspec validate plugin-rack-visual-strip --strict`

## 2. Prototype

- [x] 2.1 写 `docs/prototypes/plugin-rack-visual/index.html`：引用 tokens，3 座可点、9 座封口

## 3. Product UI

- [x] 3.1 `PluginRackSection` 改为 live bank + later bank 插座，按钮仍仅 3 个
- [x] 3.2 `extensions.css` 增加 strip / bank / socket / well 样式，只用已有 token
- [x] 3.3 同步 en/zh `extensions.rack` 文案（可插拔仓 / 只读仓 / 封口）

## 4. Verify + docs

- [x] 4.1 更新 `PluginRackSection.test.tsx` 与 `extensions-layout.test.ts`
- [x] 4.2 更新 `16-progress-dashboard.md` Rack 可视化 ~100%，`09` 记 D-053
- [x] 4.3 focused vitest + `openspec validate --strict`；无 Slim / 无 Marketplace
