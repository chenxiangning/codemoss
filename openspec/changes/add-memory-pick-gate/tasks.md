# Tasks: add-memory-pick-gate

> 依据：`proposal.md` · `design.md` · `ux.md` · `specs/**`  
> **状态**：Phase-1 代码已齐；2026-08-10 二次设计回写完成 · 待 commit

## 1. Specs / 文档

- [x] 1.1 proposal / design / ux 定稿
- [x] 1.2 delta specs
- [x] 1.3 always 非静默合同
- [x] 1.4 第一次实现校准
- [x] 1.5 **Phase-1 二次回写**（always 可改 n、Dialog/底栏/行高/读秒/同步/标题）
- [ ] 1.6 `openspec validate add-memory-pick-gate --strict --no-interactive`
- [ ] 1.7 verify / sync specs（commit 后）

## 2. 类型与状态

- [x] 2.1 `off | pick | always`（single→pick）
- [x] 2.2 SessionPolicy + gate UI state
- [x] 2.3 firstPick / dismissed / **alwaysPreferredCount**（内存）
- [ ] 2.4 持久化（P1）

## 3. 检索与注入

- [x] 3.1 常量：`PICK_CANDIDATE_LIMIT=25`、`ALWAYS_TOP_K=3`、`PICK_RETRIEVE_TIMEOUT_MS=1000`、`ALWAYS_AUTO_CONFIRM_MS=8000`
- [x] 3.2 retrieval adapter
- [x] 3.3 inject memory-pick
- [x] 3.4 @@ 去重
- [x] 3.5 超时/空/失败 auto-skip

## 4. Send 编排

- [x] 4.1 pending bubble 先于 gate
- [x] 4.2 decideMemoryPickGateEntry
- [x] 4.3 firstPick
- [x] 4.4 always show-ui + preferred count 预勾
- [x] 4.5 confirm / skip / dismiss / cancel
- [x] 4.6 同 thread 重入 cancel
- [x] 4.7 Shared / Native / Collab
- [x] 4.8 侧栏标题 strip pack

## 5. UI（C + Phase-1 polish）

- [x] 5.1 Gate 挂 Messages slot
- [x] 5.2 角色条非 Assistant
- [x] 5.3 单行列表 + 固定 36px 行高 + align-content start
- [x] 5.4 详情 Dialog portal + 仅 Markdown 详情（无摘要）
- [x] 5.5 右策略轨
- [x] 5.6 底栏 icon+文案（非胶囊）
- [x] 5.7 与 messages-full 同宽
- [x] 5.8 retrieving skeleton + 最短展示
- [x] 5.9 窄屏堆叠
- [x] 5.10 确认后卸 gate
- [x] 5.11 always 读秒（count 行 + 确认文案）
- [x] 5.12 行背景仅勾选；TOP 不锁
- [x] 5.13 幕布 setMode → Composer 同步

## 6. Composer

- [x] 6.1 菜单三态
- [x] 6.2 文案与幕布对齐
- [ ] 6.3 dismissed 恢复入口（P1）
- [ ] 6.4 multi-agent contextGate 清理（P1）

## 7. i18n

- [x] 7.1 zh/en + 多 locale memory/composer/messages

## 8. 测试

- [x] 8.1 policy
- [x] 8.2 TopK / preferred count / pack
- [x] 8.3 Gate RTL
- [x] 8.4 messaging 集成
- [x] 8.5 firstPick / dismiss
- [x] 8.6 store 单测
- [x] 8.7 Composer 菜单
- [x] 8.8 previewThreadName strip pack

## 9. 可观测与收尾

- [ ] 9.1 埋点（P1）
- [ ] 9.2 feature flag（P2）
- [ ] 9.3 手动验收 design §18
- [ ] 9.4 openspec validate + commit

## 10. P1（不阻塞 Phase-1）

- [ ] 10.1 session policy 持久化
- [ ] 10.2 cancel 回填 Composer
- [ ] 10.3 toast
- [ ] 10.4 设置页调 n/超时
- [ ] 10.5 历史脏 title 重算

## 11. Phase-1 commit 清单

- [x] 功能 + 测试代码
- [x] 文档二次回写
- [ ] 提交前测试命令（建议）:

```bash
pnpm vitest run \
  src/utils/threadItemsUserMessage.test.ts \
  src/features/project-memory/memoryPick \
  src/features/project-memory/components/MemoryPickGate.test.tsx \
  src/features/threads/hooks/useThreadMessaging.memory-pick.test.tsx \
  src/features/composer/components/Composer.memory-reference.test.tsx
```

- [ ] `git commit`（中文 conventional）

建议 subject：

```text
feat(memory-pick): 发送前记忆挑选闸门 Phase-1
```
