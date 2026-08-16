import { useEffect, type ComponentProps } from "react";
import { RuntimeLogPanel } from "@mossx/plugin-runtime-log/ui";
import { loadRuntimeConsoleStyles } from "../../../styles/featureStyleLoaders";

export function RuntimeConsoleDock(props: ComponentProps<typeof RuntimeLogPanel>) {
  useEffect(() => {
    void loadRuntimeConsoleStyles();
  }, []);
  return <RuntimeLogPanel {...props} />;
}
