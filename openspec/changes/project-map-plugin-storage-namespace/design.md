# Design

`open_project_map_namespace(root)` 封装 `DiskStorage::open_plugin("com.mossx.project-map", "1.0.0", "1.0.0", 1)`。schema 来自 Pilot fixture `storage.schemaVersion=1`。不解析用户文件。

map / relations / memory 仍是 Core 文件目录；本刀只证明隔离插座存在。下一刀（5E2）才允许在隔离库上做读写合同，仍不得迁产品目录。
