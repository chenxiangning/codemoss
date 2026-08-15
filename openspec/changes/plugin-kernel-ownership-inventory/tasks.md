# Tasks: plugin-kernel-ownership-inventory

优先级：P0。无产品代码依赖。可与 `plugin-manifest-v1-parser` 并行。

## 1. 校准事实

- [ ] 1.1 扫描 `src/features/*`、`src-tauri/src/engine/*`、`command_registry.rs` 顶层 owner，生成 inventory 初稿  
      输入：当前工作树  
      输出：`docs/architecture/plugin-platform/inventory/ownership.json`  
      验证：条目数 ≥ feature 目录数 + engine 顶层模块数
- [ ] 1.2 人工标定 `core / pilot / later-plugin / retired-unreferenced`，pilot 仅 Claude + Notes  
      验证：JSON 可被 schema 校验；`com.mossx.engine.claude` 与 `com.mossx.notes` 各出现一次
- [ ] 1.3 修正 `13-core-shell-subtraction-implementation.md`：标明非本工作树现状，指向 `15`  
      验证：文首 status 不再是“已收缩”

## 2. Fitness

- [ ] 2.1 新增 `scripts/check-core-shell-boundary.mjs`，读取 ownership.json  
      hard：retired 被 production import / Rust 注册 → exit 1  
      soft：AppShell import later-plugin → stderr 报告、exit 0
- [ ] 2.2 增加 fixture：伪造 AppShell import retired owner，脚本必须失败
- [ ] 2.3 `package.json` 增加 `check:core-shell:boundary`，先不接入必过 CI（本 Wave 记录命令即可）

## 3. 无产品删除的瘦身

- [ ] 3.1 引用扫描空目录 `src/core-shell/`；若无引用则删除
- [ ] 3.2 扫描 scripts 中与已消失路径绑定、且无 package.json 引用的死脚本；有证据才删
- [ ] 3.3 禁止删除任何 `src/features/**` 与 engine 实现；PR/提交说明列出“未删清单”

## 4. 验收

- [ ] 4.1 `openspec validate plugin-kernel-ownership-inventory --strict --no-interactive`
- [ ] 4.2 focused 测试：boundary script fixture
- [ ] 4.3 现有 `npm run typecheck` 不被本 change 破坏
