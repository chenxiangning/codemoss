import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  compactProjectCanvasFiles,
  readProjectCanvasFile,
  trashProjectCanvasFile,
  writeProjectCanvasFile,
} from "../../../services/tauri";
import {
  deleteIntentCanvasDocuments,
  loadIntentCanvasIndex,
  saveIntentCanvasDocument,
} from "./intentCanvasStorage";
import type { IntentCanvasDocument } from "../types";

vi.mock("../../../services/tauri", () => ({
  compactProjectCanvasFiles: vi.fn(),
  readProjectCanvasFile: vi.fn(),
  trashProjectCanvasFile: vi.fn(),
  writeProjectCanvasFile: vi.fn(),
}));

vi.mock("@excalidraw/excalidraw", () => ({
  exportToSvg: vi.fn(async () => ({
    outerHTML: "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>",
    setAttribute: () => undefined,
    removeAttribute: () => undefined,
  })),
}));

function createIndexEntry(id: string) {
  return {
    id,
    title: id,
    mode: "architect",
    summary: "",
    updatedAt: `2026-06-06T00:00:0${id.slice(-1)}.000Z`,
    createdAt: "2026-06-06T00:00:00.000Z",
    path: `${id}.intent-canvas.json`,
    linkedFileCount: 0,
    linkedProjectMapNodeCount: 0,
    linkedThreadCount: 0,
    elementCount: 0,
  };
}

describe("deleteIntentCanvasDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(compactProjectCanvasFiles).mockResolvedValue({
      deletedDocuments: 0,
      deletedTempFiles: 0,
    });
  });

  it("trashes unique canvas files and writes the index once", async () => {
    vi.mocked(readProjectCanvasFile).mockResolvedValueOnce({
      content: JSON.stringify({
        version: 1,
        canvases: [
          createIndexEntry("canvas-a"),
          createIndexEntry("canvas-b"),
          createIndexEntry("canvas-c"),
        ],
      }),
      truncated: false,
    });

    await deleteIntentCanvasDocuments("workspace-1", ["canvas-a", "canvas-b", "canvas-a"]);

    expect(readProjectCanvasFile).toHaveBeenCalledTimes(1);
    expect(trashProjectCanvasFile).toHaveBeenCalledTimes(2);
    expect(trashProjectCanvasFile).toHaveBeenNthCalledWith(
      1,
      "workspace-1",
      "canvas-a.intent-canvas.json",
    );
    expect(trashProjectCanvasFile).toHaveBeenNthCalledWith(
      2,
      "workspace-1",
      "canvas-b.intent-canvas.json",
    );
    expect(writeProjectCanvasFile).toHaveBeenCalledTimes(1);
    expect(compactProjectCanvasFiles).toHaveBeenCalledWith("workspace-1");
    const [, path, content] = vi.mocked(writeProjectCanvasFile).mock.calls[0] ?? [];
    expect(path).toBe("index.json");
    expect(JSON.parse(String(content)).canvases.map((entry: { id: string }) => entry.id)).toEqual(["canvas-c"]);
  });
});

function createDocument(id: string, elementCount: number): IntentCanvasDocument {
  return {
    version: 1,
    id,
    title: id,
    kind: "intent-canvas",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    workspace: { id: "workspace-1", name: null },
    mode: "architect",
    summary: "",
    links: { projectMapNodeIds: [], filePaths: [], threadIds: [] },
    scene: {
      elements: Array.from({ length: elementCount }, (_, index) => ({
        id: `el-${index}`,
        type: "rectangle",
        isDeleted: false,
      })) as unknown as IntentCanvasDocument["scene"]["elements"],
      appState: {},
      files: {},
    },
    aiContext: { elementDigest: [], relationDigest: [], lastContextSnapshot: "" },
    semanticGraphs: [],
    aiAnnotations: [],
  };
}

describe("saveIntentCanvasDocument thumbnail cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readProjectCanvasFile).mockRejectedValue(new Error("File not found"));
  });

  it("writes the generated thumbnail into the index entry", async () => {
    await saveIntentCanvasDocument("workspace-1", createDocument("canvas-t", 2));

    const indexWrite = vi
      .mocked(writeProjectCanvasFile)
      .mock.calls.find(([, path]) => path === "index.json");
    expect(indexWrite).toBeTruthy();
    const [entry] = JSON.parse(String(indexWrite?.[2])).canvases;
    expect(entry.thumbnailSvg).toContain("<svg");
  });

  it("omits the thumbnail for empty scenes", async () => {
    await saveIntentCanvasDocument("workspace-1", createDocument("canvas-empty", 0));

    const indexWrite = vi
      .mocked(writeProjectCanvasFile)
      .mock.calls.find(([, path]) => path === "index.json");
    const [entry] = JSON.parse(String(indexWrite?.[2])).canvases;
    expect(entry.thumbnailSvg).toBeUndefined();
  });
});

describe("loadIntentCanvasIndex legacy compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads entries without thumbnailSvg unchanged", async () => {
    vi.mocked(readProjectCanvasFile).mockResolvedValueOnce({
      content: JSON.stringify({ version: 1, canvases: [createIndexEntry("canvas-a")] }),
      truncated: false,
    });

    const result = await loadIntentCanvasIndex("workspace-1");

    expect(result.value).toHaveLength(1);
    expect(result.value[0].thumbnailSvg).toBeUndefined();
  });

  it("preserves a stored thumbnailSvg", async () => {
    const entry = { ...createIndexEntry("canvas-b"), thumbnailSvg: "<svg></svg>" };
    vi.mocked(readProjectCanvasFile).mockResolvedValueOnce({
      content: JSON.stringify({ version: 1, canvases: [entry] }),
      truncated: false,
    });

    const result = await loadIntentCanvasIndex("workspace-1");

    expect(result.value[0].thumbnailSvg).toBe("<svg></svg>");
  });
});
