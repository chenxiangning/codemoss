# Design

## Context

当前产品：

- Host boot `enabled=false` + `missing_executable()`。一般 `activate` 返回 `host-disabled`。
- `Host::uninstall` / `PluginRuntime::uninstall_plugin` 已在测试里把 slot 打到 `Uninstalled`，但产品没有 `install_plugin` 命令。
- 插排只读 12 根插头。Notes 产品路径是隔离 sqlite（`MOSSX_NOTES_COMPAT_FACADE` 未设即 on），Host slot 仍 idle。
- P4.7-29 禁止 registry 出现 `install_plugin`，是为了挡住 Marketplace。本刀用 D-050 把它改成「允许 Notes allowlist，仍禁止市场」。

Notes 的 Manifest entry 是 QuickJS worker + trusted-react UI，不是 Process Entry。`QuickJsWorkerDriver` 默认 catalog 已含 `notes-worker`。allowlisted activate 会拉起真实 isolate；`RestrictedProcessDriver` 对 Notes 是 no-op（不在 process catalog）。卸载会 `driver.stop` 拆掉 isolate。

## Goals / Non-Goals

**Goals:**

- 产品路径上 Notes 能真实安装/卸载，状态过重启。
- 插排缺陷补成「Notes 可写，其余只读」。
- 把 lockfile + contribution registry + allowlist 命令做成后续插头的模板。

**Non-Goals:**

- Slim、Marketplace、Claude 第一刀、project-map 5B。
- Host 全局启用。
- 把 Notes 数据面从 Core 进程迁到独立 worker.js（worker isolate 只承担 Host 生命周期，CRUD 仍走隔离 sqlite）。

## Decisions

### D1. 第一根闭环插头 = Notes，不是 Claude / hello

Claude 卸载会拆默认 CLI。hello demo 不能当产品模板。Notes 已有隔离 sqlite、fixture Manifest、Host uninstall 测试。

### D2. 持久态用 disk lockfile，不用 localStorage

路径：`~/.ccgui/plugin-lockfile.json`（`app_home_dir()`）。Schema：

```json
{ "version": 1, "plugs": { "com.mossx.notes": { "desired": "installed" } } }
```

缺文件：Notes 视为 `installed`。写盘用 temp + rename。测试注入路径，禁止写用户 home。

备选：只记内存。拒绝，重启即丢，不是真卸载。

### D3. Host 保持 default-off，另开 allowlisted activate

`activate()` 仍检查 `enabled`。新增 `prepare_install`（`Uninstalled` → `Idle`）与 `activate_allowlisted`（跳过 enabled，仅编排层调用）。Boot 一般激活仍拒绝 Claude。

备选：boot 把 `enabled=true`。拒绝，Claude process catalog 会在误 activate 时碰到 `missing_executable()`。

### D4. contribution registry 原子替换

`notes.main` + 7 个 `note_card_*` 一次 `register` 或一次 `revoke`。半注册视为失败并回滚。Rack 用它报 `contributionsLive`。

### D5. 命令挂在 `plugin_rack`，不进 `plugin_runtime` 的 registry 路径

`boot.rs` 断言 `command_registry` 不含 `plugin_runtime` / `activate_plugin`。`install_plugin` / `uninstall_plugin` 放 `plugin_rack.rs`，内部调 runtime。

### D6. 卸载闸门在 `note_card_*`，不删 `*_core`

默认 facade on + lockfile uninstalled → 返回 `plugin-uninstalled`。显式 `0` 跳过闸门走 `*_core`。sqlite 文件不删。

### D7. 产品 restore 在 `lib.rs` setup，`boot_host()` 本身不激活

单元测试里的 `boot_host()` 仍全 idle，避免每个 Host 测试拉 QuickJS。产品 setup 调 `restore_allowlisted`。

## Risks / Trade-offs

- [Risk] 用户以为卸 Notes 会删笔记 → Mitigation：卸载不删 sqlite；文案写「停用插头，保留数据」。
- [Risk] 卸载后 UI 仍打开笔记页 → Mitigation：命令 fail closed；后续插头模板再收 view 路由。本刀以命令闸门为准。
- [Risk] lockfile 写坏导致 Notes 消失 → Mitigation：缺文件/损坏读取按 Notes installed，避免砖产品；install/uninstall 会重写。
- [Risk] 被读成 Marketplace 已开 → Mitigation：D-050 写死 11 根只读；footnote 仍写远程市场关闭。
- [Trade-off] Notes CRUD 仍在 Core 进程的隔离 sqlite，不是独立 worker.js。Host isolate 证明生命周期真实，数据面仍是 Dual-run 后的产品路径。诚实，不装抽出。

## Migration Plan

1. 默认无 lockfile：行为与今天一致（Notes 可用）。
2. 用户点卸载：写 lockfile，restore 后不再激活。
3. 回滚：删 `plugin-lockfile.json` 或装回 Notes；源码与 `0` 回退仍在。

## Open Questions

无。D-050 豁口与第一插头已在探索轮拍板。
