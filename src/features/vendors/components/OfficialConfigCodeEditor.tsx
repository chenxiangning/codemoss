/**
 * Lazy shell for official-config CodeMirror editor.
 * Keeps @uiw/react-codemirror out of the vendors settings eager path.
 */
import { Suspense, lazy } from "react";
import type { OfficialConfigCodeEditorImplProps } from "./OfficialConfigCodeEditorImpl";

const OfficialConfigCodeEditorImpl = lazy(async () => {
  const module = await import("./OfficialConfigCodeEditorImpl");
  return { default: module.OfficialConfigCodeEditorImpl };
});

export type OfficialConfigCodeEditorProps = OfficialConfigCodeEditorImplProps;

function OfficialConfigCodeEditorFallback({
  value,
  className,
  ariaLabel,
  dataAttributes,
}: Pick<
  OfficialConfigCodeEditorProps,
  "value" | "className" | "ariaLabel" | "dataAttributes"
>) {
  const dataProps = Object.fromEntries(
    Object.entries(dataAttributes ?? {}).map(([key, attrValue]) => [
      key.startsWith("data-") ? key : `data-${key}`,
      attrValue,
    ]),
  );
  return (
    <pre
      className={["vendor-official-code-editor", "is-loading", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={ariaLabel}
      aria-busy="true"
      data-official-config-editor="fallback"
      {...dataProps}
    >
      {value}
    </pre>
  );
}

export function OfficialConfigCodeEditor(props: OfficialConfigCodeEditorProps) {
  return (
    <Suspense
      fallback={
        <OfficialConfigCodeEditorFallback
          value={props.value}
          className={props.className}
          ariaLabel={props.ariaLabel}
          dataAttributes={props.dataAttributes}
        />
      }
    >
      <OfficialConfigCodeEditorImpl {...props} />
    </Suspense>
  );
}
