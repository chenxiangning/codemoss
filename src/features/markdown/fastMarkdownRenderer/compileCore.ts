import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype, { type Options as RemarkRehypeOptions } from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, {
  defaultSchema,
  type Options as RehypeSanitizeOptions,
} from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import { toHtml } from "hast-util-to-html";
import type { Root as MdastRoot } from "mdast";
import type { Root as HastRoot } from "hast";
import { hashStableString } from "../../files/utils/fileMarkdownDocument";
import { extractMarkdownOutline } from "./parserOutline";
import { extractHeavyBlocks } from "./heavyBlocks";
import { attachHeadingIds } from "./attachHeadingIds";
import { attachSourceLineAttrs } from "./sourceLineAttrs";
import type {
  CompileFastMarkdownArgs,
  FastMarkdownFallbackReason,
  FastMarkdownHeavyBlock,
  FastMarkdownRenderDiagnostics,
  FastMarkdownUnsafeArtifact,
  MarkdownOutlineEntry,
  MarkdownSourceLineAnchor,
} from "./types";

type FastMarkdownProcessor = {
  parse: (input: string) => MdastRoot;
  run: (tree: MdastRoot) => Promise<HastRoot>;
};

const FILE_PREVIEW_SANITIZE_SCHEMA: RehypeSanitizeOptions = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "abbr",
    "details",
    "summary",
    "mark",
    "ins",
    "del",
    "sub",
    "sup",
    "kbd",
    "var",
    "samp",
    "figure",
    "figcaption",
    "section",
  ],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      "className",
      "class",
      "data-source-line-start",
      "data-source-line-end",
      "data-source-block-id",
      "data-heavy-block-kind",
      "data-heavy-block-id",
      "data-fast-renderer-marker",
    ],
  },
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    href: ["http", "https", "mailto", "tel", "ftp"],
    src: ["http", "https", "data"],
  },
};

const REMARK_REHYPE_OPTIONS: RemarkRehypeOptions = {
  allowDangerousHtml: true,
};

function buildProcessor(): FastMarkdownProcessor {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, REMARK_REHYPE_OPTIONS)
    .use(rehypeRaw)
    .use(rehypeSanitize, FILE_PREVIEW_SANITIZE_SCHEMA)
    .use(rehypeKatex, { strict: "ignore", output: "html" });
  return processor as unknown as FastMarkdownProcessor;
}

export function createFastMarkdownCompileIdentity(args: CompileFastMarkdownArgs): {
  cacheKey: string;
  contentHash: string;
  featureFlagFingerprint: string;
  boundedLineLimit: number;
} {
  const contentHash = hashStableString(args.rawMarkdown);
  const featureFlagFingerprint = createFeatureFlagFingerprint(args.featureFlags);
  const boundedLineLimit = args.options?.lineLimit ?? Number.POSITIVE_INFINITY;
  const cacheKey = [
    args.documentKey,
    args.rendererProfile,
    contentHash,
    boundedLineLimit === Number.POSITIVE_INFINITY ? "full" : String(boundedLineLimit),
    featureFlagFingerprint,
  ].join(":");
  return { cacheKey, contentHash, featureFlagFingerprint, boundedLineLimit };
}

function createFeatureFlagFingerprint(flags: CompileFastMarkdownArgs["featureFlags"]): string {
  if (!flags) {
    return "default";
  }
  return [
    flags.fastHtmlRendererEnabled ? "fast" : "no-fast",
    flags.boundedFastHtmlRendererEnabled ? "bounded" : "no-bounded",
  ].join("|");
}

function clampForBounded(rawMarkdown: string, lineLimit: number): string {
  if (!Number.isFinite(lineLimit) || lineLimit <= 0) {
    return rawMarkdown;
  }
  const lines = rawMarkdown.split(/\r?\n/);
  if (lines.length <= lineLimit) {
    return rawMarkdown;
  }
  return lines.slice(0, lineLimit).join("\n");
}

export async function compileFastMarkdownToUnsafeArtifact(
  args: CompileFastMarkdownArgs,
): Promise<FastMarkdownUnsafeArtifact> {
  const { cacheKey, contentHash, featureFlagFingerprint, boundedLineLimit } =
    createFastMarkdownCompileIdentity(args);
  const compileStart = performance.now();
  const truncated = Number.isFinite(boundedLineLimit) && boundedLineLimit > 0;
  const projectedMarkdown = truncated
    ? clampForBounded(args.rawMarkdown, boundedLineLimit)
    : args.rawMarkdown;

  let outline: MarkdownOutlineEntry[] = [];
  let heavyBlocks: FastMarkdownHeavyBlock[] = [];
  let sourceLineAnchors: MarkdownSourceLineAnchor[] = [];
  let unsafeHtml = "";

  try {
    const processor = buildProcessor();
    const mdast = processor.parse(projectedMarkdown) as MdastRoot;
    const outlineMdast = truncated
      ? (processor.parse(args.rawMarkdown) as MdastRoot)
      : mdast;

    outline = extractMarkdownOutline(outlineMdast, args.bodyStartLine ?? 1);
    heavyBlocks = extractHeavyBlocks(mdast, args.bodyStartLine ?? 1);

    const hast = (await processor.run(mdast)) as HastRoot;
    attachHeadingIds(
      hast,
      outline.map((entry) => ({ anchorId: entry.id, title: entry.title })),
    );
    sourceLineAnchors = attachSourceLineAttrs(
      hast,
      args.bodyStartLine ?? 1,
      args.documentKey,
    );
    // hast-util-to-html 与 import "hast" 可能解析到不同 @types/hast 副本（pnpm 双路径）
    unsafeHtml = toHtml(hast as Parameters<typeof toHtml>[0], {
      allowDangerousHtml: false,
    });
  } catch {
    return createUnsafeArtifact({
      args,
      cacheKey,
      contentHash,
      featureFlagFingerprint,
      projectedMarkdown,
      truncated,
      compileStart,
      outline,
      heavyBlocks,
      sourceLineAnchors,
      unsafeHtml: "",
      fallbackReason: "compile-failed",
    });
  }

  return createUnsafeArtifact({
    args,
    cacheKey,
    contentHash,
    featureFlagFingerprint,
    projectedMarkdown,
    truncated,
    compileStart,
    outline,
    heavyBlocks,
    sourceLineAnchors,
    unsafeHtml,
    fallbackReason: "none",
  });
}

function createUnsafeArtifact(input: {
  args: CompileFastMarkdownArgs;
  cacheKey: string;
  contentHash: string;
  featureFlagFingerprint: string;
  projectedMarkdown: string;
  truncated: boolean;
  compileStart: number;
  outline: MarkdownOutlineEntry[];
  heavyBlocks: FastMarkdownHeavyBlock[];
  sourceLineAnchors: MarkdownSourceLineAnchor[];
  unsafeHtml: string;
  fallbackReason: FastMarkdownFallbackReason;
}): FastMarkdownUnsafeArtifact {
  const diagnostics: FastMarkdownRenderDiagnostics = {
    profile: input.args.rendererProfile,
    contentHash: input.contentHash,
    cacheKey: input.cacheKey,
    cacheState: "miss",
    compileDurationMs: performance.now() - input.compileStart,
    sanitizeDurationMs: 0,
    totalSourceLines: input.projectedMarkdown.length === 0
      ? 0
      : input.projectedMarkdown.split(/\r?\n/).length,
    totalHeadings: input.outline.length,
    totalHeavyBlocks: input.heavyBlocks.length,
    fallbackReason: input.fallbackReason,
    truncated: input.truncated,
    featureFlagApplied: input.featureFlagFingerprint !== "default",
  };
  return {
    cacheKey: input.cacheKey,
    contentHash: input.contentHash,
    unsafeHtml: input.unsafeHtml,
    sanitization: "main-thread-required",
    outline: input.outline,
    sourceLineAnchors: input.sourceLineAnchors,
    heavyBlocks: input.heavyBlocks,
    diagnostics,
    rendererProfile: input.args.rendererProfile,
  };
}
