import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open";

import type { WorkspaceInfo } from "../../../types";
import {
  IntentCanvasEditor,
  normalizeError,
  type IntentCanvasOpenSourceFile,
} from "./IntentCanvasEditor";
import { IntentCanvasHome } from "./manager-home/IntentCanvasHome";
import type {
  IntentCanvasDocument,
  IntentCanvasIndexEntry,
  IntentCanvasOpenRequest,
  IntentCanvasWorkspaceRef,
} from "../types";
import {
  appendIntentCanvasDocumentFromRequest,
  cloneIntentCanvasDocument,
  createIntentCanvasDocument,
  deleteIntentCanvasDocument,
  deleteIntentCanvasDocuments,
  loadIntentCanvasDocument,
  loadIntentCanvasIndex,
  saveIntentCanvasDocument,
} from "../services/intentCanvasStorage";
import { groupCanvasEntriesByEra, type CanvasEra } from "../utils/eraGrouping";
import {
  documentHasBrokenAnchors,
  type CanvasAnchorHealth,
} from "../utils/staleSignals";
import { loadIntentCanvasStyles } from "../../../styles/featureStyleLoaders";


export type IntentCanvasManagerProps = {
  activeWorkspace: WorkspaceInfo | null;
  activeThreadId: string | null;
  openRequest?: IntentCanvasOpenRequest | null;
  onOpenRequestConsumed?: (requestId: number) => void;
  onAttachToThread?: (document: IntentCanvasDocument) => Promise<void> | void;
  onOpenProjectMap?: () => void;
  onOpenSourceFile?: IntentCanvasOpenSourceFile;
};

type IntentCanvasManagerStatus = "idle" | "loading" | "ready" | "error";
type IntentCanvasManagerAction = "open" | "duplicate" | "delete";

type IntentCanvasActionPrompt = {
  action: IntentCanvasManagerAction;
  entry: IntentCanvasIndexEntry;
};


const EMPTY_CANVAS_ENTRIES: IntentCanvasIndexEntry[] = [];


function buildWorkspaceRef(workspace: WorkspaceInfo): IntentCanvasWorkspaceRef {
  return {
    id: workspace.id,
    name: workspace.name ?? null,
  };
}


export function IntentCanvasManager({
  activeWorkspace,
  activeThreadId,
  openRequest = null,
  onOpenRequestConsumed,
  onAttachToThread,
  onOpenProjectMap,
  onOpenSourceFile,
}: IntentCanvasManagerProps) {
  useEffect(() => {
    void loadIntentCanvasStyles();
  }, []);
  const { t } = useTranslation();
  const [status, setStatus] = useState<IntentCanvasManagerStatus>("idle");
  const [entries, setEntries] = useState<IntentCanvasIndexEntry[]>(EMPTY_CANVAS_ENTRIES);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDocument, setActiveDocument] = useState<IntentCanvasDocument | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionPrompt, setActionPrompt] = useState<IntentCanvasActionPrompt | null>(null);
  const [confirmingCanvasActionId, setConfirmingCanvasActionId] = useState<string | null>(null);
  const [selectedCanvasIds, setSelectedCanvasIds] = useState<Set<string>>(() => new Set());
  const [isBulkDeletePromptOpen, setIsBulkDeletePromptOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const handledOpenRequestIdsRef = useRef<Set<number>>(new Set());

  const workspaceRef = useMemo(
    () => (activeWorkspace ? buildWorkspaceRef(activeWorkspace) : null),
    [activeWorkspace],
  );

  const refreshIndex = useCallback(async () => {
    if (!activeWorkspace) {
      setEntries(EMPTY_CANVAS_ENTRIES);
      setWarnings([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const result = await loadIntentCanvasIndex(activeWorkspace.id);
    setEntries(result.value);
    setWarnings(result.warnings);
    setStatus("ready");
  }, [activeWorkspace]);

  useEffect(() => {
    let cancelled = false;
    if (!activeWorkspace) {
      setEntries(EMPTY_CANVAS_ENTRIES);
      setWarnings([]);
      setErrorMessage(null);
      setActiveDocument(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    loadIntentCanvasIndex(activeWorkspace.id)
      .then((result) => {
        if (!cancelled) {
          setEntries(result.value);
          setWarnings(result.warnings);
          setStatus("ready");
          setErrorMessage(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(normalizeError(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace]);

  useEffect(() => {
    setSelectedCanvasIds(new Set<string>());
    setIsBulkDeletePromptOpen(false);
    setActionPrompt(null);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    setSelectedCanvasIds((current) => {
      const availableCanvasIds = new Set(entries.map((entry) => entry.id));
      const next = new Set<string>();
      let changed = false;
      current.forEach((canvasId) => {
        if (availableCanvasIds.has(canvasId)) {
          next.add(canvasId);
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [entries]);

  const saveDocument = useCallback(
    async (documentToSave: IntentCanvasDocument) => {
      if (!activeWorkspace) {
        throw new Error(t("intentCanvas.errors.noWorkspace"));
      }
      setIsSaving(true);
      try {
        const savedDocument = await saveIntentCanvasDocument(activeWorkspace.id, documentToSave);
        setActiveDocument(savedDocument);
        await refreshIndex();
        return savedDocument;
      } finally {
        setIsSaving(false);
      }
    },
    [activeWorkspace, refreshIndex, t],
  );

  const openCanvas = useCallback(
    async (canvasId: string) => {
      if (!activeWorkspace) {
        return;
      }
      setStatus("loading");
      try {
        const document = await loadIntentCanvasDocument(activeWorkspace.id, canvasId);
        setActiveDocument(document);
        setStatus("ready");
        setErrorMessage(null);
      } catch (error) {
        setStatus("error");
        setErrorMessage(normalizeError(error));
      }
    },
    [activeWorkspace],
  );

  const createCanvas = useCallback(
    async (request?: IntentCanvasOpenRequest | null) => {
      if (!activeWorkspace || !workspaceRef) {
        setErrorMessage(t("intentCanvas.errors.noWorkspace"));
        return;
      }
      try {
        const document = createIntentCanvasDocument({ workspace: workspaceRef, request });
        const savedDocument = await saveDocument(document);
        setActiveDocument(savedDocument);
        setErrorMessage(null);
      } catch (error) {
        setStatus("error");
        setErrorMessage(normalizeError(error));
      }
    },
    [activeWorkspace, saveDocument, t, workspaceRef],
  );

  const appendCanvas = useCallback(
    async (request: IntentCanvasOpenRequest) => {
      try {
        let baseDocument = activeDocument;
        if (request.canvasId && (!baseDocument || baseDocument.id !== request.canvasId)) {
          if (!activeWorkspace) {
            setErrorMessage(t("intentCanvas.errors.noWorkspace"));
            return;
          }
          baseDocument = await loadIntentCanvasDocument(activeWorkspace.id, request.canvasId);
        }
        if (!baseDocument) {
          await createCanvas(request);
          return;
        }
        const nextDocument = appendIntentCanvasDocumentFromRequest({
          document: baseDocument,
          request,
        });
        const savedDocument = await saveDocument(nextDocument);
        setActiveDocument(savedDocument);
        setErrorMessage(null);
      } catch (error) {
        setStatus("error");
        setErrorMessage(normalizeError(error));
      }
    },
    [activeDocument, activeWorkspace, createCanvas, saveDocument, t],
  );

  useEffect(() => {
    if (!openRequest || !activeWorkspace || !workspaceRef) {
      return;
    }
    if (handledOpenRequestIdsRef.current.has(openRequest.requestId)) {
      return;
    }
    handledOpenRequestIdsRef.current.add(openRequest.requestId);
    onOpenRequestConsumed?.(openRequest.requestId);
    const executeRequest = async () => {
      if (openRequest.target === "append") {
        await appendCanvas(openRequest);
      } else if (openRequest.canvasId) {
        await openCanvas(openRequest.canvasId);
      } else {
        await createCanvas(openRequest);
      }
    };
    void executeRequest();
  }, [activeWorkspace, appendCanvas, createCanvas, onOpenRequestConsumed, openCanvas, openRequest, workspaceRef]);

  const handleCanvasActionRequest = useCallback(
    (entry: IntentCanvasIndexEntry, action: IntentCanvasManagerAction) => {
      setActionPrompt((current) => (current?.entry.id === entry.id && current.action === action ? null : { action, entry }));
    },
    [],
  );

  const handleDuplicateCanvas = useCallback(
    async (entry: IntentCanvasIndexEntry) => {
      if (!activeWorkspace || !workspaceRef) {
        return;
      }
      const sourceDocument = await loadIntentCanvasDocument(activeWorkspace.id, entry.id);
      const copiedDocument = cloneIntentCanvasDocument({ workspace: workspaceRef, source: sourceDocument });
      const savedDocument = await saveDocument(copiedDocument);
      setActiveDocument(savedDocument);
    },
    [activeWorkspace, saveDocument, workspaceRef],
  );

  const confirmCanvasAction = useCallback(
    async () => {
      if (!actionPrompt) {
        return;
      }
      const { action, entry } = actionPrompt;
      setConfirmingCanvasActionId(entry.id);
      try {
        if (action === "open") {
          await openCanvas(entry.id);
        } else if (action === "duplicate") {
          await handleDuplicateCanvas(entry);
        } else if (activeWorkspace) {
          await deleteIntentCanvasDocument(activeWorkspace.id, entry.id);
          if (activeDocument?.id === entry.id) {
            setActiveDocument(null);
          }
          setSelectedCanvasIds((current) => {
            if (!current.has(entry.id)) {
              return current;
            }
            const next = new Set(current);
            next.delete(entry.id);
            return next;
          });
          await refreshIndex();
        }
        setActionPrompt(null);
      } catch (error) {
        setErrorMessage(normalizeError(error));
      } finally {
        setConfirmingCanvasActionId(null);
      }
    },
    [actionPrompt, activeDocument?.id, activeWorkspace, handleDuplicateCanvas, openCanvas, refreshIndex],
  );

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return entries;
    }
    return entries.filter((entry) => {
      const searchable = [entry.title, entry.summary, entry.mode, entry.path].join(" ").toLowerCase();
      return searchable.includes(query);
    });
  }, [entries, searchQuery]);

  const [renderNow, setRenderNow] = useState(() => new Date());
  useEffect(() => {
    // 索引重载时刷新分桶基准时间；搜索输入不移动 era 边界。
    setRenderNow(new Date());
  }, [entries]);
  const canvasEras = useMemo(
    () => groupCanvasEntriesByEra(filteredEntries, renderNow),
    [filteredEntries, renderNow],
  );
  const staleEraEntries = useMemo(
    () => canvasEras.find((era) => era.kind === "stale")?.entries ?? EMPTY_CANVAS_ENTRIES,
    [canvasEras],
  );

  // 「更早」组锚点健康懒检测：仅该组、并发上限 4、ref 缓存、失败静默降级。
  const [anchorHealthByCanvasId, setAnchorHealthByCanvasId] = useState<Record<string, CanvasAnchorHealth>>({});
  const anchorHealthCacheRef = useRef<Map<string, CanvasAnchorHealth>>(new Map());

  useEffect(() => {
    anchorHealthCacheRef.current.clear();
    setAnchorHealthByCanvasId({});
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!activeWorkspace || staleEraEntries.length === 0) {
      setAnchorHealthByCanvasId((current) => (Object.keys(current).length === 0 ? current : {}));
      return;
    }
    const cache = anchorHealthCacheRef.current;
    const seeded: Record<string, CanvasAnchorHealth> = {};
    const pending: IntentCanvasIndexEntry[] = [];
    staleEraEntries.forEach((entry) => {
      const cached = cache.get(entry.id);
      if (cached) {
        seeded[entry.id] = cached;
      } else {
        pending.push(entry);
      }
    });
    setAnchorHealthByCanvasId(seeded);
    if (pending.length === 0) {
      return;
    }
    let cancelled = false;
    const workspaceId = activeWorkspace.id;
    const queue = [...pending];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      for (;;) {
        const entry = queue.shift();
        if (!entry || cancelled) {
          return;
        }
        try {
          const canvasDocument = await loadIntentCanvasDocument(workspaceId, entry.id);
          const health: CanvasAnchorHealth = documentHasBrokenAnchors(canvasDocument) ? "broken" : "ok";
          cache.set(entry.id, health);
          if (!cancelled) {
            setAnchorHealthByCanvasId((current) => ({ ...current, [entry.id]: health }));
          }
        } catch {
          // 读取失败静默降级：卡片回退到空图 / N 天未动角标。
        }
      }
    });
    void Promise.all(workers);
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace, staleEraEntries]);

  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedCanvasIds.has(entry.id)),
    [entries, selectedCanvasIds],
  );

  const allFilteredEntriesSelected = filteredEntries.length > 0
    && filteredEntries.every((entry) => selectedCanvasIds.has(entry.id));

  const toggleCanvasSelection = useCallback((canvasId: string) => {
    setSelectedCanvasIds((current) => {
      const next = new Set(current);
      if (next.has(canvasId)) {
        next.delete(canvasId);
      } else {
        next.add(canvasId);
      }
      return next;
    });
    setIsBulkDeletePromptOpen(false);
  }, []);

  const toggleFilteredCanvasSelection = useCallback(() => {
    setSelectedCanvasIds((current) => {
      const next = new Set(current);
      const shouldSelectAll = filteredEntries.some((entry) => !next.has(entry.id));
      filteredEntries.forEach((entry) => {
        if (shouldSelectAll) {
          next.add(entry.id);
        } else {
          next.delete(entry.id);
        }
      });
      if (next.size === current.size && Array.from(next).every((canvasId) => current.has(canvasId))) {
        return current;
      }
      return next;
    });
    setIsBulkDeletePromptOpen(false);
  }, [filteredEntries]);

  const clearCanvasSelection = useCallback(() => {
    setSelectedCanvasIds((current) => (current.size === 0 ? current : new Set<string>()));
    setIsBulkDeletePromptOpen(false);
  }, []);

  const selectEraEntries = useCallback((era: CanvasEra) => {
    setSelectedCanvasIds((current) => {
      const next = new Set(current);
      era.entries.forEach((entry) => next.add(entry.id));
      return next.size === current.size ? current : next;
    });
    setIsBulkDeletePromptOpen(false);
  }, []);

  const confirmBulkDelete = useCallback(async () => {
    if (!activeWorkspace || selectedEntries.length === 0) {
      return;
    }
    const deletedCanvasIds = selectedEntries.map((entry) => entry.id);
    setIsBulkDeleting(true);
    try {
      await deleteIntentCanvasDocuments(activeWorkspace.id, deletedCanvasIds);
      if (activeDocument && deletedCanvasIds.includes(activeDocument.id)) {
        setActiveDocument(null);
      }
      setSelectedCanvasIds(new Set<string>());
      setIsBulkDeletePromptOpen(false);
      setActionPrompt(null);
      await refreshIndex();
    } catch (error) {
      setErrorMessage(normalizeError(error));
    } finally {
      setIsBulkDeleting(false);
    }
  }, [activeDocument, activeWorkspace, refreshIndex, selectedEntries]);

  if (!activeWorkspace) {
    return (
      <section className="intent-canvas-manager is-empty">
        <div className="intent-canvas-empty-state">
          <FolderOpen aria-hidden />
          <h2>{t("intentCanvas.manager.noWorkspaceTitle")}</h2>
          <p>{t("intentCanvas.manager.noWorkspaceBody")}</p>
        </div>
      </section>
    );
  }

  if (activeDocument) {
    return (
      <IntentCanvasEditor
        document={activeDocument}
        activeThreadId={activeThreadId}
        isSaving={isSaving}
        onBack={() => {
          setActiveDocument(null);
          void refreshIndex();
        }}
        onSave={saveDocument}
        onAttachToThread={onAttachToThread}
        onOpenProjectMap={onOpenProjectMap}
        onOpenSourceFile={onOpenSourceFile}
        managerErrorMessage={errorMessage}
      />
    );
  }

  return (
    <section className="intent-canvas-manager" aria-label={t("intentCanvas.manager.ariaLabel")}>
      <IntentCanvasHome
        status={status}
        filteredEntries={filteredEntries}
        eras={canvasEras}
        now={renderNow}
        warnings={warnings}
        errorMessage={errorMessage}
        searchQuery={searchQuery}
        anchorHealthByCanvasId={anchorHealthByCanvasId}
        selectedCanvasIds={selectedCanvasIds}
        selectedCount={selectedEntries.length}
        allFilteredEntriesSelected={allFilteredEntriesSelected}
        isBulkDeletePromptOpen={isBulkDeletePromptOpen}
        isBulkDeleting={isBulkDeleting}
        actionPrompt={actionPrompt}
        confirmingCanvasActionId={confirmingCanvasActionId}
        onSearchQueryChange={setSearchQuery}
        onToggleSelectAll={toggleFilteredCanvasSelection}
        onRefresh={() => void refreshIndex()}
        onOpenProjectMap={onOpenProjectMap}
        onCreateCanvas={() => void createCanvas()}
        onToggleCanvasSelection={toggleCanvasSelection}
        onSelectEra={selectEraEntries}
        onClearSelection={clearCanvasSelection}
        onBulkDeleteRequest={() => {
          setActionPrompt(null);
          setIsBulkDeletePromptOpen(true);
        }}
        onBulkDeleteConfirm={() => void confirmBulkDelete()}
        onBulkDeleteCancel={() => setIsBulkDeletePromptOpen(false)}
        onCanvasActionRequest={handleCanvasActionRequest}
        onConfirmCanvasAction={() => void confirmCanvasAction()}
        onCancelCanvasAction={() => setActionPrompt(null)}
      />
    </section>
  );
}
