# Proposal: plugin-storage-retain-ceiling

> Wave：1AT（Storage · retainPrevious=5 合法上限）  
> 依赖：checkpoint retain 范围 1–5

## Why

组合面已拒 `retainPrevious=0` / `6`。尚未独立验收合法上限 5。1F 后不得把合同上限一并误杀。

## 边界

1. Ready Notes 调用 `checkpoint_own_store_retained(..., 5)` MUST 成功。
2. 不进 boot，不迁 `note_cards`。

## Capabilities

- `plugin-storage-retain-ceiling-v1`
