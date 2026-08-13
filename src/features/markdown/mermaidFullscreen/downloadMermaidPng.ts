import { isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { saveMermaidPngFile } from "@/services/tauri/mermaidExport";

const TARGET_PNG_SCALE = 2;
const MAX_PNG_DIMENSION = 16_384;
const MAX_PNG_PIXELS = 32 * 1024 * 1024;

type LogicalSize = {
  width: number;
  height: number;
};

export type PngCanvasSize = LogicalSize & {
  scale: number;
};

type DownloadMermaidPngInput = {
  svg: string;
  dataUrl: string;
  filename?: string;
};

function parsePositiveSvgLength(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/^\s*(\d+(?:\.\d+)?|\.\d+)(?:px)?\s*$/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolveSvgLogicalSize(
  svg: string,
  fallback: LogicalSize,
): LogicalSize {
  if (typeof DOMParser !== "undefined") {
    const parsed = new DOMParser().parseFromString(svg, "text/html");
    const svgElement = parsed.querySelector("svg");
    if (svgElement) {
      const viewBox =
        svgElement.getAttribute("viewBox") ?? svgElement.getAttribute("viewbox");
      const viewBoxParts = viewBox
        ?.trim()
        .split(/[\s,]+/)
        .map(Number);
      const viewBoxWidth = viewBoxParts?.[2];
      const viewBoxHeight = viewBoxParts?.[3];
      if (
        viewBoxParts?.length === 4 &&
        viewBoxParts.every(Number.isFinite) &&
        typeof viewBoxWidth === "number" &&
        typeof viewBoxHeight === "number" &&
        viewBoxWidth > 0 &&
        viewBoxHeight > 0
      ) {
        return { width: viewBoxWidth, height: viewBoxHeight };
      }

      const width = parsePositiveSvgLength(svgElement.getAttribute("width"));
      const height = parsePositiveSvgLength(svgElement.getAttribute("height"));
      if (width && height) return { width, height };
    }
  }

  if (fallback.width > 0 && fallback.height > 0) return fallback;
  throw new Error("mermaid-png-invalid-dimensions");
}

export function calculatePngCanvasSize(
  logicalWidth: number,
  logicalHeight: number,
): PngCanvasSize {
  if (
    !Number.isFinite(logicalWidth) ||
    !Number.isFinite(logicalHeight) ||
    logicalWidth <= 0 ||
    logicalHeight <= 0
  ) {
    throw new Error("mermaid-png-invalid-dimensions");
  }

  const scale = Math.min(
    TARGET_PNG_SCALE,
    MAX_PNG_DIMENSION / logicalWidth,
    MAX_PNG_DIMENSION / logicalHeight,
    Math.sqrt(MAX_PNG_PIXELS / (logicalWidth * logicalHeight)),
  );

  return {
    width: Math.max(1, Math.floor(logicalWidth * scale)),
    height: Math.max(1, Math.floor(logicalHeight * scale)),
    scale,
  };
}

function loadSvgImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("mermaid-png-image-load-failed"));
    image.src = dataUrl;
  });
}

function encodeCanvasAsPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("mermaid-png-encode-failed"));
      }
    }, "image/png");
  });
}

function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error("mermaid-png-read-failed"));
      }
    };
    reader.onerror = () => reject(new Error("mermaid-png-read-failed"));
    reader.readAsArrayBuffer(blob);
  });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    // WebKit 需要 click settlement 前保持 URL 有效；延迟一轮仍保证释放。
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

async function savePngBlob(blob: Blob, filename: string): Promise<void> {
  if (!isTauri()) {
    triggerBlobDownload(blob, filename);
    return;
  }

  const targetPath = await save({
    defaultPath: filename,
    filters: [{ name: "PNG", extensions: ["png"] }],
  });
  if (!targetPath) return;

  const pngBytes = Array.from(await readBlobBytes(blob));
  await saveMermaidPngFile(targetPath, pngBytes);
}

export async function downloadMermaidPng({
  svg,
  dataUrl,
  filename = "mermaid-diagram.png",
}: DownloadMermaidPngInput): Promise<void> {
  const image = await loadSvgImage(dataUrl);
  const logicalSize = resolveSvgLogicalSize(svg, {
    width: image.naturalWidth,
    height: image.naturalHeight,
  });
  const canvasSize = calculatePngCanvasSize(
    logicalSize.width,
    logicalSize.height,
  );
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize.width;
  canvas.height = canvasSize.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("mermaid-png-canvas-context-unavailable");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  await savePngBlob(await encodeCanvasAsPng(canvas), filename);
}
