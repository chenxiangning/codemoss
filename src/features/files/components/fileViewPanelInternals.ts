import {
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
} from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type {
  CodeAnnotationLineRange,
  CodeAnnotationSelection,
} from "@mossx/plugin-code-annotations/runtime";
import type { GitLineMarkers } from "../utils/gitLineMarkers";
// 纯函数与类型的事实源统一在 fileViewPanelShared；本文件只保留 CodeMirror 专有实现。
import {
  resolveEditorAnnotationWidgetOrder,
  type AnnotationWidgetCallbacks,
  type FileAnnotationDraftState,
} from "./fileViewPanelShared";

function buildGitLineDecorations(
  doc: { lines: number; line: (lineNumber: number) => { from: number } },
  markers: GitLineMarkers,
) {
  if (markers.added.length === 0 && markers.modified.length === 0) {
    return Decoration.none;
  }
  const builder = new RangeSetBuilder<Decoration>();
  const maxLine = doc.lines;
  const markerByLine = new Map<number, "added" | "modified">();

  for (const lineNumber of markers.added) {
    markerByLine.set(lineNumber, "added");
  }
  for (const lineNumber of markers.modified) {
    markerByLine.set(lineNumber, "modified");
  }

  const sortedMarkers = Array.from(markerByLine.entries()).sort(
    ([leftLineNumber], [rightLineNumber]) => leftLineNumber - rightLineNumber,
  );

  for (const [lineNumber, kind] of sortedMarkers) {
    if (lineNumber < 1 || lineNumber > maxLine) {
      continue;
    }
    const line = doc.line(lineNumber);
    builder.add(
      line.from,
      line.from,
      Decoration.line({
        attributes: {
          class: kind === "modified" ? "cm-git-modified-line" : "cm-git-added-line",
        },
      }),
    );
  }
  return builder.finish();
}

export const setGitLineMarkersEffect = StateEffect.define<GitLineMarkers>();
const gitLineMarkersField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(decorations, transaction) {
    let nextDecorations = decorations;
    if (transaction.docChanged) {
      nextDecorations = nextDecorations.map(transaction.changes);
    }
    for (const effect of transaction.effects) {
      if (effect.is(setGitLineMarkersEffect)) {
        nextDecorations = buildGitLineDecorations(transaction.state.doc, effect.value);
      }
    }
    return nextDecorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function gitLineMarkersExtension(): Extension {
  return [gitLineMarkersField];
}

function formatAnnotationLineLabel(lineRange: CodeAnnotationLineRange) {
  return lineRange.startLine === lineRange.endLine
    ? `L${lineRange.startLine}`
    : `L${lineRange.startLine}-L${lineRange.endLine}`;
}

class CodeAnnotationMarkerWidget extends WidgetType {
  constructor(
    private readonly annotation: CodeAnnotationSelection,
    private readonly label: string,
    private readonly labels: { title: string; remove: string },
    private readonly callbacks: AnnotationWidgetCallbacks,
  ) {
    super();
  }

  eq(other: CodeAnnotationMarkerWidget) {
    return (
      other.annotation.id === this.annotation.id &&
      other.annotation.body === this.annotation.body &&
      other.label === this.label &&
      other.labels.title === this.labels.title &&
      other.labels.remove === this.labels.remove
    );
  }

  toDOM() {
    const root = document.createElement("div");
    root.className = "fvp-annotation-marker";
    root.setAttribute("role", "note");
    const head = document.createElement("div");
    head.className = "fvp-annotation-marker-head";
    const title = document.createElement("span");
    title.className = "fvp-annotation-title";
    const icon = document.createElement("span");
    icon.className = "codicon codicon-comment-discussion";
    icon.setAttribute("aria-hidden", "true");
    title.textContent = this.labels.title;
    title.prepend(icon);
    const tools = document.createElement("span");
    tools.className = "fvp-annotation-marker-tools";
    const line = document.createElement("code");
    line.textContent = this.label;
    tools.append(line);
    if (this.callbacks.onRemoveAnnotation) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "fvp-annotation-remove";
      removeButton.title = this.labels.remove;
      removeButton.setAttribute("aria-label", this.labels.remove);
      removeButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.callbacks.onRemoveAnnotation?.(this.annotation.id);
      });
      const removeIcon = document.createElement("span");
      removeIcon.className = "codicon codicon-close";
      removeIcon.setAttribute("aria-hidden", "true");
      removeButton.append(removeIcon);
      tools.append(removeButton);
    }
    head.append(title, tools);
    const body = document.createElement("p");
    body.textContent = this.annotation.body;
    root.append(head, body);
    return root;
  }
}

class CodeAnnotationDraftWidget extends WidgetType {
  constructor(
    private readonly draft: FileAnnotationDraftState,
    private readonly label: string,
    private readonly labels: {
      title: string;
      placeholder: string;
      cancel: string;
      submit: string;
    },
    private readonly callbacks: AnnotationWidgetCallbacks,
  ) {
    super();
  }

  eq(other: CodeAnnotationDraftWidget) {
    return (
      other.label === this.label &&
      other.draft.lineRange.startLine === this.draft.lineRange.startLine &&
      other.draft.lineRange.endLine === this.draft.lineRange.endLine
    );
  }

  toDOM() {
    const root = document.createElement("div");
    root.className = "fvp-annotation-draft fvp-annotation-draft-inline";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", this.labels.title);
    root.addEventListener("mousedown", (event) => event.stopPropagation());
    root.addEventListener("click", (event) => event.stopPropagation());

    const head = document.createElement("div");
    head.className = "fvp-annotation-draft-head";
    const title = document.createElement("span");
    title.className = "fvp-annotation-title";
    const icon = document.createElement("span");
    icon.className = "codicon codicon-comment-discussion";
    icon.setAttribute("aria-hidden", "true");
    title.textContent = this.labels.title;
    title.prepend(icon);
    const line = document.createElement("code");
    line.textContent = this.label;
    head.append(title, line);

    const textarea = document.createElement("textarea");
    textarea.className = "fvp-annotation-draft-input";
    textarea.value = this.draft.body;
    textarea.placeholder = this.labels.placeholder;

    const actions = document.createElement("div");
    actions.className = "fvp-annotation-draft-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "ghost fvp-action-btn";
    cancel.textContent = this.labels.cancel;
    cancel.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.callbacks.onDraftCancel();
    });

    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "fvp-annotation-submit";
    submit.textContent = this.labels.submit;
    submit.disabled = !this.draft.body.trim();
    submit.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.callbacks.onDraftConfirm(textarea.value);
    });
    textarea.addEventListener("input", () => {
      submit.disabled = !textarea.value.trim();
    });

    actions.append(cancel, submit);
    root.append(head, textarea, actions);
    queueMicrotask(() => {
      if (!textarea.isConnected) {
        return;
      }
      textarea.focus();
      const cursorPosition = textarea.value.length;
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });
    return root;
  }
}

export function codeAnnotationWidgetsExtension({
  annotations,
  draft,
  labels,
  callbacks,
}: {
  annotations: CodeAnnotationSelection[];
  draft: FileAnnotationDraftState | null;
  labels: {
    title: string;
    remove: string;
    placeholder: string;
    cancel: string;
    submit: string;
  };
  callbacks: AnnotationWidgetCallbacks;
}): Extension {
  return EditorView.decorations.compute([], (state) => {
    const builder = new RangeSetBuilder<Decoration>();
    const maxLine = state.doc.lines;
    const widgetTargets = resolveEditorAnnotationWidgetOrder({
      annotations,
      draft,
      maxLine,
    });
    widgetTargets.forEach((target) => {
      const line = state.doc.line(target.targetLine);
      const decoration =
        target.kind === "marker"
          ? Decoration.widget({
              widget: new CodeAnnotationMarkerWidget(
                target.annotation,
                formatAnnotationLineLabel(target.annotation.lineRange),
                labels,
                callbacks,
              ),
              block: true,
              side: target.side,
            })
          : Decoration.widget({
              widget: new CodeAnnotationDraftWidget(
                target.draft,
                formatAnnotationLineLabel(target.draft.lineRange),
                labels,
                callbacks,
              ),
              block: true,
              side: target.side,
            });
      builder.add(line.to, line.to, decoration);
    });
    return builder.finish();
  });
}
