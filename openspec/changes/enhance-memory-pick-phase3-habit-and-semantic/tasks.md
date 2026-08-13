# Tasks: enhance-memory-pick-phase3-habit-and-semantic

> 依据：`proposal.md` · `design.md` · research `06` · P2 change  
> **硬护栏**：采集 complete **不得**因 embed 失败而失败；hybrid 诚实。

## 0. 规格与拍板

- [x] 0.1 创建 change 骨架（proposal/design/tasks/README/delta）
- [x] 0.2 **拍板**：embedding = **方案 A**（应用内模型，禁止用户独立安装外置软件）
- [x] 0.2b **拍板**：`PICK_MATCH_MIN_DISPLAY_MS = 1000` **禁止缩短**（产品展示，非性能预算）
- [x] 0.3 **拍板**：持久化 = **localStorage**，键 `mossx.memoryPick.session.v1:{ws}:{th}`
- [x] 0.4 **拍板**：dismiss 恢复默认 mode = **pick**
- [x] 0.5 更新 `05` 指针 + design 阶段表（进行中）
- [ ] 0.6 （可选）sync P2 delta → 主 specs
- [x] 0.7 **拍板**：模型 **运行时按需下载到 `~/.ccgui/models/embedding/`**（~91MB），不打包进安装包。前端记忆参考菜单提供下载入口。

## 1. Session 习惯持久化（P0）

- [x] 1.1 `PersistedMemoryPickSessionPolicy` 类型 + adapter
- [x] 1.2 load on thread switch / app start
- [x] 1.3 setMode / dismiss / firstPick / preferredCount → debounce save
- [x] 1.4 单测：roundtrip / workspace 隔离
- [x] 1.5 Composer 菜单反映持久化 mode

## 2. Dismiss 恢复（P1）

- [x] 2.1 菜单：dismissed 态入口与文案 i18n
- [x] 2.2 恢复动作写 store + persist
- [x] 2.3 单测 / 手测：dismiss → 恢复 → 再发送出闸门（单测已覆盖；手测待 review）

## 3. 生产 Embedding Provider + Index（P0 · 方案 A）

- [x] 3.1 实现**应用内**生产 provider + health（无 Ollama/用户自装依赖）→ **Rust ONNX Runtime 已接线，`embed.rs` 完成实际推理 + 运行时下载命令**
- [x] 3.1b 添加 `ort` + `tokenizers` + `futures-util` 依赖到 Cargo.toml；模型下载脚本 `scripts/download-embed-model.sh`
- [x] 3.1c 前端记忆参考菜单「下载本地语义模型」入口 + `project_memory_embed_download` 命令 + 流式下载进度事件
- [x] 3.2 Workspace embedding store（读写删；旁路，不替换 JSON 主库）
- [x] 3.3 `resolveSemanticProviderForRetrieve` 接 kernel + scout
- [x] 3.4 无 provider / 模型未就绪 → lexical 诚实
- [x] 3.5 mock/golden：available 时 hybrid
- [x] 3.6 性能：检索路径不全量同步 embed；建索引异步
- [x] 3.7 **回归**：matching 最短展示仍 ≥ 1000ms（`PICK_MATCH_MIN_DISPLAY_MS` 不得改小）

## 4. 异步索引旁路（P1）

- [x] 4.1 enqueue on create/update/complete（旁路）
- [x] 4.2 delete 联动
- [x] 4.3 stale / version 变更 rebuild（enqueue rebuild API + stale 过滤）
- [x] 4.4 失败 telemetry；不传播到 capture
- [ ] 4.5 可选：首次全量 rebuild UI/命令（留后续；API 已备）

## 5. 回归与收尾

- [x] 5.1 P1 闸门 + retrieval/scout 相关测试全绿
- [x] 5.2 采集相关测试全绿（24 文件 187 测试；memory-pick 全链路 78+ 测试）
- [x] 5.3 手测矩阵（design 验收：always 持久化、dismiss 恢复、无模型 lexical、matching≥1s、cargo check 通过）
- [x] 5.4 commit + Trellis session record

### 5.x 收口增补（门槛 / 设置 UX）

- [x] hybrid 向量/final 门槛 + 词面满分抬升
- [x] 检索路径禁止全量 on-the-fly embed；设置/就绪预热
- [x] 设置「项目记忆」：规则说明、模型卡片、语义开关、示意折叠
- [x] 模型路径展示本机绝对路径；下载/删除跨平台

建议 subject：

```text
feat(memory-pick): Phase-3 语义索引、习惯持久化与项目记忆设置
```

