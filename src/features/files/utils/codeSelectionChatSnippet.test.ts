import { describe, expect, it } from "vitest";
import {
  buildCodeSelectionChatSnippet,
  buildFileChatReference,
} from "./codeSelectionChatSnippet";

describe("buildCodeSelectionChatSnippet", () => {
  it("builds an @file#L reference for multi-line selections", () => {
    expect(
      buildCodeSelectionChatSnippet({
        path: "src/app.ts",
        content: "const a = 1;\nconst b = 2;",
        startLine: 10,
        endLine: 11,
        language: "typescript",
      }),
    ).toBe("@src/app.ts#L10-L11");
  });

  it("uses a single-line fragment when start equals end", () => {
    expect(
      buildCodeSelectionChatSnippet({
        path: "lib/main.py",
        content: "print('hi')",
        startLine: 3,
        endLine: 3,
      }),
    ).toBe("@lib/main.py#L3");
  });

  it("quotes paths that contain whitespace", () => {
    expect(
      buildCodeSelectionChatSnippet({
        path: "docs/my file.ts",
        content: "x",
        startLine: 1,
        endLine: 2,
      }),
    ).toBe('@"docs/my file.ts#L1-L2"');
  });

  it("returns null for empty or invalid selections", () => {
    expect(
      buildCodeSelectionChatSnippet({
        path: "a.ts",
        content: "   ",
        startLine: 1,
        endLine: 1,
      }),
    ).toBeNull();
    expect(
      buildCodeSelectionChatSnippet({
        path: "",
        content: "x",
        startLine: 1,
        endLine: 1,
      }),
    ).toBeNull();
    expect(
      buildCodeSelectionChatSnippet({
        path: "a.ts",
        content: "x",
        startLine: 5,
        endLine: 2,
      }),
    ).toBeNull();
  });
});

describe("buildFileChatReference", () => {
  it("builds a plain @path reference", () => {
    expect(buildFileChatReference("README.md")).toBe("@README.md");
  });

  it("quotes paths with spaces", () => {
    expect(buildFileChatReference("my notes.md")).toBe('@"my notes.md"');
  });
});
