# Native WebView API Risk Gate（原生接口风险门禁）

> 来源事故：2026-08-05/06 P0 `uiScale≠1` 卡死（WebView2 `SetZoomFactor` 实锤、
> WKWebView `setPageZoom` 现场反馈），分析见
> `docs/analysis/windows-ccgui-startup-hang-2026-08-05.md`，修复见 OpenSpec
> changes `fix-windows-ui-scale-webview2-hang` /
> `fix-ui-scale-native-zoom-freeze-all-platforms`。

## 事故三段论（背下来）

1. **直接原因**：前端直接调系统 native zoom 接口（Windows `SetZoomFactor` /
   macOS `setPageZoom`），缩放值 ≠1 时渲染进程高 CPU、内存暴涨至 GB 级，页面假死。
2. **放大原因**：调用点在**启动必经之路**（React 首屏 effect）上，用户连设置页都
   进不去，改不回安全值 → 每次启动都卡死，**锁死循环**，单点故障无保险丝。
3. **流程原因**：三端共用一行 `setZoom(uiScale)`，默认「系统接口肯定靠谱」；
   Mac 仅凭「没接到投诉」就被判「正常」——**没出过事 ≠ 安全**。

## 规则（今后所有 native / WebView 接口调用必须过这三问）

### Q1 它疯了我会不会死？有没有纯 Web 替代方案？

- 凡是 native API（Tauri command、WebView2/WKWebView/WebKitGTK 能力、COM/Cocoa
  接口），先假设它**在某些平台 + 某些参数下会疯**（高 CPU / 爆内存 / 假死）。
- 有 CSS/JS 标准替代（如本次 `transform: scale()` 替代 native zoom）就**一律用
  纯 Web 方案**；三端行为一致、可单测、不碰黑盒。
- 必须用 native 时：**按平台写证据分级**（已证实 / 已排除 / 未验证），禁止
  「一端实测 + 其余想当然」；未验证的平台按「可能疯」对待。

### Q2 出错时用户能不能自救？（启动类设置必须配 startup guard）

- 任何**持久化设置**，若其错误值能让 App 起不来 / 进不了设置页，就是锁死循环
  候选，**必须**配看门狗，模式照抄 `src/utils/uiScaleStartupGuard.ts`：
  1. 应用危险值时写 pending 记录（localStorage，同步落盘）；
  2. 渲染器证明活着（`requestAnimationFrame` 触发）或 pagehide 干净退出 → 清除；
  3. 下次启动发现残留记录 → **本次会话临时回退安全值**（不改写用户存储）+
     runtime notice 告知。
- 禁止把「超时包一层」当修复：渲染进程失控时 Promise/timeout 都救不了。

### Q3 验收矩阵覆盖了「平台 × 取值 × 系统环境」吗？

- 涉及缩放 / DPI / 窗口 / 显示的改动，发版前按矩阵打勾：关键取值（80% / 100% /
  120%）× Windows（系统 100% 与 125% 各一轮）× macOS × Linux。
- 没机器测的平台**写明「未测」**，禁止默认通过。
- 诊断日志必须带定位现场：`devicePixelRatio`、当前生效缩放值、平台
  （见 `src/services/rendererDiagnostics.ts`）。

## 触发条件（何时重读本指南）

- 新增 / 修改任何 `getCurrentWebview()` / Tauri command / native window、zoom、
  DPI、透明度、毛玻璃等系统能力调用。
- 新增「启动时生效的持久化设置」。
- 收到「某平台卡死 / 假死 / 内存暴涨」现场反馈。

## 相关事实源

| 内容 | 路径 |
|------|------|
| 缩放统一实现 | `src/utils/applyUiScale.ts`（三端 CSS，native 只钉 1） |
| 看门狗模板 | `src/utils/uiScaleStartupGuard.ts` |
| 事故分析 | `docs/analysis/windows-ccgui-startup-hang-2026-08-05.md` |
| 错误登记 | `.learnings/ERRORS.md` ERR-20260806-001 |
