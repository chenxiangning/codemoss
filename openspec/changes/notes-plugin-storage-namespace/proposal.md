# Proposal: notes-plugin-storage-namespace

> OpenSpec change id: `notes-plugin-storage-namespace`  
> Wave：4D（第二根插头 · 隔离 namespace）  
> 依赖：Wave 2 DiskStorage + 4C Host 假激活

## Why

Host 已能假激活 Notes，但还没证明 Storage 合同能按 `com.mossx.notes` 落隔离库。若直接改 `note_cards.rs` 会毁掉用户数据。4D 只在**注入 temp 根**打开 namespace 并 checkpoint。

## 目标与边界

1. `notes_storage.rs` 用 `DiskStorage::open(injected_root)` 打开 `com.mossx.notes`。
2. 路径必须是 `plugin-runtime/data/com.mossx.notes/store.sqlite`。
3. checkpoint 后改 schema，restore 回到 1。
4. **禁止**读产品 Notes 目录 / `app_paths` / `note_cards.rs`。
5. 不改 Claude，不进 boot。

## 非目标

- 把现有卡片导入新库
- 产品 command 切流
- disable-not-delete

## Capabilities

- `notes-plugin-storage-namespace-v1`

## 验收标准

1. temp 根下存在 Notes sqlite。
2. restore 回到 checkpoint schema。
3. 源码不含产品 Notes 路径硬编码。
4. `openspec validate` 通过。
