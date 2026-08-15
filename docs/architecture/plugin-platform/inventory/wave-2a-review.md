# Wave 2A Self-Review

> 日期：2026-08-16  
> 范围：`plugin-storage-checkpoint-v1`  
> 结论：**方向正确。Wave 2 未完成。** 下一刀才是隔离目录上的真实 sqlite（2B），仍不得迁 Notes。

## 方向

| 检查 | 结果 |
|---|---|
| 每插件 namespace | 通过。路径含 pluginId |
| 更新前 checkpoint | 通过。无 ckpt → `checkpoint-required` |
| destructive 需确认 | 通过 |
| 旧 reader 打不开新 schema | 通过。`quarantine` |
| 无真实磁盘 | 通过 |
| 未迁 Notes / 未上 UDS | 通过 |

## 颗粒度

2A 只冻结闸门，不写 `app-data/`。这是对的：真实 IO 和合同 bug 必须能分开验。

**留给 2B 的：**

- `plugin-runtime/data/<pluginId>/store.sqlite` 真实文件（测试用 temp dir）
- blobs sidecar
- checkpoint 目录 copy / restore
- 仍禁止碰产品 Notes DB

## 总进度（校准）

规划 ~95%，Wave 0 完成，Wave 1 内存平面完成，Wave 2A 合同完成。  
相对总任务约 **22%**。产品行为仍为 0%。
