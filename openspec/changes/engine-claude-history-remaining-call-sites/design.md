# Design

只写 inventory。产品 list/load/hydrate/fork/delete/rewind/catalog/native resolve 已走门面。残留分三类：门面自身委托、catalog 类型与常量、session index 的 `encode_project_path`。后者不是 history 操作，不能当漏接。
