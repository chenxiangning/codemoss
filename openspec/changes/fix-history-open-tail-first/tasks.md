## 1. Progressive helper

- [x] 1.1 将 `dispatchThreadItemsProgressively` 改为 tail-first：首包 `slice(-N)`，后续 prepend 更早 batch
- [x] 1.2 增加 `mode: "atomic"`：一次 `setThreadItems(full)`
- [x] 1.3 返回已展示数量 / 是否还有更早条目，供调用方写 `historyWindow`
- [x] 1.4 更新 `dispatchThreadItemsProgressively.test.ts`：首包是最新 N，不是最早 N；atomic 一次写

## 2. Resume / Shared merge

- [x] 2.1 `hydrateHistorySnapshot` 默认 tail-first；迟到 `onSharedProjectionMerged` 走 atomic
- [x] 2.2 超长会话首包后 `setThreadHistoryWindow({ hasMore })`，全量 snapshot 进 thread 缓存
- [x] 2.3 Claude / Gemini / Grok / Kimi 打开路径共用同一 helper（禁止各引擎再 prefix）
- [x] 2.4 切会话 / generation 失效时丢弃该 thread 的更早缓存

## 3. 画布芯片分页

- [x] 3.1 复用 `messages-collapsed-indicator` 显示上方剩余条数；点击只加载一批
- [x] 3.2 prepend 用 expansion scroll snapshot 保锚点；先 pauseFollow
- [x] 3.3 不在 onScroll / 回顶自动加载；不改 useMessagesCanvasFollow 吸底算法

## 4. 验证

- [x] 4.1 相关 vitest 绿
- [x] 4.2 `openspec validate --change fix-history-open-tail-first --strict --no-interactive`
- [x] 4.3 用户手测有效果；本回合提交收口，不 archive
