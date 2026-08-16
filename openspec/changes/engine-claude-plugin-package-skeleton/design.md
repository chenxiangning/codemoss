# Design

过渡仓放在 `packages/plugin-engine-claude/`，不是独立 Git 仓库，也不是正式 `.mossx-plugin` 复合包。`.mossx-plugin/plugin.json` 复用 3B fixture 的 Manifest。不写 `dist/` / `bin/` / `signature.json`。产品启动链继续忽略该目录。
