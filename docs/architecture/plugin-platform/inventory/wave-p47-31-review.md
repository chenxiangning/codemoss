# Wave P4.7-31 Self-Review

> 日期：2026-08-17  
> 范围：Wave 5B 第三根插头 Contract  
> 结论：**方向正确。只写 `com.mossx.project-map` Pilot fixture。过渡仓仍是 1 view 门面。不接 Host。不 Slim。**

## 做了

- OpenSpec change `project-map-plugin-pilot-manifest`
- `packages/plugin-contract/fixtures/valid/project-map-pilot.json`
- parser 接受 24 条 command + view + memory panel；拒绝 template command
- 缺口链补 4b

后续：5C Adapter 已落地。下一刀 Dual-run，不改本 fixture 的产品行为。

## 没做（有意）

- 不改 `project_map*` / `project_memory*` 生产行为
- 不把 `@mossx/plugin-project-map` 升级成独立实现
- 不撑胖过渡仓 `plugin.json`
- 不搬 memory-pick conversation inject
- 不迁 intent-canvas / Search / AppShell
- 不激活 Host，不开 Marketplace
