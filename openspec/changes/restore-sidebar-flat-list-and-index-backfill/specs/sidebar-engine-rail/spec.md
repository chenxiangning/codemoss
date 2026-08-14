## REMOVED Requirements

### Requirement: Sidebar MUST group sessions into per-engine rails

**Reason:** engine rail 外观被用户判定为回归，恢复扁平混排列表（`restore-sidebar-flat-list-and-index-backfill` D1）。

**Migration:** 删除 `SidebarEngineRail` 组件、`sidebarEngineRail` utils、`sidebar.engine-rail.css` 及 `Sidebar.tsx` 内全部 rail 状态与过滤；`mossx.sidebarEngineRail.*` localStorage key 废弃（无需清理）。数据层 Session Index 不变。
