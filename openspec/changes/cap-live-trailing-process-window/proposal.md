# cap-live-trailing-process-window

## Why

`message-process-phase-collapse` 现行契约只认「assistant 终稿落地」这一个折叠触发点：
trailing in-progress process（终稿之后的 running tool/reasoning）MUST 保持展开。
长 agent 回合里工具/思考交替几十条不出正文时，幕布被 trailing 段刷屏，可读性崩塌。

## What Changes

- 新增 trailing live 段滚动折叠窗口：卡片数超过阈值（5）时，较旧的卡 hard-unmount 进
  `已处理` chip，仅保留末尾 3 张卡展开。
- 计数按幕布卡片口径：连续同类工具合并的「批量」卡（readGroup / editGroup /
  bashGroup / searchGroup）计为 1 张，不按卡内节点计；批量卡折叠/保留均为整体。
- trailing chip 使用稳定 phaseKey（`trailing:<回合边界 item id>`），用户展开态跨帧保留；
  折叠态落位通过 `collapsedAnchorItemId` 停在第一张可见尾卡之前。
- 终稿落地后仍由既有回合级 phase 全量接管，trailing chip 自然消失，无视觉跳变。

## 目标与边界

- **目标**
  1. live 长工具/思考串不再刷屏：超阈值后仅见 `已处理` chip + 最新 3 张卡。
  2. 阈值/窗口语义按用户可见卡片计，批量卡不被误计为多步。
  3. 不破坏既有回合级折叠契约与展开/收起交互。
- **边界**
  - 仅 `resolveCollapsedTimelineItems` trailing 分支、投影落位与类型透传。
  - 阈值 N=5 与保留 K=3 为实现内常量。

## 非目标

- 不把 N/K 暴露为设置项，不按 engine 分化。
- 不把卡片计数口径扩散到 chip 的 `已处理 · N 步` 细账统计（仍按节点计）。
- 不改回合级 phase 的归属、合并与孤儿吸收逻辑。
- 不改 shell 隐藏、reasoning 合并等上游过滤管线。

## Capabilities

### Modified Capabilities

- `message-process-phase-collapse`：trailing in-progress process 由「一律保持展开」
  修订为「阈值内保持展开，超阈值按滚动卡片窗口折叠」。
