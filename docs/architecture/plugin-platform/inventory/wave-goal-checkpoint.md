# Staged Program Checkpoint（goal 8/8）

> 日期：2026-08-16  
> 分支：`feature/plugin-mossx-0.8.9`  
> 结论：**合同平面可独立验收。总目标未完成。** 产品路径零变化。不要把本 checkpoint 当成可以删 Core 的绿灯。

## 已落地（按 Wave）

| Wave | 状态 | 最后提交锚点 |
|---|---|---|
| 0 inventory + parser | 完成 | `c71258117` |
| 1A–1D 内存插排 | 完成 | `a3f7cab1b` |
| 1E–1E5 transport / Data Plane / fuse revoke | 完成 | 本刀 |
| 2A–2B Storage | 完成 | `698030087` |
| 3A–3E Claude 插头前半 | 完成（未 disable） | `d35349fb3` |
| 4A–4D Notes 插头前半 | 完成（未迁表） | `fdd957c17` |

## 明确未做

1. QuickJS / Restricted Process spawn（1F）
2. Windows Named Pipe
3. Host 挂进 `lib.rs::run`
4. Claude / Notes 产品切流与 disable-not-delete
5. 用户数据导入
6. Marketplace

## 进度

相对「Core + 可撤销插件平台」全文约 **40%**（合同/插座/两根插头前半）。  
相对「产品已拔插头」约 **0%**。
