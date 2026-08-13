# Change: add-memory-pick-gate

发送前 **项目记忆挑选闸门（Memory Pick Gate）** —— 让库存记忆「看得见、勾得了、关得掉」。

## 一句话

> 用户气泡先待发送 → 其下挑选流 → 本轮手勾或整轮 top(n) 预勾（可改）→ 确认后才调模型。

## 状态（Phase-1）

- [x] Proposal / Design / UX  
- [x] Specs delta / Tasks  
- [x] Implementation  
- [x] 代码二次校准文档回写（2026-08-10）  
- [ ] Commit / Verify / Sync / Archive  

## 文档清单

| 顺序 | 文件 | 内容 |
|------|------|------|
| 1 | [proposal.md](./proposal.md) | Why、边界、Phase-1 验收 |
| 2 | [design.md](./design.md) | 工程 + §22–23 校准与收口清单 |
| 3 | [ux.md](./ux.md) | UI 定稿 |
| 4 | [tasks.md](./tasks.md) | 任务 + commit 清单 |
| 5 | [specs/](./specs/) | 行为合同 |
| 金样 | [memory-pick-gate-ui-variants.html](../../../docs/prototypes/memory-pick-gate-ui-variants.html) | 原型 |

Research：`docs/research/05-project-memory-pick-gate-pointer.md`

## Phase-1 能力摘要

| 项 | 结论 |
|----|------|
| 模式 | pick / always(top n) / dismissed；无 single |
| always | 每轮 UI；预勾 n（默 3，可改）；**以 always 进入 awaiting 才**读秒 8s（交互打断本轮不重启）；记住 n |
| 时序 | 用户气泡 → 挑选流 → 模型 |
| UI | C 布局；顶栏单行+ellipsis；策略/操作虚线框；详情 portal+Markdown |
| 标题 | strip `project-memory-pack` |
| 同步 | 幕布策略 ↔ Composer 菜单 |

## 实现入口

| 区域 | 路径 |
|------|------|
| Send | `useThreadMessaging.ts` |
| Pick | `memoryPick/*` |
| UI | `MemoryPickGate*.tsx` · `memory-pick-gate.css` |
| Composer | `ButtonArea.tsx` · `Composer.tsx` |
| 标题 | `threadItemsUserMessage.ts` |

## 校验

```bash
openspec validate add-memory-pick-gate --strict --no-interactive
openspec status --change add-memory-pick-gate
```
