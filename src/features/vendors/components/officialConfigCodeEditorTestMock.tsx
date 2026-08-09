/**
 * Shared test double for OfficialConfigCodeEditor.
 * Keeps dialog tests on a controllable textarea without mounting CodeMirror.
 */
import type { OfficialConfigCodeEditorProps } from "./OfficialConfigCodeEditor";

export function OfficialConfigCodeEditorMock({
  value,
  onChange,
  format,
  readOnly = false,
  disabled = false,
  ariaLabel,
  className,
  dataAttributes,
}: OfficialConfigCodeEditorProps) {
  const dataProps = Object.fromEntries(
    Object.entries(dataAttributes ?? {}).map(([key, attrValue]) => [
      key.startsWith("data-") ? key : `data-${key}`,
      attrValue,
    ]),
  );

  return (
    <textarea
      className={className}
      aria-label={ariaLabel}
      value={value}
      readOnly={readOnly}
      disabled={disabled}
      data-official-config-editor="mock"
      data-format={format}
      spellCheck={false}
      onChange={(event) => {
        if (readOnly || disabled) {
          return;
        }
        onChange(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || readOnly || disabled) {
          return;
        }
        event.preventDefault();
        const target = event.currentTarget;
        const { selectionStart, selectionEnd, value: current } = target;
        const nextValue = `${current.slice(0, selectionStart)}  ${current.slice(selectionEnd)}`;
        onChange(nextValue);
        requestAnimationFrame(() => {
          const cursorPosition = selectionStart + 2;
          target.setSelectionRange(cursorPosition, cursorPosition);
        });
      }}
      {...dataProps}
    />
  );
}
