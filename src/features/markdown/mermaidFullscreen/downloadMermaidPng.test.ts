// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const { isTauriMock, saveMermaidPngFileMock, saveMock } = vi.hoisted(() => ({
  isTauriMock: vi.fn(() => false),
  saveMermaidPngFileMock: vi.fn(),
  saveMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: isTauriMock,
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: saveMock }));
vi.mock("@/services/tauri/mermaidExport", () => ({
  saveMermaidPngFile: saveMermaidPngFileMock,
}));

import {
  calculatePngCanvasSize,
  downloadMermaidPng,
  resolveSvgLogicalSize,
} from "./downloadMermaidPng";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  isTauriMock.mockReset();
  isTauriMock.mockReturnValue(false);
  saveMermaidPngFileMock.mockReset();
  saveMock.mockReset();
  document.body.replaceChildren();
});

describe("Mermaid PNG export sizing", () => {
  it("uses the SVG viewBox and exports ordinary diagrams at 2x", () => {
    expect(
      resolveSvgLogicalSize(
        '<svg viewBox="0 0 320 180"><text>中文 🌊</text></svg>',
        { width: 1, height: 1 },
      ),
    ).toEqual({ width: 320, height: 180 });
    expect(calculatePngCanvasSize(320, 180)).toEqual({
      width: 640,
      height: 360,
      scale: 2,
    });
  });

  it("keeps oversized diagrams inside dimension and pixel budgets", () => {
    const dimensionBound = calculatePngCanvasSize(20_000, 1_000);
    expect(dimensionBound.width).toBeLessThanOrEqual(16_384);
    expect(dimensionBound.width / dimensionBound.height).toBeCloseTo(20, 1);

    const pixelBound = calculatePngCanvasSize(10_000, 10_000);
    expect(pixelBound.width * pixelBound.height).toBeLessThanOrEqual(32 * 1024 * 1024);
    expect(pixelBound.width).toBe(pixelBound.height);
  });
});

describe("downloadMermaidPng", () => {
  function mockPngCanvas(pngBytes = PNG_BYTES) {
    class LoadedImage {
      naturalWidth = 300;
      naturalHeight = 150;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal("Image", LoadedImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob([pngBytes], { type: "image/png" }));
    });
  }

  const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2]);

  it("uses the native Save Dialog and Tauri IPC in desktop runtime", async () => {
    isTauriMock.mockReturnValue(true);
    saveMock.mockResolvedValue("/tmp/mermaid-diagram.png");
    mockPngCanvas();

    await downloadMermaidPng({
      svg: '<svg viewBox="0 0 400 200" />',
      dataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
    });

    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: "mermaid-diagram.png",
      filters: [{ name: "PNG", extensions: ["png"] }],
    });
    expect(saveMermaidPngFileMock).toHaveBeenCalledWith(
      "/tmp/mermaid-diagram.png",
      Array.from(PNG_BYTES),
    );
  });

  it("treats native Save Dialog cancellation as a recoverable no-op", async () => {
    isTauriMock.mockReturnValue(true);
    saveMock.mockResolvedValue(null);
    mockPngCanvas();

    await downloadMermaidPng({
      svg: '<svg viewBox="0 0 400 200" />',
      dataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
    });

    expect(saveMermaidPngFileMock).not.toHaveBeenCalled();
  });

  it("propagates native persistence failure to the recoverable viewer state", async () => {
    isTauriMock.mockReturnValue(true);
    saveMock.mockResolvedValue("/tmp/mermaid-diagram.png");
    saveMermaidPngFileMock.mockRejectedValue(new Error("write failed"));
    mockPngCanvas();

    await expect(
      downloadMermaidPng({
        svg: '<svg viewBox="0 0 400 200" />',
        dataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
      }),
    ).rejects.toThrow("write failed");
  });

  it("encodes a transparent PNG, downloads it, and revokes the object URL", async () => {
    class LoadedImage {
      naturalWidth = 300;
      naturalHeight = 150;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal("Image", LoadedImage);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    let encodedCanvas: { width: number; height: number; type: string | undefined } | null = null;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
      type,
    ) {
      encodedCanvas = { width: this.width, height: this.height, type };
      callback(new Blob(["png"], { type: "image/png" }));
    });
    const createObjectURL = vi.fn(() => "blob:mermaid-png");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    let downloadedFilename = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedFilename = this.download;
    });

    await downloadMermaidPng({
      svg: '<svg viewBox="0 0 400 200"><foreignObject>中文</foreignObject></svg>',
      dataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(encodedCanvas).toEqual({ width: 800, height: 400, type: "image/png" });
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: "image/png" }));
    expect(downloadedFilename).toBe("mermaid-diagram.png");
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mermaid-png");
  });

  it("removes the anchor and revokes the object URL when the click fails", async () => {
    class LoadedImage {
      naturalWidth = 100;
      naturalHeight = 50;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal("Image", LoadedImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["png"], { type: "image/png" }));
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:failed-mermaid-png"),
      revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("download blocked");
    });

    await expect(
      downloadMermaidPng({
        svg: '<svg viewBox="0 0 100 50" />',
        dataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
      }),
    ).rejects.toThrow("download blocked");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector("a[download]")).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:failed-mermaid-png");
  });
});
