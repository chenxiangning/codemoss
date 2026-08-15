# Wave 0 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-kernel-ownership-inventory` + `plugin-manifest-v1-parser`  
> 结论：**方向正确，颗粒度合格，可以进入 Wave 1 的第一刀 `plugin-ipc-v1-framing`。**

## 方向

| 检查 | 结果 |
|---|---|
| 先插排、不拔插头 | 通过。未迁 Claude / Notes，未删 `src/features/**` / engine |
| 不接生产路径 | 通过。无 AppShell import，无 `command_registry` 注册 |
| fail closed | 通过。未知字段 / event / kind / 无上界 coreApi / trusted-react+non-system 均拒绝 |
| 瘦身跟插头走 | 通过。`retired-unreferenced` 为空；只确认 `src/core-shell` 本就不存在 |
| 文档 13 未当开工指令 | 通过。status 已标 `historical-local-experiment` |

## 颗粒度

Wave 0 拆成 0A / 0B 是对的：inventory 与 parser 无产品依赖，可并行。没有把 Host / Storage / Marketplace 塞进来。

已知未做、且**故意留给后续 Wave** 的项：

- Runtime Registration / install-time hash gate 完整 installer（P0.7–P0.9 的运行时半截）
- MXPC/MXPD framing（Wave 1 第一刀）
- Host / QuickJS / Process supervisor
- SDK 代码生成（当前是手写 adapter + 共享 fixtures；可接受，但 Wave 1 schema 必须继续单源）

## 偏差与修正

1. **ownership 粒度偏细**：Claude 拆成 19 行文件级 owner，而不是一个逻辑 Pilot。可接受——删除时更安全；spec 已从“恰好一行”改成“至少一行”。
2. **parser 是手写双端，不是 generated types**：符合“先可测、后生成”。Wave 1 framing 继续同一策略：`packages/plugin-contract` fixtures 单源，禁止第三套字段。
3. **boundary 对 later-plugin 只 soft**：23 条 AppShell 引用是现状，不是本 Wave 要拆的债。

## 下一阶段边界（锁定）

只开 `plugin-ipc-v1-framing`：

- 做：MXPC/MXPD encode/decode、handshake JSON 形状、窗口/codec 常量、fail-closed fixtures
- 不做：听 socket、spawn 进程、QuickJS、Broker API、Claude/Notes、Marketplace

Host supervisor 必须等 framing 验收后再开第二个 change。
