---
type: architecture
status: active
---

# 02 · Evidence Cross Review

> 主线入口：[Client Modernization](README.md)
> 输入来源：`/Users/chenxiangning/Downloads/性能问题审查报告/` 下的 `codex.md`、`deepseek.md`、`grok.md`、`kimi.md`、`最终汇总说明.md`。原始报告位于仓库外，不作为长期事实源。

## 1. 审查方法

五份报告并非五个独立基准：它们观察的版本、代码行号、运行环境和形成时间不同，部分内容彼此转述。本文不复制长篇原文，而是把每条独立观点映射成：

```text
source claim
  → cross-report consensus / disagreement
  → current HEAD verification
  → evidence class
  → status
  → executable workstream
```

### Evidence Class

| 等级 | 含义 |
|---|---|
| E0 | 报告推断，没有可复核代码或 runtime evidence |
| E1 | 当前代码静态证据支持，但未运行测量 |
| E2 | 历史测量或历史 incident，有明确日期/version/commit |
| E3 | current HEAD 同机可重复 runtime evidence |
| E4 | packaged cross-platform / CI release matrix evidence |

### Status

- `still-present`：当前代码仍能确认该机制存在；
- `mitigated`：已有限制或旁路，但根因未完全消失；
- `fixed-needs-regression`：已有修复，尚缺完整 current matrix；
- `historical-only`：只描述历史版本；
- `stale`：被当前实现推翻；
- `unmeasured`：合理候选，但没有 current runtime 证据。

## 2. 报告总体共识

五份报告对长会话根因高度一致：

1. 高频 reasoning/toolOutput delta 仍可能进入较高层状态更新；
2. streaming Markdown 的主要成本来自 accumulated text 的重复全量解析；
3. 超大静态 timeline window 让 DOM、projection 与更新成本随历史增长；
4. grouping/projection/selector 缺少真正的 incremental boundary；
5. 已落地 live text externalization、event-driven task store 等措施应被保留；
6. 需要 current same-machine benchmark，不能继续引用旧实验数值作为完成证明。

对冷启动，报告能提供大量线索，但最新版代码和事故记录显示必须重新分层：一些旧方案已失效，一些新的 native 根因在报告形成后才暴露。

## 3. Claim-to-current Matrix

| ID | Source claim | 交叉审查 | Current HEAD 校准 | Evidence | Status | Workstream |
|---|---|---|---|---|---|---|
| E-01 | reasoning/toolOutput 约每 32ms flush 并进入 reducer | 多报告一致 | `REALTIME_DELTA_BATCH_FLUSH_MS=32` 与对应 operation 仍可见 | E1 | still-present | W4 |
| E-02 | assistant text 已完全脱离 reducer | 部分报告过度概括 | live text channel 已外置；reasoning/toolOutput 并未等价外置 | E1+E2 | mitigated | W4 |
| E-03 | Markdown 已 incremental render | 报告存在表述差异 | staged render 是 lightweight path；full runtime 仍使用 `react-markdown`，不是 block-level incremental parser | E1 | still-present | W5 |
| E-04 | Prism highlight 是主要根因 | 仅部分报告强调 | 现有 4000-entry LRU 能限制缓存；highlight 仍可能重，但不是 accumulated parse 根因 | E1 | mitigated | W5 |
| E-05 | timeline 已 virtualization | 报告有误读 | `VISIBLE_MESSAGE_WINDOW=10000`、streaming window 0、virtualization false，仍接近 full static DOM | E1 | still-present | W6 |
| E-06 | DeepSeek Harness 永远只渲染 50 个 DOM row | 多报告引用 | 正确含义是默认 data window 50；已加载 rows 仍渲染，并非 chat virtualization | E0/E1 | corrected | W6 |
| E-07 | 全量 grouping/projection 是长会话放大器 | 多报告一致 | 当前架构仍需 current profiler 定量，但静态结构支持该候选 | E1 | unmeasured | W7 |
| E-08 | row memo 已解决列表更新 | 报告结论不一 | memo 是补偿层，无法消除上游全量派生与 identity churn | E1 | mitigated | W7 |
| E-09 | persistence 应 append/suffix，而非全量重写 | DeepSeek Harness 借鉴点 | Mossx 需要先采 I/O 与 schema evidence，再决定 packed rows/append log | E0/E1 | unmeasured | W8 |
| E-10 | provider-aware compaction 可控制上下文 | 多报告认可 | 是 Engine Plugin/Session policy 候选，不能与 UI 隐藏历史混为一谈 | E0 | proposed | W8 |
| E-11 | AppShell 已拆分，因此 root render 已解决 | 部分报告推断 | governance splitting 已落地，但真实 host/key、render duration 和 `<30ms` 目标未重测 | E1 | unmeasured | W3/W7 |
| E-12 | 2026-07-08 root render 100-350ms 是当前值 | 汇总引用 | 这是有日期的历史实验；不得作为 current baseline | E2 | historical-only | W0 |
| E-13 | FPS 39→55-58 证明当前流畅 | 历史实验引用 | 只能证明当时实验方向有效 | E2 | historical-only | W0 |
| E-14 | Windows 冷启主要是 WebView/UI scale | 旧报告集中讨论 | 当前已知更深 native stack overflow；UI scale 当前锁定 100% | E1+E2 | stale/partial | W1/W3 |
| E-15 | Windows 应继续 native zoom，macOS 禁用 | 旧版本策略 | current `applyUiScale` 固定 identity 并清理残留 scale，旧平台分流不再是现状 | E1 | stale | W3 |
| E-16 | packaged Windows startup 可能是 native crash | 报告未覆盖最新事故 | 已出现 `0xc00000fd/__chkstk`，deep future pin + 8MB stack 已修 | E2 | fixed-needs-regression | W1 |
| E-17 | full Composer mount 会让冷启首交互冻结 | 历史诊断支持 | `ComposerGate` / `ComposerLight` 已延迟 full Composer | E1+E2 | mitigated | W3 |
| E-18 | 启动时全量 engine/catalog/history scan 争抢资源 | 多报告与现有文档一致 | orchestration 已有多项限制，但 full-catalog/residual work 需要 current trace | E1/E2 | mitigated | W2 |
| E-19 | diagnostics/watchdog 会形成反馈环 | 多报告指出 | blank screen watchdog 当前有 15s start delay；durable write/layout 行为仍需故障注入检查 | E1 | mitigated | W2/W6 |
| E-20 | bundle/CSS/i18n/Tooltip 是冷启主因 | 某些报告排序靠前 | 已完成一批优化；它们是成本项，不足以解释 native crash | E1/E2 | mitigated | W2/W3 |
| E-21 | 100k reasoning chunks browser stress 应达 250ms | Harness 借鉴 | 原要求是严格 `<250ms`；场景需转换为 Mossx fixture 后再纳入 gate | E0 | proposed | W10 |
| E-22 | 换 state library/Cordis 可直接解决 | 个别建议 | 缺乏 Mossx current profiler 证明，且迁移风险大 | E0 | rejected-default | W7 |
| E-23 | 再加 debounce 能止住长会话 | 常见局部方案 | 只能限频，不能改变 O(history) 工作量 | E1 | rejected-root-fix | W4-W7 |
| E-24 | content-visibility/tail window/summary wall 应恢复 | 旧实验可能诱导 | 与当前统一幕布、滚动所有权和产品行为存在冲突，不作为第一解 | E1/E2 | rejected-default | W6 |

## 4. DeepSeek Harness 可迁移机制

借鉴目标是机制，不是源码平移。

| Harness 机制 | Mossx 可吸收部分 | 不应照搬部分 |
|---|---|---|
| Session data window 默认 50 + load older | bounded loaded history、semantic prepend、anchor preservation | 把 50 当 universal constant 或宣称已 virtualization |
| per-node selector | row-level subscription、stable identity | 未测量就替换全局 state stack |
| Notifier microtask/rAF | 将 notification 与 render cadence 分层 | 继续把全量 projection 放进每次 notify |
| incremental conversation fold | append/update current node、增量索引 | 重建 Mossx canonical fact schema |
| freeze all but last two Markdown blocks | active tail 增量、settled block freeze | 假设所有 Markdown block 都可安全冻结 |
| delay syntax/KaTeX until settle | live phase 降级、settle phase enrich | 破坏代码/公式正确性或无障碍 |
| suffix persistence / packed rows | append-first I/O、bounded decode | 未完成 migration/rollback 就改 durable format |
| provider-aware compaction | Engine policy、context budget | 用 UI 截断替代 model context semantics |
| browser stress budget | 建立 deterministic fixture 与 regression gate | 把 browser benchmark 当 packaged desktop 全平台证据 |

## 5. 已落地优化的 Non-regression List

后续重构必须显式证明没有回退：

1. debug output bounded buffer；
2. task store event-driven，30s 仅为 fallback，而非秒级 polling；
3. git refresh 在 settle/必要事件触发，而不是流式期间高频刷新；
4. live assistant text 走 external channel，禁止恢复逐 delta reducer dispatch；
5. Composer cold-start gate 保留轻量交互能力；
6. UI scale startup 不允许重新引入不可自救的 native zoom 持久化风险；
7. diagnostics 不得在卡顿时放大同步布局和 durable I/O。

## 6. 报告未覆盖但必须进入任务的风险

- Windows native stack size 与 deep async future frame；
- Extension Host/Plugin Worker 新增进程的 startup fan-out；
- plugin manifest/signature/Registry 的 cold-start 污染；
- per-plugin IPC queue、CPU、memory 和 DOM attribution；
- code rollback 与 plugin data checkpoint 的一致性；
- Safe Mode 绕过第三方 plugin 与 local plugin 的能力；
- session/plugin disable 后 timer、listener、child process、worker、blob URL 和 cache 的释放；
- packaged app 与 dev browser 的差异；
- Windows Defender、签名、磁盘 I/O 与 WebView2 runtime version 的现实噪声。

## 7. 证据缺口

当前最重要的不是继续争论哪份报告更准确，而是补齐以下 E3/E4 evidence：

- 同一 current commit 的 Win/mac packaged cold launch trace；
- native crash/hang dump 与 renderer long-task 时间轴关联；
- first visible、first interactive、first input ack、full Composer ready 分段 marker；
- 200/1k/10k messages 和 100k reasoning chunks 的 deterministic fixture；
- text/reasoning/toolOutput 分类型 event rate 与 reducer/render attribution；
- Markdown parse/highlight/KaTeX 分阶段耗时；
- loaded rows、DOM nodes、heap、IPC backlog 与 session duration 曲线；
- 0/10/50 plugins 安装与激活条件下的 cold-start delta；
- rollback、Safe Mode、Registry offline 与 corrupt checkpoint fault injection。

## 8. 结论

报告最有价值的部分是指出长会话的结构性放大路径，并提供 Harness 的可借鉴机制；最需要校正的部分是把历史实验、旧 uiScale 策略和 data window 误当 current implementation。实施优先级应由 current E3/E4 evidence 决定，而不是由报告篇幅或措辞强度决定。
