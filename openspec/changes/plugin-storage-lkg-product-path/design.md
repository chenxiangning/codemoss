# Design

把 LKG 骨架接到 D-052 三根插头的产品 install/restore。不 Slim，不改 Host `enabled`。

## 两个 lock 文件

| 文件 | Owner | 含义 |
|---|---|---|
| `~/.ccgui/plugin-lockfile.json` | 产品插排 | desired-state（装/卸） |
| `~/.ccgui/plugin-lock.json` | 本刀 LKG | per-`pluginId` artifact + checkpoint pin |

`LkgLedger` 已是 `BTreeMap<pluginId, LkgPin>`。一根插头一个 pin。

## Durable root

`DiskStorage::open(root)` 在 `root/plugin-runtime/{data,checkpoints}` 落库，`LkgLedger::load(root)` 读 `root/plugin-lock.json`。

产品 boot 必须把 `root` 设成 `app_home_dir()`（`~/.ccgui`），不能再用每次唯一的 temp。

| 入口 | root | 原因 |
|---|---|---|
| `boot_host()` | 唯一 temp | 现有 boot 测试不能污染 `~/.ccgui` |
| `boot_host_at(root)` | 注入 | 产品 setup 注入 app home；单测注入 temp |
| `lib.rs` setup | `app_home_dir()` → `boot_host_at` | 失败则回退 `boot_host()` 并 warn |

## 产品路径

```text
install_allowlisted (Ready)
  → establish_own_lkg(pluginId, "1.0.0")
       无 pin → adopt store → checkpoint → protect → commit pin
       有 pin 且 store 不健康 → restore_pinned(checkpoint 文件)
       有 pin 且 store 健康 → 保留 pin，不重写
  → register contributions
  → product_set(Installed)

uninstall → product_set(Uninstalled) + revoke
            不得删 plugin-lock.json 条目，不得删 sqlite / checkpoint
```

`restore_allowlisted` 对 Installed 走同一 `install_*`，因此 reboot 自动 heal。

## Health 诚实口径

| 插头 | 健康定义 | 不是 |
|---|---|---|
| Notes / Project Map | 隔离 sqlite 可读且 `schema_version == pin.schemaVersion` | 产品 `note_card/` / `project-map/` 旧目录 |
| Claude | slot Ready + bookkeeping sqlite 可读且 schema 匹配 | Claude 会话 JSONL / CLI transcript / schema-migrate 业务库 |

Claude 没有 Notes 那种产品 schema-migrate。本刀只给它 bookkeeping namespace，避免假装会话数据有 LKG。

## Reboot 后内存 namespace 是空的

`StorageService` 是进程内的。重启后 `open_plugin(..., schema=1)` 会把已有 sqlite 的 `schema_version` 写成 1。

因此必须：

- `adopt_plugin`：文件已在则读盘上 schema，只补内存 namespace，不覆盖。
- `restore_pinned`：直接把 `{root}/plugin-runtime/checkpoints/{id}/{ckpt}/store.sqlite` 拷回 data 文件，不依赖内存 checkpoint 列表。

## 取舍（相对 proposal 选项 B/C）

首次 install 走 establish，不走 `stage_own_update`。stage/complete 仍留给真正的版本更新。本刀不实现产品「升级按钮」。

## 风险

- `~/.ccgui/plugin-runtime/` 开始出现真实文件。这是产品路径的本意，不是泄漏。
- app home 解析失败时 LKG 无法跨进程存活；必须 warn，不得把 Host 关掉。
- 不得把 P2.6 / P2.7 勾完。
