/**
 * 笔记筛选工具函数
 *
 * 职责：
 *   从笔记列表中提取分类/标签信息，以及执行内存过滤 Pipeline。
 *   抽取为独立工具函数，供多个页面复用：
 *   - hooks/useSearch.ts（搜索页）
 *   - app/(tabs)/read.tsx（阅读页 Drawer 筛选）
 *
 * 设计原则：
 *   - 纯函数，无副作用，无 React 依赖
 *   - 防御性编程：所有数组/对象访问使用 ?. / ??
 */
import i18next from "../i18n";
import { CategoryFilter, Note } from "../types";

/** 未分类笔记的特殊标识（用于筛选 category 为空的笔记） */
export const UNCATEGORIZED_ID = "__uncategorized__";

/**
 * 从笔记列表动态提取分类（含"未分类"选项）
 * 分类按字母/拼音排序，"未分类"始终排在末尾
 */
export const extractCategories = (notes: Note[]): CategoryFilter[] => {
  const categorySet = new Set<string>();
  let hasUncategorized = false;

  notes?.forEach((n) => {
    if (n.category?.trim()) {
      categorySet.add(n.category.trim());
    } else {
      hasUncategorized = true;
    }
  });

  const result: CategoryFilter[] = [...categorySet]
    .sort()
    .map((c) => ({ id: c, label: c }));

  // "未分类"放在末尾
  if (hasUncategorized) {
    result.push({
      id: UNCATEGORIZED_ID,
      label: i18next.t("search.uncategorized"),
    });
  }

  return result;
};

/**
 * 从笔记列表提取标签（按出现频次降序，限制最大展示数量）
 * 只展示 Top N 标签，避免 Chip 区域过于拥挤
 */
export const extractTags = (notes: Note[], maxCount: number): string[] => {
  const tagCount = new Map<string, number>();

  notes?.forEach((n) => {
    n.tags?.forEach((t) => {
      const trimmed = t?.trim();
      if (trimmed) {
        tagCount.set(trimmed, (tagCount.get(trimmed) ?? 0) + 1);
      }
    });
  });

  return [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([tag]) => tag);
};

/**
 * 内存搜索过滤 Pipeline
 *
 * 流程：分类过滤 → 标签过滤(AND) → 关键词模糊匹配 → 收藏优先+时间倒序
 *
 * @param notes - 全量笔记列表（来自 useNotes 缓存）
 * @param keyword - 防抖后的搜索关键词
 * @param selectedCategory - 当前选中的分类 ID（null = 不限）
 * @param selectedTags - 当前选中的标签列表（空 = 不限）
 */
export const filterNotes = (
  notes: Note[],
  keyword: string,
  selectedCategory: string | null,
  selectedTags: string[],
): Note[] => {
  let filtered = notes ?? [];

  // Step 1: 分类过滤
  if (selectedCategory === UNCATEGORIZED_ID) {
    filtered = filtered.filter((n) => !n.category?.trim());
  } else if (selectedCategory) {
    filtered = filtered.filter((n) => n.category?.trim() === selectedCategory);
  }

  // Step 2: 标签过滤（AND 逻辑 — 笔记必须包含所有已选标签）
  if (selectedTags.length > 0) {
    filtered = filtered.filter((n) =>
      selectedTags.every((t) => n.tags?.includes(t)),
    );
  }

  // Step 3: 关键词模糊匹配（大小写不敏感）
  const kw = keyword?.trim().toLowerCase();
  if (kw) {
    filtered = filtered.filter((n) => n.title?.toLowerCase().includes(kw));
  }

  // Step 4: 排序 — 收藏优先 → 时间倒序
  return [...filtered].sort((a, b) => {
    const aFav = a.isFavorite ? 1 : 0;
    const bFav = b.isFavorite ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
};

/**
 * 按分类过滤笔记列表（简化版，用于阅读页 Drawer 筛选）
 *
 * @param notes - 全量笔记列表
 * @param categoryName - 分类名称，null 表示"全部"
 */
export const filterNotesByCategory = (
  notes: Note[],
  categoryName: string | null,
): Note[] => {
  if (!categoryName) return notes ?? [];

  if (categoryName === UNCATEGORIZED_ID) {
    return (notes ?? []).filter((n) => !n.category?.trim());
  }

  return (notes ?? []).filter((n) => n.category?.trim() === categoryName);
};

/**
 * 统计未分类笔记数量
 */
export const countUncategorizedNotes = (notes: Note[]): number => {
  return (notes ?? []).filter((n) => !n.category?.trim()).length;
};

/**
 * 过滤收藏笔记（用于收藏列表页）
 *
 * 返回 isFavorite === true 的笔记，按时间倒序排列。
 * 与 filterNotesByCategory 同级复用风格。
 *
 * @param notes - 全量笔记列表（来自 useNotes 缓存）
 */
export const filterFavoriteNotes = (notes: Note[]): Note[] => {
  return (notes ?? [])
    .filter((n) => n.isFavorite === true)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};
