import { lazy } from "react";

// Each lazy window lives in this module so Vite emits separate mapDeps ownership
// from the AppShell path. Co-locating all lazy() calls in router.tsx previously
// made App's single mapDeps table list detached windows + heavy vendors together
// (cold-start P0-3). AppShell stays in router.tsx as the main-window path.

export const LazyAboutView = lazy(() =>
  import("../features/about/components/AboutView").then((module) => ({
    default: module.AboutView,
  })),
);

export const LazyDetachedFileExplorerWindow = lazy(() =>
  import("../features/files/components/DetachedFileExplorerWindow").then((module) => ({
    default: module.DetachedFileExplorerWindow,
  })),
);

export const LazyDetachedSpecHubWindow = lazy(() =>
  import("../features/spec/components/DetachedSpecHubWindow").then((module) => ({
    default: module.DetachedSpecHubWindow,
  })),
);

export const LazyClientDocumentationWindow = lazy(() =>
  import("../features/client-documentation/components/ClientDocumentationWindow").then(
    (module) => ({
      default: module.ClientDocumentationWindow,
    }),
  ),
);

export const LazyDetachedBrowserAgentWindow = lazy(() =>
  import("../features/browser-agent/components/DetachedBrowserAgentWindow").then((module) => ({
    default: module.DetachedBrowserAgentWindow,
  })),
);
