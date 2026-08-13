import type { ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import FileSearch from "lucide-react/dist/esm/icons/file-search";
import FileText from "lucide-react/dist/esm/icons/file-text";
import GitBranch from "lucide-react/dist/esm/icons/git-branch";
import LinkIcon from "lucide-react/dist/esm/icons/link";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import MessageSquareText from "lucide-react/dist/esm/icons/message-square-text";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Save from "lucide-react/dist/esm/icons/save";

import { cn } from "../../../lib/utils";
import type { IntentCanvasDocument } from "../types";
import { loadProjectMapRelationshipImportSourceState } from "../services/relationshipImportQueries";
import { buildIntentCanvasTransmissionContext } from "../utils/context";
import {
  buildTraceabilityProjection,
  isProjectMapRelationshipGraph,
  type IntentCanvasEvidenceBacklink,
  type IntentCanvasSourceBacklink,
  type IntentCanvasSourceLocation,
  type RelationshipSourceRuntimeState,
} from "../utils/traceability";
import { buildIntentCanvasAiContext, sanitizeIntentCanvasScene } from "../utils/scene";

export function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}


export type IntentCanvasOpenSourceFile = (path: string, location?: IntentCanvasSourceLocation) => void;

export type IntentCanvasEditorProps = {
  document: IntentCanvasDocument;
  activeThreadId: string | null;
  isSaving: boolean;
  onBack: () => void;
  onSave: (document: IntentCanvasDocument) => Promise<IntentCanvasDocument>;
  onAttachToThread?: (document: IntentCanvasDocument) => Promise<void> | void;
  onOpenProjectMap?: () => void;
  onOpenSourceFile?: IntentCanvasOpenSourceFile;
  managerErrorMessage?: string | null;
};

const LazyExcalidraw = lazy(async () => {
  const module = await import("@excalidraw/excalidraw");
  return { default: module.Excalidraw };
});

function formatDateTime(value: string): string {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}


function parseMultilineLinks(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|,/g)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function linksToText(values: string[]): string {
  return values.join("\n");
}

function resolveIntentCanvasTheme(): "light" | "dark" {
  if (typeof document === "undefined") {
    return "dark";
  }
  const root = document.documentElement;
  const presetAppearance = root.dataset.themePresetAppearance;
  if (presetAppearance === "light" || presetAppearance === "dark") {
    return presetAppearance;
  }
  if (root.dataset.theme === "system" && typeof window !== "undefined") {
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return root.dataset.theme === "light" ? "light" : "dark";
}

function useIntentCanvasTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">(() => resolveIntentCanvasTheme());

  useEffect(() => {
    if (
      typeof document === "undefined" ||
      typeof window === "undefined" ||
      typeof MutationObserver === "undefined"
    ) {
      return undefined;
    }
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(resolveIntentCanvasTheme());
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "data-theme-preset-appearance"],
    });
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: light)");
    const handleSystemThemeChange = () => {
      setTheme(resolveIntentCanvasTheme());
    };
    mediaQuery?.addEventListener?.("change", handleSystemThemeChange);
    return () => {
      observer.disconnect();
      mediaQuery?.removeEventListener?.("change", handleSystemThemeChange);
    };
  }, []);

  return theme;
}


export function IntentCanvasEditor({
  document,
  activeThreadId,
  isSaving,
  onBack,
  onSave,
  onAttachToThread,
  onOpenProjectMap,
  onOpenSourceFile,
  managerErrorMessage = null,
}: IntentCanvasEditorProps) {
  const { t, i18n } = useTranslation();
  const excalidrawTheme = useIntentCanvasTheme();
  const [title, setTitle] = useState(document.title);
  const [summary, setSummary] = useState(document.summary);
  const [fileLinksText, setFileLinksText] = useState(linksToText(document.links.filePaths));
  const [nodeLinksText, setNodeLinksText] = useState(linksToText(document.links.projectMapNodeIds));
  const [threadLinksText, setThreadLinksText] = useState(linksToText(document.links.threadIds));
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leftRailCollapsed, setLeftRailCollapsed] = useState(false);
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false);
  const [relationshipSourceState, setRelationshipSourceState] =
    useState<RelationshipSourceRuntimeState>({ status: "idle", value: null, error: null });
  const [elementCount, setElementCount] = useState(
    document.scene.elements.filter((element) => !element.isDeleted).length,
  );
  const sceneRef = useRef(document.scene);

  useEffect(() => {
    setTitle(document.title);
    setSummary(document.summary);
    setFileLinksText(linksToText(document.links.filePaths));
    setNodeLinksText(linksToText(document.links.projectMapNodeIds));
    setThreadLinksText(linksToText(document.links.threadIds));
    setIsDirty(false);
    setSaveError(null);
    sceneRef.current = document.scene;
    setElementCount(document.scene.elements.filter((element) => !element.isDeleted).length);
  }, [document]);

  const initialData = useMemo<ExcalidrawInitialDataState>(
    () => ({
      elements: document.scene.elements,
      appState: document.scene.appState,
      files: document.scene.files,
    }),
    [document.scene.appState, document.scene.elements, document.scene.files],
  );

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setSaveError(null);
  }, []);

  const handleSceneChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      const nextScene = sanitizeIntentCanvasScene(elements, appState, files);
      sceneRef.current = nextScene;
      setElementCount(elements.filter((element) => !element.isDeleted).length);
      setIsDirty(true);
    },
    [],
  );

  const buildDraftDocument = useCallback(
    (options: { includeActiveThread: boolean }): IntentCanvasDocument => {
      const threadIds = parseMultilineLinks(threadLinksText);
      const nextThreadIds =
        options.includeActiveThread && activeThreadId
          ? Array.from(new Set([...threadIds, activeThreadId]))
          : threadIds;
      const safeTitle = title.trim() || t("intentCanvas.untitled");
      const safeSummary = summary.trim();
      const nextScene = sceneRef.current;
      return {
        ...document,
        title: safeTitle,
        summary: safeSummary,
        links: {
          filePaths: parseMultilineLinks(fileLinksText),
          projectMapNodeIds: parseMultilineLinks(nodeLinksText),
          threadIds: nextThreadIds,
        },
        scene: nextScene,
        aiContext: buildIntentCanvasAiContext(nextScene, safeSummary),
      };
    },
    [activeThreadId, document, fileLinksText, nodeLinksText, summary, t, threadLinksText, title],
  );

  const handleSave = useCallback(async () => {
    try {
      const savedDocument = await onSave(buildDraftDocument({ includeActiveThread: false }));
      setIsDirty(false);
      setSaveError(null);
      return savedDocument;
    } catch (error) {
      const message = normalizeError(error);
      setSaveError(message);
      return null;
    }
  }, [buildDraftDocument, onSave]);

  const handleAttachToThread = useCallback(async () => {
    if (!onAttachToThread) {
      return;
    }
    try {
      const savedDocument = await onSave(buildDraftDocument({ includeActiveThread: true }));
      setIsDirty(false);
      setSaveError(null);
      await onAttachToThread(savedDocument);
    } catch (error) {
      setSaveError(normalizeError(error));
    }
  }, [buildDraftDocument, onAttachToThread, onSave]);

  const metadataChange = useCallback((next: () => void) => {
    next();
    markDirty();
  }, [markDirty]);

  const langCode = i18n.resolvedLanguage?.startsWith("zh") || i18n.language.startsWith("zh")
    ? "zh-CN"
    : "en";
  const hasProjectMapImportSource =
    document.links.projectMapNodeIds.length > 0 ||
    document.semanticGraphs.some((graph) => graph.sourceSnapshot?.kind === "project-map-relations");
  const relationshipGraphSourceKey = useMemo(
    () => document.semanticGraphs
      .filter(isProjectMapRelationshipGraph)
      .map((graph) => `${graph.graphId}:${graph.sourceSnapshot?.scanRunId ?? "unknown"}`)
      .join("|"),
    [document.semanticGraphs],
  );
  const runtimeRelationshipSourceState =
    relationshipSourceState.status === "ready" ? relationshipSourceState.value : null;
  const traceabilityProjection = useMemo(
    () => buildTraceabilityProjection(document.semanticGraphs, runtimeRelationshipSourceState),
    [document.semanticGraphs, runtimeRelationshipSourceState],
  );

  useEffect(() => {
    if (!relationshipGraphSourceKey) {
      setRelationshipSourceState({ status: "idle", value: null, error: null });
      return undefined;
    }
    let cancelled = false;
    setRelationshipSourceState({ status: "loading", value: null, error: null });
    loadProjectMapRelationshipImportSourceState({
      workspaceId: document.workspace.id,
    })
      .then((sourceState) => {
        if (!cancelled) {
          setRelationshipSourceState({ status: "ready", value: sourceState, error: null });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRelationshipSourceState({
            status: "error",
            value: null,
            error: normalizeError(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [document.workspace.id, relationshipGraphSourceKey]);

  const handleOpenBacklink = useCallback((backlink: IntentCanvasSourceBacklink | IntentCanvasEvidenceBacklink) => {
    if (!onOpenSourceFile || !backlink.path || backlink.unresolved) {
      return;
    }
    onOpenSourceFile(backlink.path, backlink.location ?? undefined);
  }, [onOpenSourceFile]);

  return (
    <section className="intent-canvas-editor" aria-label={t("intentCanvas.editor.ariaLabel")}> 
      <header className="intent-canvas-editor-topbar">
        <div className="intent-canvas-editor-titlebar">
          <button type="button" className="intent-canvas-icon-button" onClick={onBack}>
            <ArrowLeft aria-hidden />
            <span>{t("intentCanvas.editor.back")}</span>
          </button>
          <div className="intent-canvas-editor-title-meta">
            <h2>{title.trim() || t("intentCanvas.untitled")}</h2>
          </div>
        </div>
        {onOpenProjectMap && hasProjectMapImportSource ? (
          <button
            type="button"
            className="intent-canvas-source-link"
            onClick={onOpenProjectMap}
          >
            <LinkIcon aria-hidden />
            {t("intentCanvas.editor.backToProjectMap")}
          </button>
        ) : null}
        <div className="intent-canvas-editor-actions">
          <span className={cn("intent-canvas-save-state", isDirty && "is-dirty")}>
            {isSaving ? t("intentCanvas.saving") : isDirty ? t("intentCanvas.unsaved") : t("intentCanvas.saved")}
          </span>
          <button type="button" onClick={() => void handleSave()} disabled={isSaving}>
            <Save aria-hidden />
            {t("intentCanvas.editor.save")}
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={() => void handleAttachToThread()}
            disabled={isSaving || !onAttachToThread}
          >
            <MessageSquareText aria-hidden />
            {t("intentCanvas.editor.attachToThread")}
          </button>
        </div>
      </header>

      <div
        className={cn(
          "intent-canvas-editor-body",
          leftRailCollapsed && "is-left-collapsed",
          rightRailCollapsed && "is-right-collapsed",
        )}
      >
        <aside className={cn("intent-canvas-rail is-left", leftRailCollapsed && "is-collapsed")}>
          <div className="intent-canvas-rail-header">
            <span>{t("intentCanvas.editor.leftRail")}</span>
            <button
              type="button"
              className="intent-canvas-rail-toggle"
              onClick={() => setLeftRailCollapsed((current) => !current)}
              aria-label={
                leftRailCollapsed
                  ? t("intentCanvas.editor.expandLeftRail")
                  : t("intentCanvas.editor.collapseLeftRail")
              }
              title={
                leftRailCollapsed
                  ? t("intentCanvas.editor.expandLeftRail")
                  : t("intentCanvas.editor.collapseLeftRail")
              }
            >
              <ArrowLeft aria-hidden className={leftRailCollapsed ? "is-flipped" : undefined} />
              <span>
                {leftRailCollapsed
                  ? t("intentCanvas.editor.expandLeftRail")
                  : t("intentCanvas.editor.collapseLeftRail")}
              </span>
            </button>
          </div>
          {!leftRailCollapsed ? (
            <>
              <section className="intent-canvas-card">
                <h3>{t("intentCanvas.editor.metadata")}</h3>
                <label>
                  <span>{t("intentCanvas.editor.title")}</span>
                  <input
                    value={title}
                    onChange={(event) => metadataChange(() => setTitle(event.currentTarget.value))}
                  />
                </label>
                <label>
                  <span>{t("intentCanvas.editor.summary")}</span>
                  <textarea
                    value={summary}
                    rows={5}
                    placeholder={t("intentCanvas.editor.summaryPlaceholder")}
                    onChange={(event) => metadataChange(() => setSummary(event.currentTarget.value))}
                  />
                </label>
              </section>
              <section className="intent-canvas-card">
                <h3>{t("intentCanvas.editor.links")}</h3>
                <label>
                  <span>{t("intentCanvas.editor.fileLinks")}</span>
                  <textarea
                    value={fileLinksText}
                    rows={4}
                    placeholder="src/services/order.ts"
                    onChange={(event) => metadataChange(() => setFileLinksText(event.currentTarget.value))}
                  />
                </label>
                <label>
                  <span>{t("intentCanvas.editor.projectMapNodeLinks")}</span>
                  <textarea
                    value={nodeLinksText}
                    rows={3}
                    placeholder="project-map-node-id"
                    onChange={(event) => metadataChange(() => setNodeLinksText(event.currentTarget.value))}
                  />
                </label>
                <label>
                  <span>{t("intentCanvas.editor.threadLinks")}</span>
                  <textarea
                    value={threadLinksText}
                    rows={3}
                    placeholder={activeThreadId ?? "thread-id"}
                    onChange={(event) => metadataChange(() => setThreadLinksText(event.currentTarget.value))}
                  />
                </label>
              </section>
            </>
          ) : null}
        </aside>

        <main className="intent-canvas-excalidraw-shell">
          <Suspense
            fallback={
              <div className="intent-canvas-loading">
                <LoaderCircle aria-hidden className="is-spinning" /> {t("intentCanvas.loading")}
              </div>
            }
          >
            <LazyExcalidraw
              key={document.id}
              initialData={initialData}
              onChange={handleSceneChange}
              name={title.trim() || document.title}
              langCode={langCode}
              gridModeEnabled
              objectsSnapModeEnabled
              theme={excalidrawTheme}
              UIOptions={{
                canvasActions: {
                  loadScene: false,
                  saveToActiveFile: false,
                  export: false,
                },
              }}
            />
          </Suspense>
        </main>

        <aside className={cn("intent-canvas-rail is-right", rightRailCollapsed && "is-collapsed")}>
          <div className="intent-canvas-rail-header">
            <span>{t("intentCanvas.editor.rightRail")}</span>
            <button
              type="button"
              className="intent-canvas-rail-toggle"
              onClick={() => setRightRailCollapsed((current) => !current)}
              aria-label={
                rightRailCollapsed
                  ? t("intentCanvas.editor.expandRightRail")
                  : t("intentCanvas.editor.collapseRightRail")
              }
              title={
                rightRailCollapsed
                  ? t("intentCanvas.editor.expandRightRail")
                  : t("intentCanvas.editor.collapseRightRail")
              }
            >
              <ArrowLeft aria-hidden className={rightRailCollapsed ? undefined : "is-flipped"} />
              <span>
                {rightRailCollapsed
                  ? t("intentCanvas.editor.expandRightRail")
                  : t("intentCanvas.editor.collapseRightRail")}
              </span>
            </button>
          </div>
          {!rightRailCollapsed ? (
            <>
              <section className="intent-canvas-card is-accent">
                <h3>{t("intentCanvas.editor.aiContext")}</h3>
                <p>{t("intentCanvas.editor.aiContextHint")}</p>
                <dl className="intent-canvas-metrics">
                  <div>
                    <dt>{t("intentCanvas.editor.elements")}</dt>
                    <dd>{elementCount}</dd>
                  </div>
                  <div>
                    <dt>{t("intentCanvas.editor.files")}</dt>
                    <dd>{parseMultilineLinks(fileLinksText).length}</dd>
                  </div>
                  <div>
                    <dt>{t("intentCanvas.editor.nodes")}</dt>
                    <dd>{parseMultilineLinks(nodeLinksText).length}</dd>
                  </div>
                </dl>
              </section>
              {traceabilityProjection.importedGraphCount > 0 || traceabilityProjection.codeSelectionBacklinks.length > 0 ? (
                <section className="intent-canvas-card intent-canvas-source-trace-card">
                  <h3>{t("intentCanvas.editor.sourceTraceability")}</h3>
                  <p>{t("intentCanvas.editor.sourceTraceabilityHint")}</p>
                  <dl className="intent-canvas-metrics intent-canvas-source-health">
                    <div>
                      <dt>{t("intentCanvas.editor.sourceImportedGraphs")}</dt>
                      <dd>{traceabilityProjection.importedGraphCount}</dd>
                    </div>
                    <div className={traceabilityProjection.staleGraphCount > 0 ? "is-warning" : undefined}>
                      <dt>{t("intentCanvas.editor.sourceStaleGraphs")}</dt>
                      <dd>{traceabilityProjection.staleGraphCount}</dd>
                    </div>
                    <div className={traceabilityProjection.unresolvedAnchorCount > 0 ? "is-warning" : undefined}>
                      <dt>{t("intentCanvas.editor.sourceUnresolvedAnchors")}</dt>
                      <dd>{traceabilityProjection.unresolvedAnchorCount}</dd>
                    </div>
                  </dl>
                  {relationshipSourceState.status === "loading" ? (
                    <p className="intent-canvas-source-notice">
                      <LoaderCircle aria-hidden className="is-spinning" />
                      {t("intentCanvas.editor.sourceStatusLoading")}
                    </p>
                  ) : null}
                  {relationshipSourceState.status === "error" ? (
                    <p className="intent-canvas-source-notice is-warning">
                      <AlertTriangle aria-hidden />
                      {t("intentCanvas.editor.sourceStatusError", { message: relationshipSourceState.error })}
                    </p>
                  ) : null}
                  {relationshipSourceState.status === "ready" && !relationshipSourceState.value.exists ? (
                    <p className="intent-canvas-source-notice is-warning">
                      <AlertTriangle aria-hidden />
                      {t("intentCanvas.editor.sourceStatusUnavailable")}
                    </p>
                  ) : null}
                  {relationshipSourceState.status === "ready" && relationshipSourceState.value.scan ? (
                    <button
                      type="button"
                      className="intent-canvas-source-notice intent-canvas-source-link-notice"
                      onClick={onOpenProjectMap}
                      disabled={!onOpenProjectMap}
                      title={t("intentCanvas.editor.sourceRefreshHint")}
                    >
                      <GitBranch aria-hidden />
                      {t("intentCanvas.editor.sourceLatestScan", {
                        scanRunId: relationshipSourceState.value.scan.scanRunId,
                      })}
                    </button>
                  ) : null}
                  {traceabilityProjection.staleGraphCount > 0 ? (
                    <p className="intent-canvas-source-notice is-warning">
                      <AlertTriangle aria-hidden />
                      {t("intentCanvas.editor.sourceStaleNotice", {
                        count: traceabilityProjection.staleGraphCount,
                      })}
                    </p>
                  ) : null}
                  {traceabilityProjection.unresolvedAnchorCount > 0 ? (
                    <p className="intent-canvas-source-notice is-warning">
                      <AlertTriangle aria-hidden />
                      {t("intentCanvas.editor.sourceUnresolvedNotice", {
                        count: traceabilityProjection.unresolvedAnchorCount,
                      })}
                    </p>
                  ) : null}
                  {traceabilityProjection.codeSelectionBacklinks.length > 0 ? (
                    <div className="intent-canvas-source-list">
                      <strong>{t("intentCanvas.editor.sourceCodeSelection")}</strong>
                      {traceabilityProjection.codeSelectionBacklinks.slice(0, 4).map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          className="intent-canvas-source-action"
                          onClick={() => handleOpenBacklink(source)}
                          disabled={!onOpenSourceFile}
                          aria-label={t("intentCanvas.editor.sourceOpenCodeSelection", {
                            path: source.path,
                            line: source.location?.line ?? 1,
                          })}
                          title={source.path}
                        >
                          <FileText aria-hidden />
                          <span>{source.label}</span>
                          <small>{source.detail}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {traceabilityProjection.sourceBacklinks.length > 0 ? (
                    <div className="intent-canvas-source-list">
                      <strong>{t("intentCanvas.editor.sourceFiles")}</strong>
                      {traceabilityProjection.sourceBacklinks.slice(0, 6).map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          className={cn("intent-canvas-source-action", source.unresolved && "is-unresolved")}
                          onClick={() => handleOpenBacklink(source)}
                          disabled={!onOpenSourceFile || source.unresolved}
                          aria-label={
                            source.location
                              ? t("intentCanvas.editor.sourceOpenFileAtLine", {
                                  path: source.path,
                                  line: source.location.line,
                                })
                              : t("intentCanvas.editor.sourceOpenFile", { path: source.path })
                          }
                          title={source.unresolved ? t("intentCanvas.editor.sourceOpenUnavailable") : source.detail}
                        >
                          <FileText aria-hidden />
                          <span>{source.label}</span>
                          <small>{source.detail}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {traceabilityProjection.evidenceBacklinks.length > 0 ? (
                    <div className="intent-canvas-source-list">
                      <strong>{t("intentCanvas.editor.sourceEvidence")}</strong>
                      {traceabilityProjection.evidenceBacklinks.slice(0, 6).map((evidence) => (
                        <button
                          key={evidence.id}
                          type="button"
                          className={cn("intent-canvas-source-action", evidence.unresolved && "is-unresolved")}
                          onClick={() => handleOpenBacklink(evidence)}
                          disabled={!onOpenSourceFile || !evidence.path || evidence.unresolved}
                          aria-label={t("intentCanvas.editor.sourceEvidenceOpen", {
                            label: evidence.label,
                          })}
                          title={
                            evidence.path && !evidence.unresolved
                              ? evidence.detail
                              : t("intentCanvas.editor.sourceEvidenceNoFile")
                          }
                        >
                          <FileSearch aria-hidden />
                          <span>{evidence.label}</span>
                          <small>{evidence.detail}</small>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {onOpenProjectMap ? (
                    <button
                      type="button"
                      className="intent-canvas-source-refresh"
                      onClick={onOpenProjectMap}
                      disabled={traceabilityProjection.refreshableGraphCount === 0}
                      title={t("intentCanvas.editor.sourceRefreshHint")}
                    >
                      <RefreshCw aria-hidden />
                      {t("intentCanvas.editor.sourceRefresh")}
                    </button>
                  ) : null}
                </section>
              ) : null}
              <section className="intent-canvas-card">
                <h3>{t("intentCanvas.editor.contextPreview")}</h3>
                <pre>{JSON.stringify(
                  buildIntentCanvasTransmissionContext(buildDraftDocument({ includeActiveThread: false })),
                  null,
                  2,
                )}</pre>
              </section>
              {saveError || managerErrorMessage ? (
                <p className="intent-canvas-error" role="alert">{saveError ?? managerErrorMessage}</p>
              ) : null}
            </>
          ) : null}
        </aside>
      </div>

      <footer className="intent-canvas-editor-statusbar">
        <span>{document.id}</span>
        <span>{document.mode}</span>
        <span>{t("intentCanvas.editor.updated", { time: formatDateTime(document.updatedAt) })}</span>
      </footer>
    </section>
  );
}