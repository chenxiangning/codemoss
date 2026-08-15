# Staged Program Checkpoint（连续推进）

> 日期：2026-08-16  
> 分支：`feature/plugin-mossx-0.8.9`  
> 结论：**合同平面继续加厚。总目标未完成。** 产品路径零变化。不要把本 checkpoint 当成可以删 Core 的绿灯。

## 已落地（按 Wave）

| Wave | 状态 | 最后提交锚点 |
|---|---|---|
| 0 inventory + parser | 完成 | `c71258117` |
| 1A–1D 内存插排 | 完成 | `a3f7cab1b` |
| 1D2 fuse 后 Broker 拒绝 | 完成 | `00c750cbe` |
| 1B2 Host disable 原语 | 完成 | `de6533cc4` |
| 1E–1E6 transport / Data Plane / UDS MXPD | 完成 | `1ce36abdc` |
| 2A–2C Storage + caller 闸门 | 完成 | `a2ea46e80` |
| 3A–3F Claude 插头前半 + fixture disable | 完成（未删实现） | `ba496f762` |
| 4A–4F Notes 门面 + fixture disable | 完成（未迁表） | `7c746feea` |
| 1G–1I 组合面 / 默认 off / 双插头隔离 | 完成 | `e87156c7d` |
| 2D disable 撤销 store | 完成 | `672025d0e` |
| 3G Claude 组合面 disable | 完成（未删实现） | `094ff98fb` |
| 4G Notes 组合面 disable | 完成（未迁表） | `bf6a85972` |
| 1J 组合面 fuse | 完成 | `54b748d3a` |
| 1K command 面隔离 | 完成 | `a56aad1c3` |
| 1L fuse 后 reset 恢复 | 完成 | `06ade989d` |
| 1M 旧 generation 失效 | 完成 | `fab30c466` |
| 2E–2G storage Ready 闸门 | 完成 | `098c48763` |
| 2H–2K migrate 组合面闸门 | 完成 | `cc1afd8cb` |
| 2L 组合面跨插件 store 隔离 | 完成 | `ab6a81b2e` |
| 2M 组合面无 checkpoint 不得 restore | 完成 | `6c35ab547` |
| 1N 组合面拒绝非法 Host 预算 | 完成 | `402c6bd41` |
| 2N 组合面 retainPrevious 1–5 | 完成 | `632974f45` |
| 1O 组合面空 required_entries 失败 | 完成 | `18e28d75e` |
| 2O migrate from 必须匹配 | 完成 | `b1c195b30` |
| 2P disable 后不得 access_store | 完成 | `0e35361ef` |
| 2Q fuse 后不得 access_store | 完成 | `28bddf2ed` |
| 2R fuse 后 reset 恢复 access_store | 完成 | `154526f6f` |
| 2S fuse 后不得 checkpoint | 完成 | `e86b72f1a` |
| 2T fuse 后不得 migrate | 完成 | `2bd315d09` |
| 2U fuse 后不得 restore | 完成 | `ffceaf838` |
| 2V 从未 activate 不得用 store API | 完成 | `386ca9c69` |
| 2W Host 默认 off 不得用 store API | 完成 | `52c7e9364` |
| 1P Host 默认 off 不得 query / stream | 完成 | `d4b5dc8c7` |
| 1Q 从未 activate 不得 query / stream | 完成 | `e9abb304f` |
| 1R 组合面拒绝 write / spawn | 完成 | `275ab6173` |
| 1S 组合面拒绝未知 capability | 完成 | `04b9de9b0` |
| 1T 激活失败后不得拿 handle | 完成 | `8e627c6c4` |
| 1U entry crash 后不得拿 handle | 完成 | `ed2923a93` |
| 1V Failed 后 reset 恢复 handle | 完成 | 本刀 |

## 明确未做

1. QuickJS / Restricted Process spawn（1F）
2. Windows Named Pipe
3. Host 挂进 `lib.rs::run`
4. Claude / Notes **产品**切流（flag 仍默认 off）
5. 用户数据导入
6. Marketplace

## 进度

相对「Core + 可撤销插件平台」全文约 **72%**（合同/插座组合面/disable+fuse+reset/storage 闸门/Host off/只读 Broker/失败激活恢复）。  
相对「产品已拔插头」约 **0%**。
