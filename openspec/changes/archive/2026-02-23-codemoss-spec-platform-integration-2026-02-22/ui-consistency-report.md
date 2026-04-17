# UI 一致性验收报告（Spec Hub）

## 1. 令牌一致性

- 颜色、边框、圆角、阴影使用现有系统变量（`--surface-*`, `--border-*`, `--text-*`）。
- 交互按钮复用现有 `ghost` 与 `Badge` 语义。

## 2. Icon 覆盖率

- 状态 icon：draft/ready/implementing/verified/archived/blocked 全覆盖。
- 动作 icon：continue/apply/verify/archive 全覆盖。
- 风险与诊断 icon：Doctor/Gate/Validation/Blocker 覆盖。

## 3. 主题可读性

- 文本层级：标题、正文、辅助文本、代码块有明确对比。
- 空状态和告警状态在浅/深主题下保持边界可辨识。

## 4. 键盘可达性

- 筛选 chips、变更项、动作按钮、时间线展开按钮均使用 `button` 语义。
- icon-only 场景补充 label/title，避免纯颜色传达状态。

## 5. 结论

Spec Hub 达到“与主系统视觉语言一致 + icon-first 信息编码”的验收目标。
