## 1. 连接入口简化（P0）

- [x] 1.1 [P0][depends: none] 移除“Connect a provider”下拉选择 UI。
- [x] 1.2 [P0][depends: 1.1] 删除前端 Provider 预选状态及传参逻辑。
- [x] 1.3 [P0][depends: 1.2] `连接 Provider` 按钮改为仅触发 CLI 原生认证入口（不带 provider 预选）。
- [x] 1.4 [P0][depends: 1.3] 验证 connect 请求 payload 不包含任何 provider 预选字段（id/name/hint）。

## 2. 认证摘要可见性优化（P0）

- [x] 2.1 [P0][depends: none] “已完成认证”区域默认展开。
- [x] 2.2 [P0][depends: 2.1] 增加 icon 分组（状态/已认证 provider/匹配结果）。
- [x] 2.3 [P0][depends: 2.2] 增加关键词着色规则（已连接、未连接、匹配、不匹配）。

## 3. 三个下拉头部改 icon-only（P1）

- [x] 3.1 [P1][depends: none] Agent 区头部文字改为图标。
- [x] 3.2 [P1][depends: none] Model 区头部文字改为图标。
- [x] 3.3 [P1][depends: none] Variant 区头部文字改为图标。
- [x] 3.4 [P1][depends: 3.1,3.2,3.3] 为三处 icon 增加 tooltip 与 aria-label。

## 4. Provider 状态联动文案（P0）

- [x] 4.1 [P0][depends: none] 建立 model 切换过程态（switching/checking/synced）。
- [x] 4.2 [P0][depends: 4.1] “当前 Provider：...（状态）”随 model 选择联动更新。
- [x] 4.3 [P0][depends: 4.2] 增加过程提示文案，确保用户可见状态变化过程。

## 5. 自动凭据检查（P0）

- [x] 5.1 [P0][depends: none] 移除“检查凭据”按钮。
- [x] 5.2 [P0][depends: 5.1] 面板打开自动触发凭据检查。
- [x] 5.3 [P0][depends: 5.2] 检查完成后自动刷新认证摘要与 Provider 状态。

## 6. 验证与回归（P0）

- [x] 6.1 [P0][depends: 1.x,2.x,4.x,5.x] 验证 5 条需求逐条通过（人工走查+截图）。
- [x] 6.2 [P0][depends: 3.x] 验证 icon-only 在键盘导航和屏幕阅读器下可用。
- [x] 6.3 [P0][depends: all] 验证 `engine !== "opencode"` 场景无行为变化。
