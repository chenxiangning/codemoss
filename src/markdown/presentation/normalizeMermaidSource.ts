/**
 * Mermaid flowchart unquoted node labels reject parentheses: the lexer emits
 * a `PS` token and fails with "Expecting 'SQE'..., got 'PS'".
 *
 * LLM-generated diagrams almost never quote labels that contain `(...)`,
 * `<br/>`, or similar. Quote rectangular `[...]` and diamond `{...}` labels
 * that need it, without rewriting other shapes:
 * - cylinder `id[(...)]`
 * - circle `id((...))`
 * - stadium `id([...])`
 * - subroutine `id[[...]]`
 * - hexagon `id{{...}}`
 * - parallelogram / trapezoid `id[/.../]` etc.
 * - already-quoted `id["..."]` / `id['...']`
 */

const FLOWCHART_HEADER_RE = /^(?:flowchart|graph)(?:\s|$)/im;

/** Characters / patterns that break unquoted square/diamond labels. */
const LABEL_NEEDS_QUOTE_RE = /[()<>]|<br\s*\/?>/i;

function escapeMermaidQuotedLabel(label: string): string {
  // Mermaid entity form keeps nested double quotes safe inside "..." labels.
  return label.replace(/"/g, "#quot;");
}

function labelNeedsQuote(label: string): boolean {
  if (!label) {
    return false;
  }
  return LABEL_NEEDS_QUOTE_RE.test(label);
}

/**
 * Quote one rectangular label body when needed.
 * Caller must ensure this is a rectangle (not cylinder/subroutine/etc.).
 */
function maybeQuoteRectLabel(id: string, label: string): string {
  if (!labelNeedsQuote(label)) {
    return `${id}[${label}]`;
  }
  return `${id}["${escapeMermaidQuotedLabel(label)}"]`;
}

function maybeQuoteDiamondLabel(id: string, label: string): string {
  if (!labelNeedsQuote(label)) {
    return `${id}{${label}}`;
  }
  return `${id}{"${escapeMermaidQuotedLabel(label)}"}`;
}

/**
 * Walk flowchart source and quote unsafe rectangular / diamond node labels.
 * Only runs for flowchart/graph diagrams; other diagram types pass through.
 */
export function normalizeMermaidSource(source: string): string {
  if (!source || !FLOWCHART_HEADER_RE.test(source)) {
    return source;
  }

  let result = "";
  let i = 0;
  const len = source.length;

  while (i < len) {
    // Match a node id: letter/underscore start, then word chars or hyphens.
    // Mermaid ids are ASCII identifiers in practice (A, B, step1, ...).
    const idStart = i;
    if (/[A-Za-z_]/.test(source[i] ?? "")) {
      let j = i + 1;
      while (j < len && /[\w-]/.test(source[j] ?? "")) {
        j += 1;
      }
      // Must be a whole id (not mid-word): previous char not word/hyphen.
      const prev = idStart > 0 ? source[idStart - 1] : "";
      const id = source.slice(idStart, j);
      const next = source[j];

      if (prev && /[\w-]/.test(prev)) {
        result += source[i];
        i += 1;
        continue;
      }

      // Rectangular: id[label]  — skip shapes that open with specials after [
      if (next === "[") {
        const afterOpen = source[j + 1];
        // cylinder [(, subroutine [[, quoted [" or [', para [/ or [\
        if (
          afterOpen === "(" ||
          afterOpen === "[" ||
          afterOpen === '"' ||
          afterOpen === "'" ||
          afterOpen === "/" ||
          afterOpen === "\\"
        ) {
          result += id;
          i = j;
          continue;
        }
        const close = source.indexOf("]", j + 1);
        if (close === -1) {
          result += id;
          i = j;
          continue;
        }
        const label = source.slice(j + 1, close);
        result += maybeQuoteRectLabel(id, label);
        i = close + 1;
        continue;
      }

      // Diamond: id{label} — skip hexagon {{ and quoted {" or {'
      if (next === "{") {
        const afterOpen = source[j + 1];
        if (
          afterOpen === "{" ||
          afterOpen === '"' ||
          afterOpen === "'"
        ) {
          result += id;
          i = j;
          continue;
        }
        const close = source.indexOf("}", j + 1);
        if (close === -1) {
          result += id;
          i = j;
          continue;
        }
        const label = source.slice(j + 1, close);
        result += maybeQuoteDiamondLabel(id, label);
        i = close + 1;
        continue;
      }

      result += id;
      i = j;
      continue;
    }

    result += source[i];
    i += 1;
  }

  return result;
}
