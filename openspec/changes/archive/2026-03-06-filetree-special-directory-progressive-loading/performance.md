# 5.2 性能对比记录（filetree-special-directory-progressive-loading）

## 测试日期
- 2026-03-06

## 测试目标
- 对比“旧策略（全量扫描特殊目录）”与“新策略（特殊目录仅保留节点、展开后按层加载）”在大 `node_modules` 场景下的首屏扫描成本。

## 测试环境
- Workspace: `codex-2026-03-06-v0.2.4`
- 路径: `/Users/chenxiangning/Library/Application Support/com.zhukunpenglinyutong.codemoss/worktrees/d029a8f4-f4ba-4be1-8fad-8fa3096f8f2e/codex-2026-03-06-v0.2.4`
- 采样次数: 每组 5 次（同机同路径）
- 上限: `max_files = 100000`

## 测量方法
- 使用脚本模拟两种扫描模式并保持同一上限：
  - old_full_scan: 不裁剪特殊目录，递归全量扫描。
  - new_progressive: 命中特殊目录时只保留目录节点，不递归其子树。
- 统计指标：
  - 脚本内部扫描耗时（`elapsed_ms`）
  - 进程最大常驻内存（`/usr/bin/time -l` 的 `maximum resident set size`）
  - 首屏返回规模（files/directories）

> 说明：该记录用于验收“策略收益”与回归基线，属于任务 5.2 的发布守卫留痕。

## 原始结果摘要

### old_full_scan（5 次）
- files: 96843
- directories: 9309
- elapsed_ms: `746.47`, `374.99`, `380.50`, `376.04`, `376.86`
- max RSS: 18.69 MB ~ 19.12 MB（平均 18.08 MB）

### new_progressive（5 次）
- files: 963
- directories: 202
- pruned_special_roots: 5
- elapsed_ms: `6.51`, `6.33`, `6.27`, `6.34`, `5.81`
- max RSS: 16.73 MB ~ 16.86 MB（平均 16.02 MB）

## 对比结论
- 首屏扫描耗时（平均）：
  - old: 450.97 ms
  - new: 6.25 ms
  - 提升约 `72.13x`（含首轮冷缓存）
- 首屏扫描耗时（去掉首轮后）：
  - old: 377.10 ms
  - new: 6.19 ms
  - 提升约 `60.95x`（更接近稳定态）
- 首屏返回体量：
  - files 从 96843 降到 963（约 `99.01%` 下降）
  - directories 从 9309 降到 202（约 `97.83%` 下降）
- 内存：
  - 最大常驻内存从平均 18.08 MB 降到 16.02 MB（约 `11.39%` 下降）

## 验收判断（任务 5.2）
- 满足“记录性能对比（大 node_modules 场景）”要求。
- 结果显示首屏扫描峰值显著下降，符合“峰值下降或卡顿时间缩短”验收条件。

