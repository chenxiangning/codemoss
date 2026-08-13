## 1. Importer

- [x] 1.1 `session_index/importer.rs`：间隔 tick、mutex、每 tick 最多 4 工作区
- [x] 1.2 复用 `sync_session_index_core(..., force=false)`
- [x] 1.3 `upserted>0` emit `session-index-imported`
- [x] 1.4 `lib.rs` setup 启动

## 2. Frontend

- [x] 2.1 监听事件，对 workspaceIds first-paint SQLite

## 3. Tests / docs

- [x] 3.1 overlap skip 单测
- [x] 3.2 合同补「外部导入 = 后台」
