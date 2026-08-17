// 三根 allowlisted 插头的产品壳在场状态。
//
// 市场 listing 改的是 rack snapshot.desiredState；产品 UI 过去不读这份快照，
// 所以卸载后命令已断、入口还在。本 store 把 desiredState 收成 { notes, projectMap, claude }，
// 用 useSyncExternalStore 推给 toolbar / panel / engine selector。
// 不进 AppShell bag，不做秒级轮询。默认全 present，避免首屏闪藏。

import { useEffect, useSyncExternalStore } from "react";
import type { PluginRackSnapshot } from "./tauri/pluginRack";

export type PluginPresence = {
  notes: boolean;
  projectMap: boolean;
  claude: boolean;
};

const DEFAULT_PLUGIN_PRESENCE: PluginPresence = {
  notes: true,
  projectMap: true,
  claude: true,
};

let state: PluginPresence = DEFAULT_PLUGIN_PRESENCE;
let hydrateStarted = false;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribePluginPresence(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function presenceEqual(left: PluginPresence, right: PluginPresence): boolean {
  return (
    left.notes === right.notes &&
    left.projectMap === right.projectMap &&
    left.claude === right.claude
  );
}

export function isPlugPresentInSnapshot(
  snapshot: PluginRackSnapshot,
  pluginId: "com.mossx.notes" | "com.mossx.project-map" | "com.mossx.engine.claude",
): boolean {
  const plug = snapshot.plugs.find((entry) => entry.pluginId === pluginId);
  if (!plug) {
    return true;
  }
  return plug.desiredState !== "uninstalled";
}

export function getPluginPresenceSnapshot(): PluginPresence {
  return state;
}

export function publishPluginRackSnapshot(snapshot: PluginRackSnapshot): PluginPresence {
  hydrateStarted = true;
  const next: PluginPresence = {
    notes: isPlugPresentInSnapshot(snapshot, "com.mossx.notes"),
    projectMap: isPlugPresentInSnapshot(snapshot, "com.mossx.project-map"),
    claude: isPlugPresentInSnapshot(snapshot, "com.mossx.engine.claude"),
  };
  if (presenceEqual(state, next)) {
    return state;
  }
  state = next;
  notify();
  return state;
}

function hydratePluginPresence(): void {
  if (hydrateStarted) {
    return;
  }
  hydrateStarted = true;
  void import("./tauri/pluginRack")
    .then(({ getPluginRackSnapshot }) => getPluginRackSnapshot())
    .then((snapshot) => {
      publishPluginRackSnapshot(snapshot);
    })
    .catch(() => {
      // 读快照失败时保持默认 present，避免把三根入口闪藏掉。
    });
}

export function usePluginPresence(): PluginPresence {
  const presence = useSyncExternalStore(
    subscribePluginPresence,
    getPluginPresenceSnapshot,
    getPluginPresenceSnapshot,
  );
  useEffect(() => {
    hydratePluginPresence();
  }, []);
  return presence;
}

export function __resetPluginPresenceForTests(): void {
  state = DEFAULT_PLUGIN_PRESENCE;
  hydrateStarted = false;
  listeners.clear();
}
