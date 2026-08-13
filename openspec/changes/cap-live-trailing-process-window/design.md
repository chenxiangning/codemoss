# cap-live-trailing-process-window — Design

## 触发与窗口

```
trailing 段 = 最后一条 user/assistant 正文边界之后的 collapsible process items
卡片序列   = groupToolItems(trailing 段)   // 批量卡 = 1 张
IF 卡片数 > TRAILING_PROCESS_COLLAPSE_THRESHOLD (5):
    隐藏 = 前 (卡片数 - TRAILING_PROCESS_VISIBLE_TAIL_COUNT) 张卡的全部节点
    保留 = 末尾 3 张卡展开
终稿落地 → 既有回合级 phase 全量接管，trailing chip 消失
```

N/K 只控制 trailing live 段的触发与保留窗口（代码常量注释已注明设计边界），
不复用到回合级折叠、chip 统计口径或其它折叠逻辑。

## 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 计数口径 | 幕布卡片（`groupToolItems` 后的 entry） | 与用户可见行数一致；批量卡不算多步 |
| chip phaseKey | `trailing:<回合边界 item id>` | 跨帧稳定，`expandedPhaseKeys` 展开态不丢 |
| 折叠态落位 | `collapsedAnchorItemId` = 第一张可见尾卡 | 无正文锚点时 chip 停在尾卡之前而非 rows 末尾 |
| 展开语义 | 展开时隐藏卡全量 remount；再收起回到窗口态 | 与既有 phase 展开交互一致 |
| 统计口径 | chip「已处理 · N 步」仍按节点细账 | 阈值口径不扩散（用户明确确认） |

## 性能

沿用既有 hard-unmount 模型：折叠时隐藏节点从 timeline 剔除，React 树释放；
展开时 remount，无长期实例缓存。滚动窗口使 live 长回合的挂载节点数有上界。
