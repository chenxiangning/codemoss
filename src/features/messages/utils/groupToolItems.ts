/**
 * 工具项分组逻辑
 * Groups consecutive same-category tool items into batch entries
 */
import type { ConversationItem } from '../../../types';
import {
  classifyToolCategory,
  extractToolName,
} from '../components/toolBlocks/toolConstants';

type ToolItem = Extract<ConversationItem, { kind: 'tool' }>;
type ExploreItem = Extract<ConversationItem, { kind: 'explore' }>;

export type GroupedEntry =
  | { kind: 'item'; item: ConversationItem }
  | { kind: 'readGroup'; items: ToolItem[] }
  | { kind: 'editGroup'; items: ToolItem[] }
  | { kind: 'bashGroup'; items: ToolItem[] }
  | { kind: 'searchGroup'; items: ToolItem[] };

/**
 * 合并连续 explore items
 */
function mergeExploreItems(items: ExploreItem[]): ExploreItem {
  const first = items[0];
  const last = items[items.length - 1];
  if (!first) {
    return {
      id: "explore-group-empty",
      kind: "explore",
      status: "explored",
      entries: [],
    };
  }
  return {
    id: first.id,
    kind: 'explore',
    status: last?.status ?? 'explored',
    title: last?.title ?? first.title,
    collapsible: first.collapsible ?? last?.collapsible,
    mergeKey: first.mergeKey ?? last?.mergeKey,
    entries: items.flatMap((item) => item.entries),
  };
}

function canMergeExploreItems(previous: ExploreItem, next: ExploreItem): boolean {
  const previousKey = previous.mergeKey ?? "default";
  const nextKey = next.mergeKey ?? "default";
  return previousKey === nextKey;
}

/**
 * 将分类映射到 GroupedEntry 的 kind。
 * `fileEdit` 是场景桶：连续的 edit + fileChange 合并为同一「文件修改」场景。
 * （裸 `edit` 不会进入 buffer——resolveSceneCategory 已归一为 fileEdit。）
 * subagent 不再分组：幕布降级为普通工具行，展示收敛到 ComposerRunStatusStrip。
 */
type GroupableCategory = 'read' | 'fileEdit' | 'bash' | 'search';

const CATEGORY_TO_GROUP_KIND: Record<GroupableCategory, GroupedEntry['kind']> = {
  read: 'readGroup',
  fileEdit: 'editGroup',
  bash: 'bashGroup',
  search: 'searchGroup',
};

function isGroupableCategory(cat: string): cat is GroupableCategory {
  return cat in CATEGORY_TO_GROUP_KIND;
}

/**
 * 场景归并桶：Codex 的 fileChange 与 Claude/通用 edit/write 在幕布上同属「文件修改」。
 * 若不归并，会出现连续多个「文件修改（1 个）」标题。
 */
function resolveSceneCategory(category: string): string {
  if (category === 'edit' || category === 'fileChange') {
    return 'fileEdit';
  }
  return category;
}

export function shouldHideToolItemForRender(item: ToolItem): boolean {
  const toolName = extractToolName(item.title).toLowerCase();
  return toolName === 'todowrite' || toolName === 'todo_write';
}

function shouldUngroupSearchTools(item: ToolItem): boolean {
  if (item.toolType !== 'mcpToolCall') {
    return false;
  }
  const toolName = extractToolName(item.title).toLowerCase();
  return toolName === 'search_query';
}

/**
 * 对 ConversationItem[] 进行分组，连续同类工具合并为 group entry。
 * 保留 explore 合并逻辑；edit/fileChange 归并为 fileEdit → editGroup。
 */
export function groupToolItems(items: ConversationItem[]): GroupedEntry[] {
  const entries: GroupedEntry[] = [];

  let exploreBuffer: ExploreItem[] = [];
  let toolBuffer: ToolItem[] = [];
  let currentCategory = '';

  const flushExplores = () => {
    if (exploreBuffer.length === 0) return;
    if (exploreBuffer.length === 1) {
      const firstExplore = exploreBuffer[0];
      if (firstExplore) {
        entries.push({ kind: 'item', item: firstExplore });
      }
    } else {
      entries.push({ kind: 'item', item: mergeExploreItems(exploreBuffer) });
    }
    exploreBuffer = [];
  };

  const flushTools = () => {
    if (toolBuffer.length === 0) return;
    const hasUngroupedSearchTool =
      currentCategory === 'search' && toolBuffer.some(shouldUngroupSearchTools);
    // Keep only codex mcp search_query tools line-by-line so each search record can expand.
    // 文件修改场景：edit + fileChange 归并桶，即使 1 个 tool 也走 editGroup。
    const shouldGroupFileEditScene =
      currentCategory === 'fileEdit' && toolBuffer.length >= 1;
    if (
      !hasUngroupedSearchTool &&
      isGroupableCategory(currentCategory) &&
      (shouldGroupFileEditScene || toolBuffer.length >= 2)
    ) {
      entries.push({
        kind: CATEGORY_TO_GROUP_KIND[currentCategory],
        items: toolBuffer,
      } as GroupedEntry);
    } else {
      for (const item of toolBuffer) {
        entries.push({ kind: 'item', item });
      }
    }
    toolBuffer = [];
    currentCategory = '';
  };

  for (const item of items) {
    if (item.kind === 'explore') {
      flushTools();
      const lastExplore = exploreBuffer[exploreBuffer.length - 1];
      if (lastExplore && !canMergeExploreItems(lastExplore, item)) {
        flushExplores();
      }
      exploreBuffer.push(item);
      continue;
    }

    flushExplores();

    if (item.kind === 'tool') {
      if (shouldHideToolItemForRender(item)) {
        flushTools();
        continue;
      }
      const sceneCategory = resolveSceneCategory(classifyToolCategory(item));
      if (toolBuffer.length > 0 && sceneCategory === currentCategory) {
        toolBuffer.push(item);
      } else {
        flushTools();
        toolBuffer = [item];
        currentCategory = sceneCategory;
      }
      continue;
    }

    // 非 tool/explore item
    flushTools();
    entries.push({ kind: 'item', item });
  }

  flushExplores();
  flushTools();

  return entries;
}
