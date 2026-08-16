import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import type { PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// Preserves readable React component names in production bundles so the bundled
// react-scan overlay can attribute renders to real names (e.g. MessagesTimeline)
// instead of minified identifiers. It suppresses name minification and inflates
// the bundle, so it is opt-in: only profiling builds (VITE_ENABLE_REACT_SCAN=1)
// pay for it; regular release builds ship fully minified names.
import reactComponentName from "react-scan/react-component-name/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const rawDevPort =
  process.env.MOSS_DEV_PORT_ISOLATED === "1" ? Number(process.env.MOSS_DEV_PORT ?? "") : NaN;
const devPort =
  Number.isInteger(rawDevPort) && rawDevPort > 0 && rawDevPort <= 65535 ? rawDevPort : 1420;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeRequire = createRequire(import.meta.url);
const workerSafeConditionalEntries = new Map([
  [
    "decode-named-character-reference",
    nodeRequire.resolve("decode-named-character-reference"),
  ],
  [
    "hast-util-from-html-isomorphic",
    nodeRequire.resolve("hast-util-from-html-isomorphic"),
  ],
]);

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as {
  version: string;
};

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === "build" && process.env.VITE_ENABLE_REACT_SCAN === "1"
      ? [reactComponentName({}) as PluginOption]
      : []),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      {
        find: /^@mossx\/plugin-kanban$/,
        replacement: path.resolve(__dirname, "./packages/plugin-kanban/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-notes\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-notes/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-notes\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-notes/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-notes$/,
        replacement: path.resolve(__dirname, "./packages/plugin-notes/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-project-map\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-project-map/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-project-map\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-project-map/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-project-map$/,
        replacement: path.resolve(__dirname, "./packages/plugin-project-map/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-intent-canvas\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-intent-canvas/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-intent-canvas\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-intent-canvas/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-intent-canvas$/,
        replacement: path.resolve(__dirname, "./packages/plugin-intent-canvas/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-browser\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-browser/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-browser\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-browser/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-browser$/,
        replacement: path.resolve(__dirname, "./packages/plugin-browser/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-engine-claude\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-engine-claude/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-engine-claude$/,
        replacement: path.resolve(__dirname, "./packages/plugin-engine-claude/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-git-history\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-git-history/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-git-history\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-git-history/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-git-history$/,
        replacement: path.resolve(__dirname, "./packages/plugin-git-history/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-spec\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-spec/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-spec\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-spec/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-spec$/,
        replacement: path.resolve(__dirname, "./packages/plugin-spec/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-quick-switcher\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-quick-switcher/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-quick-switcher\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-quick-switcher/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-quick-switcher$/,
        replacement: path.resolve(__dirname, "./packages/plugin-quick-switcher/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-tasks\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-tasks/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-tasks\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-tasks/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-tasks$/,
        replacement: path.resolve(__dirname, "./packages/plugin-tasks/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-terminal\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-terminal/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-terminal\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-terminal/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-terminal$/,
        replacement: path.resolve(__dirname, "./packages/plugin-terminal/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-vendors\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-vendors/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-vendors\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-vendors/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-vendors$/,
        replacement: path.resolve(__dirname, "./packages/plugin-vendors/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-models\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-models/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-models\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-models/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-models$/,
        replacement: path.resolve(__dirname, "./packages/plugin-models/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-skills\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-skills/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-skills\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-skills/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-skills$/,
        replacement: path.resolve(__dirname, "./packages/plugin-skills/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-commands\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-commands/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-commands$/,
        replacement: path.resolve(__dirname, "./packages/plugin-commands/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-prompts\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-prompts/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-prompts\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-prompts/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-prompts$/,
        replacement: path.resolve(__dirname, "./packages/plugin-prompts/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-debug\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-debug/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-debug\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-debug/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-debug$/,
        replacement: path.resolve(__dirname, "./packages/plugin-debug/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-collaboration\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-collaboration/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-collaboration$/,
        replacement: path.resolve(__dirname, "./packages/plugin-collaboration/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-context-ledger\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-context-ledger/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-context-ledger\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-context-ledger/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-context-ledger$/,
        replacement: path.resolve(__dirname, "./packages/plugin-context-ledger/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-governance\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-governance/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-governance$/,
        replacement: path.resolve(__dirname, "./packages/plugin-governance/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-status\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-status/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-status\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-status/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-status$/,
        replacement: path.resolve(__dirname, "./packages/plugin-status/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-shared-session\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-shared-session/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-shared-session\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-shared-session/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-shared-session$/,
        replacement: path.resolve(__dirname, "./packages/plugin-shared-session/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-client-ui-visibility\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-client-ui-visibility/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-client-ui-visibility$/,
        replacement: path.resolve(__dirname, "./packages/plugin-client-ui-visibility/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-code-annotations\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-code-annotations/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-code-annotations$/,
        replacement: path.resolve(__dirname, "./packages/plugin-code-annotations/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-live-edit-preview\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-live-edit-preview/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-live-edit-preview$/,
        replacement: path.resolve(__dirname, "./packages/plugin-live-edit-preview/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-multi-agent\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-multi-agent/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-multi-agent\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-multi-agent/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-multi-agent$/,
        replacement: path.resolve(__dirname, "./packages/plugin-multi-agent/src/index.ts"),
      },
      {
        find: /^@mossx\/plugin-subagent-ui\/runtime$/,
        replacement: path.resolve(__dirname, "./packages/plugin-subagent-ui/src/runtime.ts"),
      },
      {
        find: /^@mossx\/plugin-subagent-ui\/ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-subagent-ui/src/ui.ts"),
      },
      {
        find: /^@mossx\/plugin-subagent-ui$/,
        replacement: path.resolve(__dirname, "./packages/plugin-subagent-ui/src/index.ts"),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: [
      "@codemirror/state",
      "@codemirror/view",
      "@codemirror/language",
      "@codemirror/commands",
      "@codemirror/autocomplete",
      "@codemirror/lint",
      "@codemirror/search",
    ],
  },
  optimizeDeps: {
    include: [
      // vendored TokenTracker 页面（usage / skills）全部经 React.lazy 异步
      // 加载，vite 的 entry 扫描发现不了这些只出现在 lazy chunk 里的依赖；
      // 首次点击进入页面时才被发现会触发 re-optimize + 整页 reload，这里
      // 显式预 bundling。
      "@base-ui/react/checkbox",
      "@base-ui/react/dialog",
      "@base-ui/react/popover",
      "@base-ui/react/select",
      "@base-ui/react/toast",
      "motion/react",
    ],
  },
  worker: {
    format: "es",
    plugins: () => [
      {
        name: "fast-markdown-worker-safe-conditional-exports",
        enforce: "pre",
        resolveId(source) {
          return workerSafeConditionalEntries.get(source) ?? null;
        },
      },
    ],
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  build: {
    // Cold-start: optional heavy vendors must not be force-preloaded with AppShell.
    // They remain available via normal dynamic import when a feature actually needs them.
    modulePreload: {
      resolveDependencies(_filename, deps) {
        const blockedPrefixes = [
          "vendor-mermaid",
          "vendor-markdown",
          "vendor-codemirror",
          "vendor-docs",
          "vendor-ui-heavy",
        ];
        const blockedEntryPrefixes = [
          "AboutView-",
          "Detached",
          "ClientDocumentation",
          "SpecHub-",
          "FileViewPanel-",
          "BrowserDock-",
          "treemap-",
          "mermaidExport-",
          "normalizeMermaidSource-",
        ];
        return deps.filter((dep) => {
          const base = dep.split(/[\\/]/).pop() ?? dep;
          if (blockedPrefixes.some((prefix) => base.startsWith(prefix))) {
            return false;
          }
          if (blockedEntryPrefixes.some((prefix) => base.startsWith(prefix))) {
            return false;
          }
          if (base.includes("mermaid") || base.includes("markdown-")) {
            return false;
          }
          return true;
        });
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          // Cold-start P0-1: force perfBaseline off mermaid/treemap shared facades.
          // Without this, Rollup co-chunks isPerfBaselineEnabled with TreemapModule
          // and bootstrapApp statically pays ~656KB gzip vendor-mermaid.
          if (normalizedId.includes("/src/services/perfBaseline/")) {
            return "perf-baseline";
          }
          // featureStyleLoaders is shared by AppShell; Rollup previously co-chunked
          // it with mermaid diagram facades, reintroducing a static mermaid edge.
          if (
            normalizedId.includes("/src/styles/featureStyleLoaders") ||
            normalizedId.includes("/src/styles/featureStyle")
          ) {
            return "feature-style-loaders";
          }
          // saveMermaidPngFile is a tiny Tauri invoke wrapper. If left for Rollup's
          // shared merger it co-lands with mermaid diagram facades; the services/tauri
          // barrel then statically pulls vendor-mermaid into AppShell.
          if (normalizedId.includes("/src/services/tauri/mermaidExport")) {
            return "mermaid-export";
          }
          // Vite/Rollup 的共享 helper 虚拟模块不带 node_modules 路径，默认并进
          // 「首个使用者」chunk；一旦落进 vendor-mermaid / vendor-docs，入口会静态
          // 依赖这些重 chunk，把懒加载全部击穿。钉进常驻小 chunk（不要用 \0 全量
          // 兜底：commonjs 代理模块也带 \0 前缀，会把真实代码扫进来并造成循环 chunk）。
          if (id === "\0vite/preload-helper.js" || id === "\0commonjsHelpers.js")
            return "vendor-shared";
          if (!id.includes("node_modules")) return;
          // Radix compose-refs is tiny and used by shell UI; if left for Rollup's
          // shared-chunk merger it co-lands with mermaid diagram facades and the
          // whole vendor-mermaid becomes a static edge of app-shell (P0-1 follow-up).
          if (normalizedId.includes("/@radix-ui/react-compose-refs/")) {
            return "vendor-compose-refs";
          }
          if (id.includes("/react-dom/") || /\/react\//.test(id) || id.includes("scheduler"))
            return "vendor-react";
          if (id.includes("@codemirror/") || id.includes("@lezer/")) return "vendor-codemirror";
          if (id.includes("@tauri-apps/")) return "vendor-tauri";
          // Pure markdown parsing chains (no React deps) — keeps vendor-react acyclic
          if (id.includes("/katex/") || id.includes("micromark") ||
              id.includes("mdast-") || id.includes("hast-") || id.includes("unist-") ||
              id.includes("remark-") || id.includes("rehype-"))
            return "vendor-markdown";
          // dompurify 被启动路径静态引用，又被 mermaid 依赖；不单独分包时 Rollup 会把
          // 它并进 vendor-mermaid，导致 2.3MB 的 mermaid 变成启动即加载。
          if (id.includes("/dompurify/")) return "vendor-sanitize";
          if (id.includes("/mermaid/")) return "vendor-mermaid";
          if (id.includes("/viewerjs/") || id.includes("/viewerjs-")) return "vendor-mermaid";
          if (id.includes("/pdfjs-dist/") || id.includes("/mammoth/") || id.includes("/xlsx/"))
            return "vendor-docs";
          if (id.includes("/lucide-react/"))
            return "vendor-ui-heavy";
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "packages/plugin-*/src/**/*.test.ts"],
    setupFiles: ["src/test/vitest.setup.ts"],
    maxWorkers: 2,
    minWorkers: 1,
    deps: {
      optimizer: {
        web: {
          include: ["react-i18next"],
        },
      },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: devPort,
    strictPort: true,
    host: host || false,
    proxy: {
      // 纯 vite dev（非 Tauri webview）下预览 TokenTracker dashboard 用：
      // tt-transport 在非 Tauri 环境把请求打到 /tt-dev<path>，这里转发到本地
      // `tokentracker` CLI server。不影响 tauri dev / build。
      "/tt-dev": {
        target: "http://127.0.0.1:7680",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/tt-dev/, ""),
      },
    },
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: devPort + 1,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**", "**/.codex-worktrees/**"],
    },
  },
}));
