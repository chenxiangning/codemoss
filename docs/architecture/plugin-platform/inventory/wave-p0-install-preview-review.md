# Wave P0 Install Preview Self-Review

> 日期：2026-08-16  
> 范围：`plugin-install-preview-v1`  
> 结论：**方向正确。安装预览与注册信封不执行插件代码。** 未接 boot，未远程安装。

## 证明

- `openspec validate plugin-install-preview-v1 --strict --no-interactive`
- vitest `installPreview` / `parseManifestV1`：21 passed

## 合同缺口

P0.7 / P0.8 本刀补上。P0.9 哈希冲突已在 parser。远程 Registry / 签名仍属 P6，不在本收口。
