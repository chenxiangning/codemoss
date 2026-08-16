import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import CodeMirror, {
  type ReactCodeMirrorProps,
  type ReactCodeMirrorRef,
} from "@uiw/react-codemirror";
import {
  Decoration,
  EditorView,
  GutterMarker,
  ViewPlugin,
  WidgetType,
  gutter,
  keymap,
  lineNumbers,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { closeSearchPanel, openSearchPanel, search, searchPanelOpen } from "@codemirror/search";
import { selectParentSyntax } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import {
  Compartment,
  Prec,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import type { CodeAnnotationSelection } from "@mossx/plugin-code-annotations/runtime";
import type { GitFileBlameResponse } from "../../../types";
import type { GitLineMarkers } from "../utils/gitLineMarkers";
import {
  findGitBlameHunk,
  formatGitBlameCompact,
  formatGitBlameDetails,
} from "../utils/gitBlame";
import type { FileGitBlameStatus } from "../hooks/useFileGitBlame";
import {
  codeAnnotationWidgetsExtension,
  gitLineMarkersExtension,
  setGitLineMarkersEffect,
} from "./fileViewPanelInternals";
import type {
  AnnotationWidgetCallbacks,
  FileAnnotationDraftState,
} from "./fileViewPanelShared";
import { toCodeMirrorShortcut } from "./fileViewPanelShared";
import type { FileCodeMirrorEditorHandle } from "./FileCodeMirrorEditor";
import {
  FileEditorGotoLineDialog,
  type FileEditorGotoLineDialogHandle,
  type FileEditorGotoLineLabels,
} from "./FileEditorGotoLineDialog";
import { focusEditorViewAtLocation } from "../utils/fileEditorLocation";
import { FILE_CONTEXT_MENU_SHORTCUTS } from "../utils/fileContextMenuShortcuts";

function resolveCodeMirrorShortcut(value: string): string {
  const shortcut = toCodeMirrorShortcut(value);
  if (!shortcut) {
    throw new Error(`[file-editor] Invalid shortcut definition: ${value}`);
  }
  return shortcut;
}

const GOTO_DEFINITION_SHORTCUT = resolveCodeMirrorShortcut(
  FILE_CONTEXT_MENU_SHORTCUTS.gotoDefinition,
);
const GOTO_IMPLEMENTATIONS_SHORTCUT = resolveCodeMirrorShortcut(
  FILE_CONTEXT_MENU_SHORTCUTS.gotoImplementations,
);
const FIND_REFERENCES_SHORTCUT = resolveCodeMirrorShortcut(
  FILE_CONTEXT_MENU_SHORTCUTS.findReferences,
);

export type FileCodeMirrorEditorProps = {
  filePath: string;
  value: string;
  onChange: (value: string) => void;
  onActiveFileLineRangeChange?: (range: { startLine: number; endLine: number } | null) => void;
  theme: ReactCodeMirrorProps["theme"];
  languageExtensions: ReactCodeMirrorProps["extensions"];
  gitLineMarkers: GitLineMarkers;
  gitBlameEnabled?: boolean;
  gitBlameStatus?: FileGitBlameStatus;
  gitBlameResponse?: GitFileBlameResponse | null;
  onGitBlameContextMenu?: (position: { x: number; y: number }) => void;
  fileCompareLineGaps?: FileCodeMirrorLineGap[];
  fileCompareCollapsedRanges?: FileCodeMirrorCollapsedRange[];
  lineNumberLabels?: readonly (number | null)[] | null;
  codeAnnotations: CodeAnnotationSelection[];
  annotationDraft: FileAnnotationDraftState | null;
  annotationWidgetLabels: {
    title: string;
    remove: string;
    placeholder: string;
    cancel: string;
    submit: string;
  };
  annotationWidgetCallbacks: AnnotationWidgetCallbacks;
  runDefinitionFromCursor: () => void;
  runImplementationsFromCursor?: () => void;
  runReferencesFromCursor: () => void;
  resolveDefinitionAtOffset: (offset: number, view?: EditorView) => void | Promise<void>;
  className?: string;
  lastReportedLineRangeRef: { current: string };
  saveFileShortcut: string | null | undefined;
  expandSelectionShortcut?: string | null;
  handleSave: () => void;
  gotoLineLabels?: FileEditorGotoLineLabels;
  editable?: boolean;
};

export type FileCodeMirrorLineGap = {
  lineNumber: number;
  count: number;
};

export type FileCodeMirrorCollapsedRange = {
  fromLine: number;
  toLine: number;
};

const navigationLineFlashEffect = StateEffect.define<number | null>();

type FileGitBlameGutterState = {
  status: FileGitBlameStatus;
  response: GitFileBlameResponse | null;
};

const EMPTY_GIT_BLAME_GUTTER_STATE: FileGitBlameGutterState = {
  status: "disabled",
  response: null,
};
export const setGitBlameGutterEffect = StateEffect.define<FileGitBlameGutterState>();
const gitBlameGutterField = StateField.define<FileGitBlameGutterState>({
  create: () => EMPTY_GIT_BLAME_GUTTER_STATE,
  update(current, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setGitBlameGutterEffect)) {
        return effect.value;
      }
    }
    return current;
  },
});

class FileGitBlameMarker extends GutterMarker {
  constructor(
    private readonly compact: string,
    private readonly details: string,
    private readonly stale: boolean,
  ) {
    super();
  }

  eq(other: FileGitBlameMarker) {
    return (
      this.compact === other.compact &&
      this.details === other.details &&
      this.stale === other.stale
    );
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = `cm-file-git-blame-marker${this.stale ? " is-stale" : ""}`;
    marker.title = this.details;
    marker.setAttribute("aria-label", this.details);
    const compact = document.createElement("span");
    compact.className = "cm-file-git-blame-compact";
    compact.textContent = this.compact;
    marker.append(compact);
    return marker;
  }
}

class FileGitBlameDetailsWidget extends WidgetType {
  constructor(
    private readonly details: string,
    private readonly stale: boolean,
  ) {
    super();
  }

  eq(other: FileGitBlameDetailsWidget) {
    return this.details === other.details && this.stale === other.stale;
  }

  toDOM() {
    const details = document.createElement("span");
    details.className = `cm-file-git-blame-inline-details${this.stale ? " is-stale" : ""}`;
    details.textContent = this.details;
    details.title = this.details;
    details.setAttribute("aria-label", this.details);
    return details;
  }

  ignoreEvent() {
    return true;
  }
}

function buildFileGitBlameDetailsDecorations(view: EditorView) {
  const blameState = view.state.field(gitBlameGutterField);
  if (!blameState.response) {
    return Decoration.none;
  }
  const currentLine = view.state.doc.lineAt(view.state.selection.main.head);
  const hunk = findGitBlameHunk(blameState.response.hunks, currentLine.number);
  if (!hunk) {
    return Decoration.none;
  }
  return Decoration.set([
    Decoration.widget({
      widget: new FileGitBlameDetailsWidget(
        formatGitBlameDetails(hunk),
        blameState.status === "stale",
      ),
      side: 1,
    }).range(currentLine.to),
  ]);
}

const fileGitBlameDetailsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildFileGitBlameDetailsDecorations(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.startState.field(gitBlameGutterField) !==
          update.state.field(gitBlameGutterField)
      ) {
        this.decorations = buildFileGitBlameDetailsDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
);

class FileGitBlameSpacerMarker extends GutterMarker {
  toDOM() {
    const spacer = document.createElement("span");
    spacer.className = "cm-file-git-blame-spacer";
    spacer.textContent = "0000-00-00 longest-author";
    return spacer;
  }
}

export function fileGitBlameGutterExtension(): Extension {
  return [
    gitBlameGutterField,
    fileGitBlameDetailsPlugin,
    gutter({
      class: "cm-file-git-blame-gutter",
      initialSpacer: () => new FileGitBlameSpacerMarker(),
      lineMarker(view, line) {
        const blameState = view.state.field(gitBlameGutterField);
        const lineNumber = view.state.doc.lineAt(line.from).number;
        const hunk = blameState.response
          ? findGitBlameHunk(blameState.response.hunks, lineNumber)
          : null;
        if (!hunk) {
          return null;
        }
        return new FileGitBlameMarker(
          formatGitBlameCompact(hunk),
          formatGitBlameDetails(hunk),
          blameState.status === "stale",
        );
      },
      lineMarkerChange(update) {
        return (
          update.selectionSet ||
          update.startState.field(gitBlameGutterField) !==
            update.state.field(gitBlameGutterField)
        );
      },
    }),
  ];
}

export function isFileGitBlameContextMenuTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(".cm-gutters"));
}

export function resolveFileCompareLineGapHeight(
  lineCount: number,
  defaultLineHeight: number,
) {
  return Math.max(0, lineCount) * Math.max(0, defaultLineHeight);
}

class FileCompareLineGapWidget extends WidgetType {
  constructor(private readonly lineCount: number) {
    super();
  }

  private updateHeight(element: HTMLElement, view: EditorView) {
    element.style.height = `${resolveFileCompareLineGapHeight(
      this.lineCount,
      view.defaultLineHeight,
    )}px`;
  }

  toDOM(view: EditorView) {
    const element = document.createElement("div");
    element.className = "cm-file-compare-line-gap";
    this.updateHeight(element, view);
    return element;
  }

  updateDOM(element: HTMLElement, view: EditorView) {
    this.updateHeight(element, view);
    return true;
  }

  ignoreEvent() {
    return true;
  }
}

class FileCompareCollapsedRangeWidget extends WidgetType {
  toDOM() {
    const element = document.createElement("div");
    element.className = "cm-file-compare-collapsed-range";
    return element;
  }

  ignoreEvent() {
    return true;
  }
}

type ModifierNavigationRange = { from: number; to: number };

const modifierNavigationRangeEffect = StateEffect.define<ModifierNavigationRange | null>();

const modifierNavigationDecorationField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let nextDecorations = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(modifierNavigationRangeEffect)) {
        continue;
      }
      nextDecorations = effect.value
        ? Decoration.set([
            Decoration.mark({ class: "cm-code-navigation-link" }).range(
              effect.value.from,
              effect.value.to,
            ),
          ])
        : Decoration.none;
    }
    return nextDecorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const NAVIGABLE_SYNTAX_NODE_PATTERN = /(?:Definition|Identifier|Name)$/;

export function resolveModifierNavigationSymbolRange(
  state: EditorState,
  position: number,
): ModifierNavigationRange | null {
  if (position < 0 || position > state.doc.length) {
    return null;
  }
  const word = state.wordAt(position);
  if (!word) {
    return null;
  }
  const syntaxNode = syntaxTree(state).resolveInner(position, -1);
  if (!NAVIGABLE_SYNTAX_NODE_PATTERN.test(syntaxNode.name)) {
    return null;
  }
  return { from: word.from, to: word.to };
}

class ModifierNavigationAffordance {
  private lastPointer: { x: number; y: number } | null = null;
  private modifierPressed = false;
  private activeRangeKey = "";

  constructor(private readonly view: EditorView) {
    view.dom.addEventListener("mousemove", this.handleMouseMove);
    view.dom.addEventListener("mouseleave", this.handleMouseLeave);
    window.addEventListener("keydown", this.handleKeyDown, true);
    window.addEventListener("keyup", this.handleKeyUp, true);
    window.addEventListener("blur", this.clear, true);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private applyRange = (range: ModifierNavigationRange | null) => {
    const rangeKey = range ? `${range.from}:${range.to}` : "";
    if (rangeKey === this.activeRangeKey) {
      return;
    }
    this.activeRangeKey = rangeKey;
    this.view.dispatch({ effects: modifierNavigationRangeEffect.of(range) });
  };

  private refresh = () => {
    if (!this.modifierPressed || !this.lastPointer) {
      this.applyRange(null);
      return;
    }
    const position = this.view.posAtCoords(this.lastPointer);
    this.applyRange(
      position == null
        ? null
        : resolveModifierNavigationSymbolRange(this.view.state, position),
    );
  };

  private handleMouseMove = (event: MouseEvent) => {
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.modifierPressed = event.metaKey || event.ctrlKey;
    this.refresh();
  };

  private handleMouseLeave = () => {
    this.lastPointer = null;
    this.applyRange(null);
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Meta" && event.key !== "Control") {
      return;
    }
    this.modifierPressed = true;
    this.refresh();
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    if (event.key !== "Meta" && event.key !== "Control") {
      return;
    }
    this.modifierPressed = false;
    this.applyRange(null);
  };

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.clear();
    }
  };

  private clear = () => {
    this.modifierPressed = false;
    this.applyRange(null);
  };

  destroy() {
    this.view.dom.removeEventListener("mousemove", this.handleMouseMove);
    this.view.dom.removeEventListener("mouseleave", this.handleMouseLeave);
    window.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("keyup", this.handleKeyUp, true);
    window.removeEventListener("blur", this.clear, true);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
  }
}

const modifierNavigationAffordanceExtension = [
  modifierNavigationDecorationField,
  ViewPlugin.fromClass(ModifierNavigationAffordance),
  EditorView.baseTheme({
    ".cm-code-navigation-link": {
      cursor: "pointer",
      textDecoration: "underline",
      textUnderlineOffset: "2px",
    },
  }),
];

function buildFileCompareLineGapDecorations(
  doc: { lines: number; length: number; line: (lineNumber: number) => { from: number } },
  gaps: FileCodeMirrorLineGap[],
) {
  if (gaps.length === 0) {
    return Decoration.none;
  }
  const sortedGaps = [...gaps]
    .filter((gap) => gap.count > 0 && Number.isFinite(gap.lineNumber))
    .sort((left, right) => left.lineNumber - right.lineNumber);
  return Decoration.set(
    sortedGaps.map((gap) => {
      const lineNumber = Math.max(1, Math.floor(gap.lineNumber));
      const position = lineNumber <= doc.lines ? doc.line(lineNumber).from : doc.length;
      return Decoration.widget({
        widget: new FileCompareLineGapWidget(gap.count),
        block: true,
        side: lineNumber <= doc.lines ? -1 : 1,
      }).range(position);
    }),
    true,
  );
}

const setFileCompareLineGapsEffect = StateEffect.define<FileCodeMirrorLineGap[]>();
const fileCompareLineGapsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, transaction) {
    let nextDecorations = decorations;
    if (transaction.docChanged) {
      nextDecorations = nextDecorations.map(transaction.changes);
    }
    for (const effect of transaction.effects) {
      if (effect.is(setFileCompareLineGapsEffect)) {
        nextDecorations = buildFileCompareLineGapDecorations(
          transaction.state.doc,
          effect.value,
        );
      }
    }
    return nextDecorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function buildFileCompareCollapsedRangeDecorations(
  doc: { lines: number; line: (lineNumber: number) => { from: number; to: number } },
  ranges: FileCodeMirrorCollapsedRange[],
) {
  const decorations = ranges.flatMap((range) => {
    const fromLine = Math.max(1, Math.min(doc.lines, Math.floor(range.fromLine)));
    const toLine = Math.max(fromLine, Math.min(doc.lines, Math.floor(range.toLine)));
    const from = doc.line(fromLine).from;
    const to = doc.line(toLine).to;
    return to > from
      ? [Decoration.replace({
          widget: new FileCompareCollapsedRangeWidget(),
          block: true,
        }).range(from, to)]
      : [];
  });
  return Decoration.set(decorations, true);
}

const setFileCompareCollapsedRangesEffect =
  StateEffect.define<FileCodeMirrorCollapsedRange[]>();
const fileCompareCollapsedRangesField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let nextDecorations = transaction.docChanged
      ? decorations.map(transaction.changes)
      : decorations;
    for (const effect of transaction.effects) {
      if (effect.is(setFileCompareCollapsedRangesEffect)) {
        nextDecorations = buildFileCompareCollapsedRangeDecorations(
          transaction.state.doc,
          effect.value,
        );
      }
    }
    return nextDecorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const navigationLineFlashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(markers, transaction) {
    let nextMarkers = markers.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(navigationLineFlashEffect)) {
        continue;
      }
      const lineNumber = effect.value;
      if (lineNumber === null) {
        nextMarkers = Decoration.none;
        continue;
      }
      if (lineNumber < 1 || lineNumber > transaction.state.doc.lines) {
        nextMarkers = Decoration.none;
        continue;
      }
      const line = transaction.state.doc.line(lineNumber);
      nextMarkers = Decoration.set([
        Decoration.line({ class: "cm-navigation-line-flash" }).range(line.from),
      ]);
    }
    return nextMarkers;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const FileCodeMirrorEditorImpl = forwardRef<
  FileCodeMirrorEditorHandle,
  FileCodeMirrorEditorProps
>(function FileCodeMirrorEditorImpl(props, ref) {
  const {
    filePath,
    value,
    onChange,
    onActiveFileLineRangeChange,
    theme,
    languageExtensions,
    gitLineMarkers,
    gitBlameEnabled = false,
    gitBlameStatus = "disabled",
    gitBlameResponse = null,
    onGitBlameContextMenu,
    fileCompareLineGaps = [],
    fileCompareCollapsedRanges = [],
    lineNumberLabels = null,
    codeAnnotations,
    annotationDraft,
    annotationWidgetLabels,
    annotationWidgetCallbacks,
    runDefinitionFromCursor,
    runImplementationsFromCursor,
    runReferencesFromCursor,
    resolveDefinitionAtOffset,
    className,
    lastReportedLineRangeRef,
    saveFileShortcut,
    expandSelectionShortcut = "cmd+w",
    handleSave,
    gotoLineLabels,
    editable = true,
  } = props;
  const codeMirrorRef = useRef<ReactCodeMirrorRef | null>(null);
  const gotoLineDialogRef = useRef<FileEditorGotoLineDialogHandle | null>(null);
  const gitBlameCompartment = useMemo(() => new Compartment(), []);
  const gitBlameExtension = useMemo(() => fileGitBlameGutterExtension(), []);
  const gitBlameInstalledRef = useRef(false);
  const onGitBlameContextMenuRef = useRef(onGitBlameContextMenu);
  onGitBlameContextMenuRef.current = onGitBlameContextMenu;

  // Keep a ref to the latest `handleSave` so the keymap (memoized on
  // shortcut) always invokes the most recent callback.
  const handleSaveRef = useRef<() => void>(handleSave);
  handleSaveRef.current = handleSave;
  const saveKeymapExt = useMemo<Extension[]>(() => {
    const codeMirrorSaveShortcut = toCodeMirrorShortcut(saveFileShortcut);
    if (!codeMirrorSaveShortcut) {
      return [];
    }
    const ext = keymap.of([
      {
        key: codeMirrorSaveShortcut,
        run: () => {
          handleSaveRef.current();
          return true;
        },
      },
    ]);
    return [ext];
  }, [saveFileShortcut]);

  const expandSelectionKeymapExt = useMemo<Extension[]>(() => {
    const codeMirrorShortcut = toCodeMirrorShortcut(expandSelectionShortcut);
    if (!codeMirrorShortcut) {
      return [];
    }
    const shortcuts = new Set([codeMirrorShortcut]);
    // ponytail: `ctrl+w` 是上一版未发布的默认值，仅为该值补 Mod-W 兼容；
    // 用户改成其他 shortcut 或清空后，不注册隐藏 binding。
    if (codeMirrorShortcut === "Ctrl-w") {
      shortcuts.add("Mod-w");
    }
    return [Prec.highest(keymap.of(Array.from(shortcuts, (key) => ({
      key,
      run: selectParentSyntax,
      preventDefault: true,
    }))))];
  }, [expandSelectionShortcut]);

  const editorNavigationKeymapExt = useMemo<Extension[]>(
    () => [
      navigationLineFlashField,
      Prec.highest(keymap.of([
        {
          key: "Mod-f",
          run: (view) => {
            if (searchPanelOpen(view.state)) {
              closeSearchPanel(view);
            } else {
              openSearchPanel(view);
            }
            view.focus();
            return true;
          },
        },
        {
          key: "Mod-g",
          run: (view) => gotoLineDialogRef.current?.open(view) ?? false,
        },
        {
          key: GOTO_DEFINITION_SHORTCUT,
          run: () => {
            runDefinitionFromCursor();
            return true;
          },
        },
        ...(runImplementationsFromCursor
          ? [{
              key: GOTO_IMPLEMENTATIONS_SHORTCUT,
              run: () => {
                runImplementationsFromCursor();
                return true;
              },
            }]
          : []),
        {
          key: FIND_REFERENCES_SHORTCUT,
          run: () => {
            runReferencesFromCursor();
            return true;
          },
        },
      ])),
    ],
    [runDefinitionFromCursor, runImplementationsFromCursor, runReferencesFromCursor],
  );

  const ctrlClickDefinitionExt = useMemo(
    () =>
      EditorView.domEventHandlers({
        mousedown: (event, view) => {
          if (event.button !== 0) {
            return false;
          }
          if (!(event.metaKey || event.ctrlKey)) {
            return false;
          }
          const offset = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (offset == null) {
            return false;
          }
          event.preventDefault();
          void resolveDefinitionAtOffset(offset, view);
          return true;
        },
      }),
    [resolveDefinitionAtOffset],
  );

  const gitBlameContextMenuExt = useMemo(
    () =>
      EditorView.domEventHandlers({
        contextmenu: (event) => {
          if (!isFileGitBlameContextMenuTarget(event.target)) {
            return false;
          }
          const callback = onGitBlameContextMenuRef.current;
          if (!callback) {
            return false;
          }
          event.preventDefault();
          callback({ x: event.clientX, y: event.clientY });
          return true;
        },
      }),
    [],
  );

  const persistentSearchExtension = useMemo(() => search({ top: true }), []);
  const historicalLineNumbersExtension = useMemo(
    () => lineNumberLabels
      ? lineNumbers({
          formatNumber: (lineNumber) => String(lineNumberLabels[lineNumber - 1] ?? ""),
        })
      : null,
    [lineNumberLabels],
  );
  const annotationWidgetsExt = useMemo(
    () =>
      codeAnnotationWidgetsExtension({
        annotations: codeAnnotations,
        draft: annotationDraft,
        labels: annotationWidgetLabels,
        callbacks: annotationWidgetCallbacks,
      }),
    [
      annotationDraft,
      annotationWidgetCallbacks,
      annotationWidgetLabels,
      codeAnnotations,
    ],
  );

  const composedExtensions: ReactCodeMirrorProps["extensions"] = useMemo(
    () => [
      EditorView.editable.of(editable),
      saveKeymapExt,
      expandSelectionKeymapExt,
      editorNavigationKeymapExt,
      ctrlClickDefinitionExt,
      modifierNavigationAffordanceExtension,
      gitBlameContextMenuExt,
      persistentSearchExtension,
      annotationWidgetsExt,
      gitLineMarkersExtension(),
      gitBlameCompartment.of([]),
      fileCompareLineGapsField,
      fileCompareCollapsedRangesField,
      ...(historicalLineNumbersExtension ? [historicalLineNumbersExtension] : []),
      ...(Array.isArray(languageExtensions)
        ? languageExtensions
        : languageExtensions
          ? [languageExtensions]
          : []),
    ],
    [
      annotationWidgetsExt,
      ctrlClickDefinitionExt,
      editorNavigationKeymapExt,
      gitBlameCompartment,
      gitBlameContextMenuExt,
      historicalLineNumbersExtension,
      languageExtensions,
      persistentSearchExtension,
      saveKeymapExt,
      expandSelectionKeymapExt,
      editable,
    ],
  );

  const clearNavigationFlash = () => {
    const view = codeMirrorRef.current?.view;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: navigationLineFlashEffect.of(null),
    });
  };

  useImperativeHandle(ref, () => ({
    get view() {
      return codeMirrorRef.current?.view;
    },
    get state() {
      return codeMirrorRef.current?.state;
    },
    expandSelection() {
      const view = codeMirrorRef.current?.view;
      if (!view) {
        return false;
      }
      const expanded = selectParentSyntax(view);
      view.focus();
      return expanded;
    },
    openFindPanel() {
      const view = codeMirrorRef.current?.view;
      if (!view) {
        return false;
      }
      openSearchPanel(view);
      view.focus();
      return true;
    },
    toggleFindPanel() {
      const view = codeMirrorRef.current?.view;
      if (!view) {
        return false;
      }
      if (searchPanelOpen(view.state)) {
        closeSearchPanel(view);
      } else {
        openSearchPanel(view);
      }
      view.focus();
      return true;
    },
    focusLocation(line, column, scrollPosition = "nearest", endLine) {
      const view = codeMirrorRef.current?.view;
      return view
        ? focusEditorViewAtLocation(view, line, column, scrollPosition, endLine)
        : false;
    },
    flashNavigationLine(line) {
      const view = codeMirrorRef.current?.view;
      if (!view || line < 1 || line > view.state.doc.lines) {
        return false;
      }
      view.dispatch({
        effects: navigationLineFlashEffect.of(line),
      });
      return true;
    },
    clearNavigationFlash,
  }), []);

  useEffect(() => {
    const view = codeMirrorRef.current?.view;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: setGitLineMarkersEffect.of(gitLineMarkers),
    });
  }, [gitLineMarkers, filePath]);

  useEffect(() => {
    const view = codeMirrorRef.current?.view;
    if (!view) {
      return;
    }
    if (!gitBlameEnabled) {
      if (gitBlameInstalledRef.current) {
        view.dispatch({ effects: gitBlameCompartment.reconfigure([]) });
        gitBlameInstalledRef.current = false;
      }
      return;
    }
    if (!gitBlameInstalledRef.current) {
      view.dispatch({ effects: gitBlameCompartment.reconfigure(gitBlameExtension) });
      gitBlameInstalledRef.current = true;
    }
    view.dispatch({
      effects: setGitBlameGutterEffect.of({
        status: gitBlameStatus,
        response: gitBlameResponse,
      }),
    });
  }, [
    filePath,
    gitBlameCompartment,
    gitBlameEnabled,
    gitBlameExtension,
    gitBlameResponse,
    gitBlameStatus,
  ]);

  useEffect(() => {
    const view = codeMirrorRef.current?.view;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: setFileCompareLineGapsEffect.of(fileCompareLineGaps),
    });
  }, [fileCompareLineGaps, filePath]);

  useEffect(() => {
    const view = codeMirrorRef.current?.view;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: setFileCompareCollapsedRangesEffect.of(fileCompareCollapsedRanges),
    });
  }, [fileCompareCollapsedRanges, filePath]);

  return (
    <div className="fvp-editor">
      <CodeMirror
        key={filePath}
        ref={codeMirrorRef}
        value={value}
        onChange={onChange}
        onCreateEditor={(view) => {
          gitBlameInstalledRef.current = false;
          view.dispatch({
            effects: [
              setGitLineMarkersEffect.of(gitLineMarkers),
              setFileCompareLineGapsEffect.of(fileCompareLineGaps),
              setFileCompareCollapsedRangesEffect.of(fileCompareCollapsedRanges),
            ],
          });
          if (gitBlameEnabled) {
            view.dispatch({ effects: gitBlameCompartment.reconfigure(gitBlameExtension) });
            gitBlameInstalledRef.current = true;
            view.dispatch({
              effects: setGitBlameGutterEffect.of({
                status: gitBlameStatus,
                response: gitBlameResponse,
              }),
            });
          }
        }}
        onUpdate={(update) => {
          if (!update.selectionSet) {
            return;
          }
          const mainSelection = update.state.selection.main;
          const from = Math.min(mainSelection.from, mainSelection.to);
          const to = Math.max(mainSelection.from, mainSelection.to);
          const startLine = update.state.doc.lineAt(from).number;
          const endLine = update.state.doc.lineAt(to).number;
          const rangeKey = `${startLine}-${endLine}`;
          if (rangeKey === lastReportedLineRangeRef.current) {
            return;
          }
          lastReportedLineRangeRef.current = rangeKey;
          onActiveFileLineRangeChange?.({ startLine, endLine });
        }}
        extensions={composedExtensions}
        theme={theme}
        className={className ?? "fvp-cm"}
        basicSetup={{
          lineNumbers: lineNumberLabels === null,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          highlightActiveLine: true,
          indentOnInput: true,
          tabSize: 2,
        }}
      />
      {gotoLineLabels ? (
        <FileEditorGotoLineDialog ref={gotoLineDialogRef} labels={gotoLineLabels} />
      ) : null}
    </div>
  );
});
