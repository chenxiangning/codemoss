# Wave 1NP5 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-named-pipe-sddl`  
> 论文对齐：未授权主体不得获取 transport；Everyone 不得进入 descriptor。  
> 结论：**方向正确。这是实洞。** ACL 现在必须先编成当前用户 SDDL。Everyone / 额外 SID 编译失败。Windows bind 用该 SDDL 构造 `SECURITY_ATTRIBUTES`，不再传 NULL DACL。本机 macOS 验收编译闸门；完整 ConvertStringSecurityDescriptor 在 Windows 上才跑。不切产品。
