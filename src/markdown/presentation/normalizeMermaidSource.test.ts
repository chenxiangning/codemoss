import { describe, expect, it } from "vitest";
import { normalizeMermaidSource } from "./normalizeMermaidSource";

describe("normalizeMermaidSource", () => {
  it("returns non-flowchart diagrams unchanged", () => {
    const sequence = "sequenceDiagram\nA->>B: hello (world)";
    expect(normalizeMermaidSource(sequence)).toBe(sequence);
  });

  it("quotes rectangular labels that contain parentheses", () => {
    const input = "flowchart TD\nA[text (parens)] --> B[ok]";
    expect(normalizeMermaidSource(input)).toBe(
      'flowchart TD\nA["text (parens)"] --> B[ok]',
    );
  });

  it("quotes target labels used with a bare left id", () => {
    const input = "flowchart TD\nA --> B[check (requirePerm)]";
    expect(normalizeMermaidSource(input)).toBe(
      'flowchart TD\nA --> B["check (requirePerm)"]',
    );
  });

  it("quotes labels that mix <br/> and parentheses (common LLM pattern)", () => {
    const input =
      "flowchart TD\nA[外部系统] --> B[从管理UI获取 Open API Key<br/>(JWT 运营登录, 设置: perms)]";
    expect(normalizeMermaidSource(input)).toBe(
      'flowchart TD\nA[外部系统] --> B["从管理UI获取 Open API Key<br/>(JWT 运营登录, 设置: perms)"]',
    );
  });

  it("quotes diamond labels with parentheses", () => {
    const input = "flowchart TD\nG{操作类型 (x)} --> H[ok]";
    expect(normalizeMermaidSource(input)).toBe(
      'flowchart TD\nG{"操作类型 (x)"} --> H[ok]',
    );
  });

  it("does not rewrite already-quoted labels", () => {
    const input = 'flowchart TD\nA["text (parens)"] --> B[ok]';
    expect(normalizeMermaidSource(input)).toBe(input);
  });

  it("does not rewrite cylinder, circle, stadium, or subroutine shapes", () => {
    const input = `flowchart TD
A[(Database)] --> B((Circle))
C([Stadium]) --> D[[Subroutine]]`;
    expect(normalizeMermaidSource(input)).toBe(input);
  });

  it("escapes nested double quotes inside auto-quoted labels", () => {
    const input = 'flowchart TD\nA[say "hi" (now)] --> B[ok]';
    expect(normalizeMermaidSource(input)).toBe(
      'flowchart TD\nA["say #quot;hi#quot; (now)"] --> B[ok]',
    );
  });

  it("leaves safe labels without special characters untouched", () => {
    const input = `flowchart TD
A[外部系统] --> B[后端校验]
B --> C[调用 /blade-system/open/v1/knowledge/**]`;
    expect(normalizeMermaidSource(input)).toBe(input);
  });

  it("normalizes the user-reported knowledge open access flowchart", () => {
    const input = `flowchart TD
  A[外部系统] --> B[从管理UI获取 Open API Key<br/>(JWT 运营登录, 设置: perms、kbScope、QPS/每日限额、Webhook)]
  B --> C[调用 /blade-system/open/v1/knowledge/**]
  C --> D[后端 ApiKey 鉴权 + 租户校验]
  D --> E[权限检查 (requirePerm)]
  E --> F[限流检查 (KnowledgeOpenRateLimiter)]
  F --> G{操作类型}
  G -->|检索 Search| H[知识检索]
  L --> M[可选 Webhook 通知 (KnowledgeOpenWebhookNotifier)]
  subgraph 管理端
  O[Knowledge Open Access Controller<br/>密钥 CRUD + 调用审计分页]
  end`;

    const normalized = normalizeMermaidSource(input);
    expect(normalized).toContain(
      'B["从管理UI获取 Open API Key<br/>(JWT 运营登录, 设置: perms、kbScope、QPS/每日限额、Webhook)"]',
    );
    expect(normalized).toContain('E["权限检查 (requirePerm)"]');
    expect(normalized).toContain('F["限流检查 (KnowledgeOpenRateLimiter)"]');
    expect(normalized).toContain('M["可选 Webhook 通知 (KnowledgeOpenWebhookNotifier)"]');
    // <br/> alone without paren is allowed unquoted by mermaid; leave as-is
    // if no paren — O has <br/> only, still quote because <br/> is in needs-quote set
    expect(normalized).toContain(
      'O["Knowledge Open Access Controller<br/>密钥 CRUD + 调用审计分页"]',
    );
    expect(normalized).toContain("G{操作类型}");
    expect(normalized).toContain("C[调用 /blade-system/open/v1/knowledge/**]");
  });

  it("supports graph TD headers as well as flowchart", () => {
    const input = "graph LR\nA[a (b)] --> B[c]";
    expect(normalizeMermaidSource(input)).toBe('graph LR\nA["a (b)"] --> B[c]');
  });
});
