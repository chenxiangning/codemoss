# Wave 2 Checkpoint Review

> 日期：2026-08-16  
> 范围：2A 内存闸门 + 2B 注入根目录 sqlite  
> 结论：**Wave 2 的合同 + 隔离落盘已闭环。** 仍未迁 Notes，未写产品 `app-data`。下一阶段是 Wave 3 Claude **Inventory**，不是立刻删 `engine/claude*`。

## 已交付

| 刀 | change | 证明 |
|---|---|---|
| 2A | `plugin-storage-checkpoint-v1` | namespace / checkpoint-required / destructive / quarantine |
| 2B | `plugin-storage-sqlite-temp-v1` | temp 根下 plugin-scoped sqlite；restore 覆盖；两插件文件隔离 |

## 方向

| 检查 | 结果 |
|---|---|
| 根目录注入，无产品路径 | 通过 |
| 闸门先于文件 | 通过。`DiskStorage` 调 2A 再 copy |
| 未碰 `note_cards` / session DB | 通过 |
| 未上 UDS / QuickJS / Marketplace | 通过 |
| 未拔 Claude | 通过 |

## 颗粒度

Wave 2 停在「能在隔离目录里回退文件」。没有把 Host 挂进 boot，也没有把 Notes 数据搬过去。这是对的。

**Wave 2 明确不做、不得并进 Wave 3 的：**

- 默认用户 `app-data/plugin-runtime` 生产路径选择
- blobs sidecar 完整实现
- Notes 表迁移

## 下一阶段边界（锁定）

**Wave 3A：`engine-claude-pilot` 的 Inventory-only 刀。**

只标 Claude 的 command / history / adapter / 测试落点与 compatibility adapter 边界。  
禁止：删 Core Claude、双写、把其他 CLI 一并抽出。

拔插头协议第 1 步：Inventory。第 2 步 Contract 另开 change。
