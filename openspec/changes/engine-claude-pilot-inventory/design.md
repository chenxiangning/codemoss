# Design: engine-claude-pilot-inventory

## Decisions

### D1. 文件级 + 命令级

ownership.json 已有 19 行 Claude rust 文件。3A 再按产品面归组，方便 3B 写 Manifest entries。

### D2. 不改代码

唯一允许的非文档改动：OpenSpec + inventory JSON/MD。

### D3. 下一刀入口

3B 才能写 `com.mossx.engine.claude` Manifest 草稿（仍不接 Host 生产路径）。
