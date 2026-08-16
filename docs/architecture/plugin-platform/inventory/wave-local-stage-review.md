# Wave Local Stage Self-Review

> 日期：2026-08-16  
> 范围：`plugin-local-stage-v1`  
> 结论：**方向正确。市场本地安装只打 staged 标记。** 先走 `previewInstall`，不读 entry，不激活 Host，不删产品源码。

## 证明

- `openspec validate plugin-local-stage-v1 --strict --no-interactive`
- vitest local stage / PluginRack / CSS：8 passed
- `command_registry` 仍无 `activate_plugin` / `install_plugin`

## 怎么看

侧栏 **市场 → 本地过渡仓** 有安装 / 卸载。点安装只改 localStorage。上方 Host 插排仍全部 idle。
