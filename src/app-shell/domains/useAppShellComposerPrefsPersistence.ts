import { useCallback, useEffect, useRef } from "react";
import {
  getComposerEnginePrefsSnapshot,
  seedComposerEnginePrefs,
  setComposerEnginePref,
} from "../../features/composer/hooks/composerEnginePrefsStore";
import { seedCliEngineVisibility } from "../../features/composer/hooks/cliEngineVisibilityStore";
import { updateAppSettings } from "../../services/tauri/settings";
import type { AppSettings, ComposerEnginePrefs, EngineType } from "../../types";

type UseAppShellComposerPrefsPersistenceInput = {
  appSettings: AppSettings;
  appSettingsLoading: boolean;
};

export function useAppShellComposerPrefsPersistence({
  appSettings,
  appSettingsLoading,
}: UseAppShellComposerPrefsPersistenceInput) {
  const appSettingsRef = useRef(appSettings);
  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  const prefsPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushPersistEnginePrefs = useCallback(() => {
    void updateAppSettings({
      ...appSettingsRef.current,
      lastComposerPrefsByEngine: getComposerEnginePrefsSnapshot(),
    }).catch(() => undefined);
  }, []);
  const schedulePersistEnginePrefs = useCallback(() => {
    if (prefsPersistTimerRef.current) {
      clearTimeout(prefsPersistTimerRef.current);
    }
    prefsPersistTimerRef.current = setTimeout(() => {
      prefsPersistTimerRef.current = null;
      flushPersistEnginePrefs();
    }, 400);
  }, [flushPersistEnginePrefs]);

  useEffect(
    () => () => {
      if (prefsPersistTimerRef.current) {
        clearTimeout(prefsPersistTimerRef.current);
        flushPersistEnginePrefs();
      }
    },
    [flushPersistEnginePrefs],
  );

  const persistComposerEnginePref = useCallback(
    (engine: EngineType, patch: Partial<ComposerEnginePrefs>) => {
      if (!setComposerEnginePref(engine, patch)) {
        return;
      }
      schedulePersistEnginePrefs();
    },
    [schedulePersistEnginePrefs],
  );
  const activeEngineRef = useRef<EngineType>("claude");
  const persistClaudeCollaborationMode = useCallback(
    (modeId: string | null) => {
      if (activeEngineRef.current !== "claude") {
        return;
      }
      persistComposerEnginePref("claude", {
        collaborationModeId: modeId === "plan" ? "plan" : "code",
      });
    },
    [persistComposerEnginePref],
  );

  const prefsSeededRef = useRef(false);
  useEffect(() => {
    if (appSettingsLoading || prefsSeededRef.current) {
      return;
    }
    seedComposerEnginePrefs(appSettings.lastComposerPrefsByEngine);
    prefsSeededRef.current = true;
  }, [appSettingsLoading, appSettings.lastComposerPrefsByEngine]);

  // CLI 可见性跟随设置响应式同步(与 prefs 的一次性播种不同,写入口在
  // VendorSettingsPanel → onUpdateAppSettings,必须随设置变化重推)。
  useEffect(() => {
    if (appSettingsLoading) {
      return;
    }
    seedCliEngineVisibility(appSettings.disabledCliEngines);
  }, [appSettingsLoading, appSettings.disabledCliEngines]);

  return {
    activeEngineRef,
    persistClaudeCollaborationMode,
    persistComposerEnginePref,
  };
}
