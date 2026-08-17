# Wave Layering + Local Market Close

> 日期：2026-08-16；校正：2026-08-16 晚  
> 范围：合同/插座收口后的仓库内分包  
> 结论：**分包外形已落下，假市场已回退。** 合同 parser 可测。插座 default-off 可测。45 个过渡仓仍是 re-export，不是真插头。市场只读。产品行为未拔插头。

## 本阶段交付

| 层 | 状态 |
|---|---|
| 合同 P0 parser / fixtures | 齐 |
| 插座 Host / IPC / 存储 / 默认 off boot | 齐，boot 不激活产品插头 |
| 仓库内过渡仓 | 45 个 `packages/plugin-*`，实现仍在 `src/features/**` |
| 市场入口 | 与拓展同级，**只读插排** |
| 本地安装 / 卸载 | **已回退**（D-049）。不得再出现 stage/unstage 按钮 |
| 远程 Marketplace | 仍关 |
| 产品 Claude / Notes 切流 | 仍禁 |

## 怎么看

侧栏只显示 12 个已声明 Host 插头，默认 idle。没有本地过渡仓安装/卸载。
