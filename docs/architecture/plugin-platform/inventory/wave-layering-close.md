# Wave Layering + Local Market Close

> 日期：2026-08-16  
> 范围：合同/插座收口后的仓库内分包，以及市场本地安装卸载第一步  
> 结论：**第一阶段完成。** 合同按 P0 可测收口。插座按默认 off 可测收口。模块已在仓库内分包。市场能本地 stage / unstage。产品行为未拔插头。

## 本阶段交付

| 层 | 状态 |
|---|---|
| 合同 P0.1–P0.17 | 齐，见 `contract-socket-close.md` |
| 插座 Host / IPC / 存储 / 默认 off boot | 齐，不进产品启动链 |
| 仓库内过渡仓 | 45 个 `packages/plugin-*` |
| 市场入口 | 与拓展同级 |
| 本地安装 / 卸载 | staged + lockfile，不激活 Host |
| 权限预览 / 注册信封 | 齐 |
| 远程 Marketplace | 仍关 |
| 产品 Claude / Notes 切流 | 仍禁 |

## 怎么看

侧栏 **市场**：上方 12 个 Host 插头全是 idle；下方本地过渡仓可安装 / 卸载。安装只改 localStorage lockfile。
