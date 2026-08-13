// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ConversationItem } from '../../../../types';
import { RequestUserInputSubmittedBlock } from './RequestUserInputSubmittedBlock';

function buildItem(detail: string): Extract<ConversationItem, { kind: 'tool' }> {
  return {
    id: 'request-user-input-submitted-test-1',
    kind: 'tool',
    toolType: 'requestUserInputSubmitted',
    title: 'Input requested',
    detail,
    status: 'completed',
    output: '不启用',
  };
}

describe('RequestUserInputSubmittedBlock', () => {
  it('defaults to process-phase style collapsed label with selected results', () => {
    const detail = JSON.stringify({
      schema: 'requestUserInputSubmitted/v1',
      submittedAt: Date.now(),
      questions: [
        {
          id: 'q-0',
          header: '部署环境',
          question: '你希望我先按哪种环境生成配置？',
          options: [
            { label: '本地开发（local）', description: '' },
            { label: '生产（production）', description: '' },
          ],
          selectedOptions: [],
          note: '',
        },
      ],
    });

    render(<RequestUserInputSubmittedBlock item={buildItem(detail)} />);

    // Same shape as 「已处理 · 思考 1 次 ›」: head · summary, no heavy card chrome.
    expect(screen.getByRole('button', { expanded: false }).textContent).toMatch(
      /已提交|Submitted/,
    );
    expect(screen.getByText(/部署环境/)).toBeTruthy();
    expect(screen.queryByText('本地开发（local）')).toBeNull();
  });

  it('expands to a flat question → answer list without option grid', () => {
    const detail = JSON.stringify({
      schema: 'requestUserInputSubmitted/v1',
      submittedAt: Date.now(),
      questions: [
        {
          id: 'q-0',
          header: '可选偏好',
          question: '是否启用实验功能 X？',
          options: [
            { label: '启用', description: '启用实验功能 X' },
            { label: '不启用', description: '不启用，按默认配置继续' },
          ],
          selectedOptions: ['不启用'],
          note: '',
        },
      ],
    });

    render(<RequestUserInputSubmittedBlock item={buildItem(detail)} />);

    fireEvent.click(screen.getByRole('button', { expanded: false }));

    expect(screen.getByText('是否启用实验功能 X？')).toBeTruthy();
    expect(screen.getByText('不启用')).toBeTruthy();
    // Unselected option descriptions stay hidden in the compact expand view.
    expect(screen.queryByText('启用实验功能 X')).toBeNull();
    expect(screen.getByRole('button', { expanded: true })).toBeTruthy();
  });
});
