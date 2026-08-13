import { AppShellView } from "./appShellView";
import { AppShellZoneProviders } from "../domains/appShellZoneProviders";
import { useAppShellRootComposition } from "./useAppShellRootComposition";

/**
 * AppShell composition 入口（T2.6）。
 * 业务 hooks 在 useAppShellRootComposition；zone providers + view 在此组装。
 */
export function AppShell() {
  const {
    runtimeThreadProviderValue,
    composerProviderValue,
    layoutChromeProviderValue,
    appShellDomainContexts,
    searchAndComposerInput,
  } = useAppShellRootComposition();

  return (
    <AppShellZoneProviders
      runtimeThread={runtimeThreadProviderValue}
      composer={composerProviderValue}
      layoutChrome={layoutChromeProviderValue}
    >
      <AppShellView
        appShellDomainContexts={appShellDomainContexts}
        searchAndComposerInput={searchAndComposerInput}
      />
    </AppShellZoneProviders>
  );
}
