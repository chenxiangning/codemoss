# Design: bound-session-management-default-scan

## Scan mode

`WorkspaceSessionCatalogQuery.scanMode`:

- omitted / `bounded` → `SessionCatalogScanMode::Bounded(page+lookahead)`
- `exhaustive` → `Exhaustive`（仅用户确认后的「扫描全部」）

`keyword` / `folder` / `archived` **不再**隐式升 Exhaustive。

## Surfaces

| 入口 | 默认 | Exhaustive |
|------|------|------------|
| Settings list (`limit=100`) | Bounded | 按钮 + confirm |
| Projection summary | Bounded(`SESSION_CATALOG_DEFAULT_LIMIT`) | 同上 query |
| Sidebar hydrate | 不走 catalog Exhaustive | 禁止 |
| Mutations | 保持 Exhaustive | n/a |

## UI

复用 `sourceStatuses[].scanCapReached`：提示「可能未扫全」+「扫描全部」+「取消」（reload Bounded）。
