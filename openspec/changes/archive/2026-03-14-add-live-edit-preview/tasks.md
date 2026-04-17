## 1. Scope framing

- [x] 1.1 明确 `live edit preview` 与第一阶段 activity panel 的边界，禁止回流污染监控面板职责
- [x] 1.2 明确 capability 命名与后续 delta specs 归属
- [x] 1.3 明确 `SOLO` 与普通视图下的适用范围

## 2. Interaction design

- [x] 2.1 设计预览开关或 opt-in 策略
- [x] 2.2 设计 file-change 到 preview target 的映射规则
- [x] 2.3 设计用户手动上下文保护与焦点抢占规则
- [x] 2.4 设计多文件连续修改时的节流、防抖与主目标选择

## 3. Integration design

- [x] 3.1 盘点现有 editor / file view / diff view 打开链路，明确最小复用路径
- [x] 3.2 定义与 `SOLO` 视图和 activity panel 的协同边界
- [x] 3.3 评估是否需要独立 adapter 或 preview coordinator

## 4. Validation

- [x] 4.1 验证自动预览不会无条件抢占用户当前焦点
- [x] 4.2 验证多文件连续修改不会引发严重界面抖动
- [x] 4.3 验证关闭预览后 file-change 仍可通过 activity panel 正常跳转查看
