import { installRendererLifecycleDiagnostics } from "./services/rendererDiagnostics";
import {
  isReactScanStartupEnabled,
  startReactScanOverlay,
} from "./services/reactScanController";
import { installRendererPlatformAttribute } from "./utils/rendererPlatform";

installRendererPlatformAttribute();
installRendererLifecycleDiagnostics();
// P1-2: Baidu Tongji is deferred until after shell-ready / idle (see bootstrapApp).
// Synchronous install on cold path competed with first paint for main-thread time.

// react-scan 必须在 React 首次 import 之前完成 instrumentation，否则生产版
// 会报 "Must import React Scan before React runs" 且 topRenders 恒空。
// bootstrapApp 顶层静态 import React，因此这里只能动态 import startApp。
async function boot() {
  if (isReactScanStartupEnabled()) {
    await startReactScanOverlay();
  }
  const { startApp } = await import("./bootstrapApp");
  await startApp();
}

void boot();
