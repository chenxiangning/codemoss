# Wave 1F4 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-runtime-process-allowlist`  
> 论文对齐：未声明依赖直接拒绝；shell / 解释器不是允许的获取。  
> 结论：**方向正确。这是实洞。** `/bin/sh`、`cmd.exe`、相对路径、`..` 不得 spawn。idle fixture 仍可通过。不切产品。
