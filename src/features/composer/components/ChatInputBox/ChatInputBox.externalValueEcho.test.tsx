// @vitest-environment jsdom
// 回归:外部 value 写入(如终端"发送到输入框")后,contenteditable 不会产生
// input 事件回声;旧实现用布尔 flag 吞掉"下一次" input,结果吞掉的是用户的
// 真实编辑(典型:清空输入框),导致父级草稿 store 滞留旧文本,下一次终端
// 插入基于旧草稿追加,表现为内容重复累加。
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ChatInputBoxHeader.js', () => ({
  ChatInputBoxHeader: () => null,
}));

vi.mock('./ChatInputBoxFooter.js', () => ({
  ChatInputBoxFooter: () => null,
}));

vi.mock('./ContextBar.js', () => ({
  ContextBar: () => null,
}));

vi.mock('./ResizeHandles.js', () => ({
  ResizeHandles: () => null,
}));

vi.mock('@mossx/plugin-skills/ui', () => ({
  CuratedSkillIndicator: () => null,
}));

import { ChatInputBox } from './ChatInputBox.js';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    initReactI18next: {
      type: '3rdParty' as const,
      init: () => {},
    },
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

function setEditableText(editable: HTMLDivElement, text: string) {
  editable.innerText = text;
  if (text) {
    let textNode = editable.firstChild as Text | null;
    if (!(textNode instanceof Text)) {
      textNode = document.createTextNode(text);
      editable.innerHTML = '';
      editable.appendChild(textNode);
    }
    textNode.textContent = text;
  } else {
    editable.innerHTML = '';
  }
}

describe('ChatInputBox external value echo handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0)
    );
    localStorage.clear();
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('propagates a user clear that follows an external value update', async () => {
    const onInput = vi.fn();
    const view = render(
      <ChatInputBox showHeader={false} value="" onInput={onInput} />
    );
    const editable = view.container.querySelector('.input-editable') as HTMLDivElement | null;
    expect(editable).toBeTruthy();
    if (!editable) return;
    Object.defineProperty(editable, 'isContentEditable', {
      value: true,
      configurable: true,
    });

    // 外部同步只在输入框未聚焦时生效(聚焦时 DOM 为事实源)。
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // 外部写入(终端"发送到输入框"路径):不产生 input 事件。
    view.rerender(
      <ChatInputBox showHeader={false} value="1 desktop-cc-gui" onInput={onInput} />
    );
    await act(async () => {
      vi.runAllTimers();
    });
    expect(editable.innerText).toBe('1 desktop-cc-gui');

    // 用户清空输入框:这是外部写入后的第一次真实编辑,必须上抛。
    editable.focus();
    setEditableText(editable, '');
    fireEvent.input(editable);
    await act(async () => {
      vi.runAllTimers();
    });

    expect(onInput).toHaveBeenCalledWith('');
  });

  it('still swallows a true echo whose text matches the external value', async () => {
    const onInput = vi.fn();
    const view = render(
      <ChatInputBox showHeader={false} value="" onInput={onInput} />
    );
    const editable = view.container.querySelector('.input-editable') as HTMLDivElement | null;
    expect(editable).toBeTruthy();
    if (!editable) return;
    Object.defineProperty(editable, 'isContentEditable', {
      value: true,
      configurable: true,
    });

    view.rerender(
      <ChatInputBox showHeader={false} value="1 desktop-cc-gui" onInput={onInput} />
    );
    await act(async () => {
      vi.runAllTimers();
    });

    // 与外部值完全一致的 input 视为回声,不上抛(父级已持有该值)。
    editable.focus();
    fireEvent.input(editable);
    await act(async () => {
      vi.runAllTimers();
    });

    expect(onInput).not.toHaveBeenCalledWith('1 desktop-cc-gui');
  });
});
