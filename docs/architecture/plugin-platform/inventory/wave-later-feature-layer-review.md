# Wave Later Feature Package Layer Self-Review

> 日期：2026-08-16  
> 范围：`plugin-later-feature-package-layer`  
> 结论：**方向正确。Project Map / Browser / Intent Canvas 只做仓库内分包。** 产品路径不改，boot 不安装。

## 证明

- `openspec validate plugin-later-feature-package-layer --strict --no-interactive`
- parser 接受三个过渡仓 Manifest
- 本地目录 6 个包全部 `installed=false`
