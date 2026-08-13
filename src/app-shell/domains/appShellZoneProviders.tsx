import type { ReactNode } from "react";
import {
  ComposerProvider,
  type ComposerProviderValue,
} from "./composerProvider";
import {
  LayoutChromeProvider,
  type LayoutChromeProviderValue,
} from "./layoutChromeProvider";
import {
  RuntimeThreadProvider,
  type RuntimeThreadProviderValue,
} from "./runtimeThreadProvider";

/**
 * T2.1–T2.3：按 churn 嵌套 zone providers。
 * 顺序：RuntimeThread（hot）→ Composer（mid）→ LayoutChrome（cold）。
 */
export function AppShellZoneProviders(props: {
  runtimeThread: RuntimeThreadProviderValue;
  composer: ComposerProviderValue;
  layoutChrome: LayoutChromeProviderValue;
  children: ReactNode;
}) {
  return (
    <RuntimeThreadProvider value={props.runtimeThread}>
      <ComposerProvider value={props.composer}>
        <LayoutChromeProvider value={props.layoutChrome}>
          {props.children}
        </LayoutChromeProvider>
      </ComposerProvider>
    </RuntimeThreadProvider>
  );
}
