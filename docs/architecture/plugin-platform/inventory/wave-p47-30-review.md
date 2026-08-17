# Wave P4.7-30 Self-Review

> 日期：2026-08-17  
> 范围：Wave 5A 第三根插头 Inventory  
> 结论：**方向正确。只盘点 `com.mossx.project-map`。re-export 不是抽出。不 Slim。**

## 做了

- OpenSpec change `project-map-plugin-pilot-inventory`
- `inventory/project-map-pilot.json` + md
- 缺口链补 4a：知识地图已盘点

后续：5B Contract、5C Adapter 已落地。inventory `status` 仍必须是 `inventory-only`。下一刀是 Dual-run，不是改本文件。

## 没做（有意）

- 不改 `project_map*` / `project_memory*` 生产行为
- 不把 `@mossx/plugin-project-map` 升级成独立实现
- 不搬 memory-pick conversation inject
- 不迁 intent-canvas / Search / AppShell
- 不激活 Host，不开 Marketplace
