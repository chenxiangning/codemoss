# Linux Native Baidu Analytics Transport Contract

## Scenario: Linux native Tauri 保留百度统计但绕过 WebKit NetworkProcess

### 1. Scope / Trigger

- Trigger：修改 `src/services/baiduTongji.ts`、`src/services/tauri/baiduTongji.ts`、`src-tauri/src/baidu_tongji.rs`，或 Linux native production 的统计启动路径。
- 目标：继续执行百度官方 `hm.js` 并产生真实 PV/UV，同时禁止本 feature 的 `hm.baidu.com` 请求进入已知会在部分 WebKitGTK/libsoup 组合中崩溃的 `WebKitNetworkProcess`。
- 本 contract 只适用于 Linux native Tauri main window；Windows、macOS 与 Linux Web Service 保留 external script path。

### 2. Signatures

- Frontend entry：`installBaiduTongji(): void`
- Frontend IPC：`loadBaiduTongjiScript(userAgent: string): Promise<void>`
- Frontend IPC：`sendBaiduTongjiBeacon(url: string, userAgent: string): Promise<void>`
- Rust command：`load_baidu_tongji_script(user_agent: String, webview: WebviewWindow, state: State<'_, BaiduTongjiState>) -> Result<(), String>`
- Rust command：`send_baidu_tongji_beacon(url: String, user_agent: String, webview: WebviewWindow, state: State<'_, BaiduTongjiState>) -> Result<(), String>`
- Internal persistence：`{ "hmacCount": string }`，文件为 ccgui app home 下的 `analytics/baidu-tongji.json`。

### 3. Contracts

- Production main window MUST initialize `_hmt` exactly as the existing analytics entry does；development 与 secondary window MUST no-op。
- Linux native MUST synchronously install an exact `http(s)://hm.baidu.com/hm.gif` `Image.src` bridge before requesting the official script；non-matching Image URL MUST delegate to the native browser implementation。
- Linux native MUST fetch only the compiled-in `https://hm.baidu.com/hm.js?<site-id>` through Rust `reqwest`；frontend MUST NOT append an external Baidu script or locally recreate private beacon query fields。
- Script loading and beacon sending MUST remain fire-and-forget/best-effort relative to React bootstrap；failure MUST NOT fall back to WebKit networking。
- Backend HTTP client MUST be HTTPS-only, reject redirects, use bounded connect/total timeout, and read `hm.js` incrementally with a hard byte limit before evaluation。
- Beacon validation MUST require main window、exact host `hm.baidu.com`、exact path `/hm.gif`、built-in `si`、single non-empty bounded `hca`、bounded control-character-free User-Agent；backend owns method、final HTTPS scheme、Referer and headers。
- Official script evaluation MUST require the expected site id and current `hm.gif` transport marker；marker drift MUST fail closed and leave app startup available。
- `HMACCOUNT` MUST be validated、serialized through `BaiduTongjiState.visitor_cookie`、persisted with `storage::write_json_file()` lock + atomic write, and quarantined on invalid JSON/semantic value。request MUST only clone a cookie snapshot under the short state mutex；network I/O MUST run outside that mutex。response cookie MUST commit only after the corresponding status/body/UTF-8/site-id/marker validation succeeds；compare-and-update MUST reject stale responses, and accepted memory/disk updates MUST remain commit-ordered。
- Logs and returned errors MUST NOT include cookie value、full beacon URL/query or remote response body；network errors expose only categories such as `timeout`、`connect`、`response-body`、`request`。
- Commands MUST be registered in `src-tauri/src/command_registry.rs`，module/state MUST be wired in `src-tauri/src/lib.rs`，camelCase IPC fields MUST remain `userAgent` and `{ url, userAgent }`。

### 4. Validation & Error Matrix

| 场景 | 必须行为 | Startup |
|---|---|---|
| Linux native main + valid official script/beacon | native fetch/eval/send；preserve official query；reuse valid cookie | continue |
| Linux Web Service / Windows / macOS production main | existing external `hm.js` injection | unchanged |
| development / secondary window | no external or native analytics | continue |
| wrong host/path/site id、missing `hca`、invalid User-Agent | reject before network | continue |
| redirect、timeout、DNS/TLS、non-2xx、oversized/empty/invalid script | redacted error；no cookie commit；no WebKit fallback | continue |
| invalid persisted cookie JSON/value | quarantine；start with empty native cookie | continue |
| official script marker/site id changes | refuse `eval` | continue without unsafe request |

### 5. Good / Base / Bad Cases

- Good：official `hm.js` 生成 `hca` 与其余 query fields，Image bridge 只捕获 fixed beacon，Rust 使用 real WebView User-Agent + backend-owned Referer + persisted cookie 发送 HTTPS request。
- Base：离线启动只产生 redacted warning；`bootstrap/render-committed` 与 `bootstrap/renderer-ready-marked` 仍到达。
- Bad：Linux native 直接 append external `hm.js`；Linux 直接 return 关闭统计；command 接收 arbitrary URL/header/body；日志打印 query/cookie；analytics Promise 被 React bootstrap await。

### 6. Tests Required

- Frontend routing：`npx vitest run src/services/baiduTongji.test.ts`；断言 Linux native 无 external script、先有 `_hmt`/bridge、matching beacon 走 IPC、普通 Image 委托、Web Service/Windows parity、failure 不 throw。
- IPC mapping：`npx vitest run src/services/tauri/baiduTongji.test.ts`；断言 command names 与 camelCase payload。
- Rust validation/persistence：`cargo test --manifest-path src-tauri/Cargo.toml baidu_tongji::tests`；断言 endpoint/site/hca/User-Agent rejection、HTTPS upgrade、bounded chunk、cookie extraction/continuity/quarantine、valid/no-candidate commit 与 stale response rejection。
- Static/cross-layer：检查 `command_registry.rs` 注册、`lib.rs` state wiring；运行 `npm run check:runtime-contracts`、`npm run typecheck`、`npm run lint`、targeted `rustfmt --check`。
- Release：同一 isolated profile 连续启动 release ELF 两次，再验证 AppImage direct 与 temporary `.desktop -> gtk-launch`；每次都要求 renderer ready、可见非空 UI、真实 script/beacon success、第二次 cookie reuse，并检查 launch timestamp 后无 WebKit/libsoup crash。

### 7. Wrong vs Correct

#### Wrong

```typescript
if (detectRendererPlatform() === "linux") return;
document.head.appendChild(externalBaiduScript);
```

```rust
#[tauri::command]
async fn analytics_proxy(url: String, headers: HashMap<String, String>) -> Result<String, String> {
    reqwest::Client::new().get(url).headers(headers).send().await?.text().await
}
```

#### Correct

```typescript
installNativeImageBridge();
window._hmt = window._hmt || [];
void loadBaiduTongjiScript(navigator.userAgent).catch(reportRedactedWarning);
```

```rust
validate_main_linux_webview(&webview)?;
let url = validate_beacon_url(&url)?;
let user_agent = validate_user_agent(&user_agent)?;
send_fixed_get(&state, url, user_agent).await?;
```
