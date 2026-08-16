# Claude Conformance Gaps（Wave 3AO）

> pluginId：`com.mossx.engine.claude`  
> 状态：**inventory-only**。本刀不补产品测、不开 flag、不删代码。

## 五轴

| 轴 | 状态 | 含义 |
|---|---|---|
| interrupt | 调用面已齐 | GUI / daemon 走 `interrupt_claude_*`，不是产品验收 |
| stream | 缺产品验收 | 事件映射有门面，没有 flag-on stream 验收 |
| storage | 仅 Host fixture | 产品 history 仍是磁盘 JSONL |
| rollback | 缺产品验收 | 没有插件 generation / LKG 回退 |
| first-interactive | 缺产品验收 | boot 不激活 Claude |

## 禁止

把调用面断言当成 conformance 完成。从 3AO 跳到默认开 flag、删 `engine/claude*`、开 Marketplace。
