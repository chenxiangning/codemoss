import { lazy, startTransition, Suspense, useEffect, useMemo, useState, isValidElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Markdown } from "./Markdown";
import { buildLatexRenderEntries, isKatexRenderReady, loadKatexAssets, renderLatexFormula } from "../../features/markdown/markdownMath";
import { highlightLine } from "../../utils/syntax";
import { CodeBlockCopyButton, CodeBlockLanguageBadge } from "../presentation/codeBlockLanguageIcon";
import { shouldDeferCodeBlock } from "../presentation/markdownHeavyIslands";
import { extractCodeFromPre, extractLanguageTag, extractLatexContent, extractMarkdownContent, extractMermaidContent, extractUrlLines, shouldRenderMarkdownFenceAsCard, type MarkdownPreNode } from "../presentation/markdownCodeBlockHelpers";

const MermaidBlock = lazy(() => import("../runtime/MermaidBlock"));

type CodeBlockProps = {
  className?: string;
  value: string;
  copyUseModifier: boolean;
};

export type PreProps = {
  node?: MarkdownPreNode;
  children?: ReactNode;
  copyUseModifier: boolean;
  sourceMarkdown: string;
  workspaceId: string | null;
  onOpenFileLink?: (path: string) => void;
  onOpenFileLinkMenu?: (event: React.MouseEvent, path: string) => void;
  onOpenHtmlInBrowser?: (path: string) => void;
};

type LinkBlockProps = {
  urls: string[];
};

type DeferredCodeBlockProps = CodeBlockProps & {
  languageLabel: string;
  lineCount: number;
};

type DeferredMarkdownTableProps = {
  children: ReactNode;
  rowCount: number;
};

function LinkBlock({ urls }: LinkBlockProps) {
  return (
    <div className="markdown-linkblock">
      {urls.map((url, index) => (
        <a
          key={`${url}-${index}`}
          href={url}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void openUrl(url);
          }}
        >
          {url}
        </a>
      ))}
    </div>
  );
}

function renderHighlightedCodeLines(value: string, languageTag: string | null) {
  return value.split("\n").map((line, index) => (
    <span
      key={`${index}:${line.length}`}
      className="markdown-codeblock-line"
      dangerouslySetInnerHTML={{ __html: highlightLine(line, languageTag) }}
    />
  ));
}

function CodeBlock({ className, value, copyUseModifier }: CodeBlockProps) {
  const languageTag = extractLanguageTag(className);
  const languageLabel = languageTag ?? "Code";
  const fencedValue = `\`\`\`${languageTag ?? ""}\n${value}\n\`\`\``;
  const highlightedLines = useMemo(
    () => renderHighlightedCodeLines(value, languageTag),
    [value, languageTag],
  );

  return (
    <div className="markdown-codeblock">
      <div className="markdown-codeblock-header">
        <CodeBlockLanguageBadge languageTag={languageTag} label={languageLabel} />
        <div className="markdown-codeblock-actions">
          <CodeBlockCopyButton
            value={value}
            fencedValue={fencedValue}
            copyUseModifier={copyUseModifier}
          />
        </div>
      </div>
      <pre data-line-numbers>
        <code className={className}>{highlightedLines}</code>
      </pre>
    </div>
  );
}

function DeferredCodeBlock({
  className,
  value,
  copyUseModifier,
  languageLabel,
  lineCount,
}: DeferredCodeBlockProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const languageTag = extractLanguageTag(className);
  const fencedValue = `\`\`\`${languageTag ?? ""}\n${value}\n\`\`\``;

  if (expanded) {
    return (
      <CodeBlock
        className={className}
        value={value}
        copyUseModifier={copyUseModifier}
      />
    );
  }

  return (
    <div className="markdown-codeblock markdown-heavy-island-placeholder">
      <div className="markdown-codeblock-header">
        <CodeBlockLanguageBadge languageTag={languageTag} label={languageLabel} />
        <div className="markdown-codeblock-actions">
          <CodeBlockCopyButton
            value={value}
            fencedValue={fencedValue}
            copyUseModifier={copyUseModifier}
          />
        </div>
      </div>
      <div className="markdown-heavy-island-placeholder-body">
        <strong>{t("messages.markdownHeavyBlockDeferred")}</strong>
        <span>
          {t("messages.markdownHeavyBlockMeta", {
            kind: languageLabel,
            lines: lineCount,
          })}
        </span>
        <button type="button" onClick={() => setExpanded(true)}>
          {t("messages.markdownHeavyBlockShow")}
        </button>
      </div>
    </div>
  );
}

function MarkdownBlock({
  className,
  value,
  copyUseModifier,
  workspaceId,
  onOpenFileLink,
  onOpenFileLinkMenu,
  onOpenHtmlInBrowser,
}: CodeBlockProps & Pick<PreProps, "workspaceId" | "onOpenFileLink" | "onOpenFileLinkMenu" | "onOpenHtmlInBrowser">) {
  const languageTag = extractLanguageTag(className);
  const languageLabel = (languageTag ?? "markdown").toUpperCase();
  const fencedValue = `\`\`\`${languageTag ?? "markdown"}\n${value}\n\`\`\``;

  return (
    <div className="markdown-codeblock markdown-codeblock-markdown">
      <div className="markdown-codeblock-header">
        <CodeBlockLanguageBadge languageTag={languageTag} label={languageLabel} />
        <div className="markdown-codeblock-actions">
          <CodeBlockCopyButton
            value={value}
            fencedValue={fencedValue}
            copyUseModifier={copyUseModifier}
          />
        </div>
      </div>
      <div className="markdown-codeblock-markdown-content">
        <Markdown
          value={value}
          className="markdown markdown-codeblock-markdown-rendered"
          workspaceId={workspaceId}
          codeBlockStyle="message"
          codeBlockCopyUseModifier={copyUseModifier}
          streamingThrottleMs={0}
          onOpenFileLink={onOpenFileLink}
          onOpenFileLinkMenu={onOpenFileLinkMenu}
          onOpenHtmlInBrowser={onOpenHtmlInBrowser}
        />
      </div>
    </div>
  );
}

function LatexBlock({ className, value, copyUseModifier }: CodeBlockProps) {
  const languageTag = extractLanguageTag(className);
  const languageLabel = languageTag ? languageTag.toUpperCase() : "LaTeX";
  const fencedValue = `\`\`\`${languageTag ?? "latex"}\n${value}\n\`\`\``;
  const entries = useMemo(
    () => buildLatexRenderEntries(value),
    [value],
  );
  const [katexReady, setKatexReady] = useState(
    () => isKatexRenderReady(),
  );
  useEffect(() => {
    if (katexReady) return;
    let cancelled = false;
    loadKatexAssets().then(() => {
      if (cancelled) return;
      startTransition(() => setKatexReady(true));
    });
    return () => {
      cancelled = true;
    };
  }, [katexReady]);
  const renderedEntries = useMemo(
    () => entries.map((entry) => (
      entry.kind === "label"
        ? { ...entry }
        : { ...entry, html: katexReady ? renderLatexFormula(entry.source) : null }
    )),
    [entries, katexReady],
  );
  const hasFormulaRenderFailure = renderedEntries.some(
    (entry) => entry.kind === "formula" && !entry.html,
  );

  if (hasFormulaRenderFailure) {
    return (
      <CodeBlock
        className={className}
        value={value}
        copyUseModifier={copyUseModifier}
      />
    );
  }

  return (
    <div className="markdown-codeblock markdown-latexblock">
      <div className="markdown-codeblock-header">
        <CodeBlockLanguageBadge languageTag={languageTag} label={languageLabel} />
        <div className="markdown-codeblock-actions">
          <CodeBlockCopyButton
            value={value}
            fencedValue={fencedValue}
            copyUseModifier={copyUseModifier}
          />
        </div>
      </div>
      <div className="markdown-latexblock-content">
        {renderedEntries.map((entry, index) => (
          entry.kind === "label" ? (
            <p
              key={`latex-label-${index}-${entry.text}`}
              className="markdown-latexblock-label"
            >
              {entry.text}
            </p>
          ) : (
            <div
              key={`latex-formula-${index}`}
              className="markdown-latexblock-formula"
              dangerouslySetInnerHTML={{ __html: entry.html ?? "" }}
            />
          )
        ))}
      </div>
    </div>
  );
}

function MermaidFallback() {
  return (
    <div className="markdown-codeblock markdown-mermaidblock">
      <div className="markdown-codeblock-header">
        <CodeBlockLanguageBadge languageTag="mermaid" label="Mermaid" />
      </div>
      <div className="markdown-mermaidblock-loading">Loading...</div>
    </div>
  );
}

export function DeferredMarkdownTable({ children, rowCount }: DeferredMarkdownTableProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (expanded) {
    return <table>{children}</table>;
  }
  return (
    <div className="markdown-heavy-island-placeholder markdown-heavy-table-placeholder">
      <div className="markdown-heavy-island-placeholder-body">
        <strong>{t("messages.markdownHeavyBlockDeferred")}</strong>
        <span>
          {t("messages.markdownHeavyBlockMeta", {
            kind: t("messages.markdownHeavyBlockTable"),
            lines: rowCount,
          })}
        </span>
        <button type="button" onClick={() => setExpanded(true)}>
          {t("messages.markdownHeavyBlockShow")}
        </button>
      </div>
    </div>
  );
}

export function extractAlertToneFromNode(node: ReactNode): string | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const tone = extractAlertToneFromNode(child);
      if (tone) {
        return tone;
      }
    }
    return null;
  }
  if (!isValidElement<{ className?: string; children?: ReactNode }>(node)) {
    return null;
  }
  const className = typeof node.props?.className === "string" ? node.props.className : "";
  const toneMatch = className.match(/\bmarkdown-alert-label-(note|tip|important|warning|caution)\b/);
  if (toneMatch?.[1]) {
    return toneMatch[1];
  }
  return extractAlertToneFromNode(node.props?.children);
}

export function PreBlock({
  node,
  children,
  copyUseModifier,
  sourceMarkdown,
  workspaceId,
  onOpenFileLink,
  onOpenFileLinkMenu,
  onOpenHtmlInBrowser,
}: PreProps) {
  const { className, value } = extractCodeFromPre(node);
  if (!className && !value && children) {
    return <pre>{children}</pre>;
  }
  const urlLines = extractUrlLines(value);
  if (urlLines) {
    return <LinkBlock urls={urlLines} />;
  }
  const languageTag = extractLanguageTag(className);
  const markdownContent = extractMarkdownContent(languageTag, value ?? "");
  if (markdownContent && shouldRenderMarkdownFenceAsCard(node, sourceMarkdown)) {
    return (
      <MarkdownBlock
        className={className}
        value={markdownContent}
        copyUseModifier={copyUseModifier}
        workspaceId={workspaceId}
        onOpenFileLink={onOpenFileLink}
        onOpenFileLinkMenu={onOpenFileLinkMenu}
        onOpenHtmlInBrowser={onOpenHtmlInBrowser}
      />
    );
  }
  const mermaidContent = extractMermaidContent(languageTag, value ?? "");
  if (mermaidContent) {
    return (
      <Suspense fallback={<MermaidFallback />}>
        <MermaidBlock value={mermaidContent} copyUseModifier={copyUseModifier} />
      </Suspense>
    );
  }
  const latexContent = extractLatexContent(languageTag, value ?? "");
  if (latexContent) {
    return (
      <LatexBlock
        className={className}
        value={latexContent}
        copyUseModifier={copyUseModifier}
      />
    );
  }
  const isSingleLine = !value.includes("\n");
  if (isSingleLine) {
    // Compact single-line card (no language header / line numbers), but still
    // exposes the same copy control as multi-line blocks — install commands
    // and one-liners are the main copy targets.
    const fencedValue = `\`\`\`${languageTag ?? ""}\n${value}\n\`\`\``;
    const highlightedHtml = highlightLine(value, languageTag);
    return (
      <div className="markdown-codeblock-single-wrap">
        <div className="markdown-codeblock-single-actions">
          <CodeBlockCopyButton
            value={value}
            fencedValue={fencedValue}
            copyUseModifier={copyUseModifier}
          />
        </div>
        <pre className="markdown-codeblock-single">
          <code
            className={className}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </pre>
      </div>
    );
  }
  const codeLineCount = value.split(/\r?\n/).length;
  if (shouldDeferCodeBlock({ valueLength: value.length, lineCount: codeLineCount })) {
    return (
      <DeferredCodeBlock
        className={className}
        value={value}
        copyUseModifier={copyUseModifier}
        languageLabel={languageTag ?? "Code"}
        lineCount={codeLineCount}
      />
    );
  }
  return (
    <CodeBlock
      className={className}
      value={value}
      copyUseModifier={copyUseModifier}
    />
  );
}
