import { lazy } from "react";

// Isolated from detached-window lazy() factories so AppShell mapDeps does not
// inherit About / SpecHub / FileExplorer sibling preloads (cold-start P0-3).
export const LazyAppShell = lazy(() =>
  import("../app-shell").then((module) => ({
    default: module.AppShell,
  })),
);
