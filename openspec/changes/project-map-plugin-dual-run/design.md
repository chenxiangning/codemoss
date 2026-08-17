# Design

对标 4H 的 `NotesCompatAdapter` 调用面收口，**不对标**当前 Notes 默认 isolated sqlite。5C 门面保持单 owner；本刀只补 delegate 与命令入口分发。

## 门面 delegate（无第二实现）

24 条产品命令把 Core 逻辑抽成 `pub(crate)` 内部函数（`project_map_read_core` 等）。`ProjectMapCompatAdapter::core()` 构造单 owner 门面，24 个 delegate 直接调这些内部函数：

```text
ProjectMapCompatAdapter::core().read_map(...)
  → crate::project_map::project_map_read_core(...)
```

`owner()` 恒为 `ProjectMapCompatOwner::CoreProjectMap`。`ProjectMapBackend` / `MemoryProjectMapBackend` 保持 5C 原样（门面自检 fixture），不扩展到 24 条命令、不承担生产 delegate。

5C 已有的 `read()` 仍只读内存 snapshot，避免与产品 `read_map` 重名。

## 命令入口分发

```text
project_map_read(...)
  → if project_map_compat_facade_enabled() {
        facade.core().read_map(...)
    } else {
        project_map_read_core(...)
    }
```

flag `MOSSX_PROJECT_MAP_COMPAT_FACADE` 默认 off，所以 24 条命令走与当前完全一致的 Core 路径；on 时经 facade 调到同一个 Core 内部函数（无递归：facade 调 `*_core`，不调命令入口）。

## 不做的（本刀边界）

- 不 activate / dispatch / 接插件 storage / 迁 `~/.ccgui/project-map*` / `project-memory`。
- 不删任何 Core 文件（Slim 是 step 8，禁止）。
- 不默认开 flag、不开 Marketplace、不给 browser / canvas / 其余 CLI 套模板。
- 不做 Conformance / Disable / D-052 真实装/卸（5E–5G）。
