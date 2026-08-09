/**
 * CodeMirror-backed editor for official CLI config dialogs (JSON / TOML / plain text).
 * Loaded only via OfficialConfigCodeEditor lazy boundary so settings shell stays light.
 */
import { useEffect, useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { StreamLanguage, indentUnit } from "@codemirror/language";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { linter } from "@codemirror/lint";
import { readDocumentThemeAppearance } from "../../theme/utils/themeAppearance";

export type OfficialConfigEditorFormat = "toml" | "json" | "text";

export type OfficialConfigCodeEditorImplProps = {
  value: string;
  onChange: (value: string) => void;
  format: OfficialConfigEditorFormat;
  readOnly?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  dataAttributes?: Record<string, string>;
};

/** Opt `.cm-scroller` into the project thin scrollbar (base.css `.scrollable`). */
const thinScrollbarScroller = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      view.scrollDOM.classList.add("scrollable");
    }

    destroy() {
      /* class lives on DOM node owned by the view; nothing to detach */
    }
  },
);

const editorChromeTheme = EditorView.theme({
  "&": {
    height: "100%",
    maxHeight: "100%",
    fontSize: "13px",
    border: "none",
    outline: "none",
    boxShadow: "none",
  },
  "&.cm-focused": {
    outline: "none",
    border: "none",
    boxShadow: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily:
      'var(--font-code), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    lineHeight: "1.65",
    fontSize: "13px",
  },
  ".cm-content": {
    padding: "12px 0",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
  },
});

function languageExtensions(format: OfficialConfigEditorFormat): Extension[] {
  if (format === "json") {
    return [json(), linter(jsonParseLinter())];
  }
  if (format === "toml") {
    return [StreamLanguage.define(toml)];
  }
  return [];
}

export function OfficialConfigCodeEditorImpl({
  value,
  onChange,
  format,
  readOnly = false,
  disabled = false,
  ariaLabel,
  className,
  dataAttributes,
}: OfficialConfigCodeEditorImplProps) {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    readDocumentThemeAppearance() === "light" ? "light" : "dark",
  );

  useEffect(() => {
    const updateTheme = () => {
      setTheme(
        readDocumentThemeAppearance() === "light" ? "light" : "dark",
      );
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  const extensions = useMemo(() => {
    const base: Extension[] = [
      EditorState.tabSize.of(2),
      indentUnit.of("  "),
      editorChromeTheme,
      thinScrollbarScroller,
      EditorView.lineWrapping,
      ...languageExtensions(format),
    ];
    if (disabled || readOnly) {
      base.push(EditorView.editable.of(false));
    }
    return base;
  }, [disabled, format, readOnly]);

  const dataProps = Object.fromEntries(
    Object.entries(dataAttributes ?? {}).map(([key, attrValue]) => [
      key.startsWith("data-") ? key : `data-${key}`,
      attrValue,
    ]),
  );

  return (
    <div
      className={["vendor-official-code-editor", className]
        .filter(Boolean)
        .join(" ")}
      data-official-config-editor="codemirror"
      data-format={format}
      {...dataProps}
    >
      <CodeMirror
        value={value}
        height="100%"
        style={{ height: "100%", minHeight: 0, flex: 1 }}
        theme={theme}
        extensions={extensions}
        editable={!disabled && !readOnly}
        readOnly={readOnly || disabled}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          indentOnInput: true,
          autocompletion: false,
          searchKeymap: true,
        }}
        onChange={(next) => {
          if (readOnly || disabled) {
            return;
          }
          onChange(next);
        }}
        aria-label={ariaLabel}
      />
    </div>
  );
}
