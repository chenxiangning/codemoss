# Proposal: plugin-rack-live-path

> OpenSpec change id: `plugin-rack-live-path`  
> Wave：P4.7 批次 28（插排说真话）  
> 依赖：`engine-claude-product-default-process-entry`、`notes-product-default-isolated`、`plugin-host-supervisor-process`

## Why

产品 Claude / Notes 已切真路径，插排仍把 12 个插头画成 Idle。用户以为没通电。Host slot 确实没激活，但产品电路已经带电。只读面板必须分开报这两件事。

## 目标与边界

1. snapshot MUST 报 supervisor pid / path / live。
2. Claude / Notes MUST 报产品路径（PE / 隔离 sqlite 或显式回退），MUST NOT 把 Host slot 改成 ready。
3. later-plugin MUST 仍 idle / undeclared。
4. UI MUST 只读。MUST NOT 出现安装、卸载、启用、禁用按钮。
5. **MUST NOT** Slim，**MUST NOT** 激活 BootHost 产品插头。

## Capabilities

- `plugin-rack-live-path-v1`
