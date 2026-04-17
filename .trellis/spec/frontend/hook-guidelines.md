# Hook Guidelines（Hook 开发规范）

## Hook Contract

- 命名必须 `useXxx`。
- hook 负责 orchestration + side effects，component 负责 rendering。
- 纯计算逻辑放 `utils`，不要滥用 hook 包装纯函数。

## Scenario: Hook 调用 runtime / bridge

### 1. Scope / Trigger

- Trigger：修改 `src/features/**/hooks/*` 且会调用 `src/services/tauri.ts`、`src/services/events.ts`、polling 或 listener。
- 这类变更属于 cross-layer behavior，必须明确 cleanup、fallback、race handling。

### 2. Signatures

- Hook 对 component 暴露 stable contract：`state + actions + status`。
- frontend -> runtime command 统一经 `src/services/tauri.ts`，不要在 hook 内直接 `invoke()`。
- 事件订阅返回的 `unlisten` / cleanup handler 必须在 `useEffect` cleanup 中释放。

### 3. Contracts

- hook 内部可以持有 `loading/error/data`，但 raw runtime payload 进入 UI 前必须先 normalize / map。
- error state 要是 user-readable message，不直接把 `unknown` 或 backend raw object 塞进 JSX。
- 若当前运行环境可能没有 Tauri bridge，必须走 existing fallback contract，不能让组件崩掉。

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| effect 重跑 | 先 cleanup 上一轮 timer/listener/request guard | 叠加多个 listener |
| async 返回乱序 | 忽略 stale response 或使用 request token/ref | 后返回覆盖新状态 |
| runtime 不可用 | 使用已有 fallback / empty state | 直接 throw 到 render |
| error 捕获 | normalize 成 string/message | silent catch |

### 5. Good / Base / Bad Cases

- Good：hook 只编排状态与副作用，payload mapping 放 service / adapter。
- Base：小型 hook 可在 hook 内做轻量 normalize，但 contract 仍需稳定。
- Bad：hook 里直接 `invoke()`、直接读写 DOM/global、effect 无 cleanup。

### 6. Tests Required

- happy path：返回成功状态，component 可消费。
- error path：service reject / missing bridge 时 UI 不崩。
- edge case：重复触发、快速切换、重复 mount/unmount。
- 若 hook 包含 polling/listener，测试必须断言 cleanup 被调用。

### 7. Wrong vs Correct

#### Wrong

```tsx
useEffect(() => {
  invoke("list_workspaces").then(setItems);
}, []);
```

#### Correct

```tsx
useEffect(() => {
  let cancelled = false;

  listWorkspaces()
    .then((items) => {
      if (!cancelled) {
        setItems(items);
      }
    })
    .catch((error) => {
      if (!cancelled) {
        setError(error instanceof Error ? error.message : String(error));
      }
    });

  return () => {
    cancelled = true;
  };
}, []);
```

## Async & Concurrency 规范

- 轮询/并发请求要防 stale response（request id ref / cancel flag）。
- `useEffect` 里 timer/listener 必须 cleanup。
- polling 需要 mode-aware（active/background/paused）时，间隔策略必须显式。

## Bridge 调用规范

- frontend -> runtime 的 command 调用统一经过 `src/services/tauri.ts`。
- feature hook/component 禁止直接 `invoke()`（除非明确 boundary exception）。
- 事件订阅优先使用 `src/services/events.ts` 封装，避免散落 unlisten 逻辑。

## State/Ref 规范

- `useRef` 用于 in-flight、latest snapshot、debounce guard。
- `useMemo` 只用于 expensive derive 或 contract-stable 值，不做装饰性 memo。
- hook state shape 需要显式类型，避免匿名 object 漂移。

## Error Handling

- 禁止 silent catch。
- `unknown` error 必须 normalize 成可读 message。
- 失败场景优先回退到缓存或 safe state，避免 UI 崩断。

## Testing 要求

- 非 trivial hook 至少覆盖：
  - happy path
  - error path
  - edge case（空值、race、重复触发）
- 测试中 mock `services/tauri`，不要直接 patch 全局 runtime。
