/**
 * 搜索功能 Hook（本地搜索版）
 *
 * 职责：
 * - 消费 useNotes 缓存的笔记列表作为本地数据源（零网络依赖）
 * - 300ms 防抖实现"边打边搜"体验
 * - 内存过滤 Pipeline：分类 → 标签(AND) → 关键词模糊匹配 → 排序（收藏优先+时间倒序）
 * - 从笔记缓存动态提取分类列表和标签列表（按频次 Top N）
 * - 进入搜索页时自动触发笔记列表刷新（确保数据新鲜）
 *
 * 数据源：useNotes() → TanStack Query 缓存 + SQLite 离线降级
 * 使用方：app/search.tsx
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APP_CONFIG } from "../constants/config";
import { CategoryFilter, Note, SearchState } from "../types";
import {
  extractCategories,
  extractTags,
  filterNotes,
} from "../utils/noteFilters";
import { useNotes } from "./useNotes";

// ── 常量 ──────────────────────────────────────────────

// extractCategories / extractTags / filterNotes / UNCATEGORIZED_ID
// 已抽取到 utils/noteFilters.ts 供多页面复用，此处直接 re-export 供搜索页使用
export { UNCATEGORIZED_ID } from "../utils/noteFilters";

// extractCategories / extractTags / filterNotes 已迁移至 utils/noteFilters.ts

// ============================================================================
// Hook 主体
// ============================================================================

/** useSearch 返回值类型 */
interface UseSearchReturn {
  /** 当前搜索输入框文本 */
  query: string;
  /** 搜索页面状态机（idle / results / empty） */
  searchState: SearchState;
  /** 搜索/筛选结果笔记列表 */
  results: Note[];
  /** 搜索结果总数 */
  resultCount: number;
  /** 笔记缓存是否为空（全量无笔记） */
  hasNoNotes: boolean;
  /** 笔记列表是否正在加载 */
  isLoadingNotes: boolean;
  /** 动态分类列表（从笔记缓存提取） */
  categories: CategoryFilter[];
  /** 动态标签列表（按频次 Top N，从笔记缓存提取） */
  allTags: string[];
  /** 当前选中的分类 ID（null = 全部） */
  selectedCategory: string | null;
  /** 当前选中的标签列表 */
  selectedTags: string[];
  /** 更新搜索输入（触发 300ms 防抖） */
  handleInputChange: (text: string) => void;
  /** 清空搜索输入和所有筛选条件，回到初始态 */
  clearSearch: () => void;
  /** 切换分类选中（再次点击取消选中） */
  toggleCategory: (categoryId: string) => void;
  /** 切换标签选中（支持多选） */
  toggleTag: (tag: string) => void;
  /** 清除所有筛选条件（分类+标签），保留搜索关键词 */
  clearFilters: () => void;
}

export const useSearch = (): UseSearchReturn => {
  // ── 数据源：消费 useNotes 缓存 ────────────────────
  const {
    notes: allNotes,
    isLoading: isLoadingNotes,
    refetch: refetchNotes,
  } = useNotes();

  // ── 搜索输入状态 ──────────────────────────────────
  /** 用户输入的实时文本（UI 绑定） */
  const [query, setQuery] = useState("");
  /** 防抖结束后的实际搜索关键词（驱动过滤） */
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // ── 筛选状态 ──────────────────────────────────────
  /** 当前选中的分类 ID（null = 不限） */
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  /** 当前选中的标签列表 */
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 防抖计时器
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 进入搜索页时刷新笔记缓存（确保数据新鲜） ─────
  const hasRefetched = useRef(false);
  useEffect(() => {
    if (!hasRefetched.current) {
      hasRefetched.current = true;
      refetchNotes();
    }
  }, [refetchNotes]);

  // ── 动态提取分类和标签（useMemo 缓存，笔记不变则不重算） ──
  const categories = useMemo(() => extractCategories(allNotes), [allNotes]);
  const allTags = useMemo(
    () => extractTags(allNotes, APP_CONFIG.MAX_TAG_DISPLAY_COUNT),
    [allNotes],
  );

  // ── 内存过滤 Pipeline（核心搜索逻辑） ─────────────
  const results = useMemo(
    () => filterNotes(allNotes, debouncedQuery, selectedCategory, selectedTags),
    [allNotes, debouncedQuery, selectedCategory, selectedTags],
  );

  // ── 状态机推导（纯声明式，无 useEffect） ──────────
  const hasActiveFilter = !!(
    debouncedQuery.trim() ||
    selectedCategory ||
    selectedTags.length > 0
  );

  const searchState: SearchState = useMemo(() => {
    if (!hasActiveFilter) return "idle";
    return results.length > 0 ? "results" : "empty";
  }, [hasActiveFilter, results.length]);

  // ── 输入变更（300ms 防抖）─────────────────────────
  const handleInputChange = useCallback((text: string) => {
    setQuery(text);

    // 清除上一次防抖计时器
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // 输入为空 → 立即重置 debouncedQuery
    if (!text.trim()) {
      setDebouncedQuery("");
      return;
    }

    // 防抖：300ms 后更新实际搜索词
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, APP_CONFIG.SEARCH_DEBOUNCE_MS);
  }, []);

  // ── 清空全部（关键词 + 筛选条件）─────────────────
  const clearSearch = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setQuery("");
    setDebouncedQuery("");
    setSelectedCategory(null);
    setSelectedTags([]);
  }, []);

  // ── 切换分类（再次点击同一个 → 取消选中）─────────
  const toggleCategory = useCallback((categoryId: string) => {
    setSelectedCategory((prev) => (prev === categoryId ? null : categoryId));
  }, []);

  // ── 切换标签（多选 toggle）───────────────────────
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  // ── 仅清除筛选条件（保留搜索关键词）──────────────
  const clearFilters = useCallback(() => {
    setSelectedCategory(null);
    setSelectedTags([]);
  }, []);

  // ── 清理防抖计时器 ────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    query,
    searchState,
    results,
    resultCount: results.length,
    hasNoNotes: allNotes.length === 0 && !isLoadingNotes,
    isLoadingNotes,
    categories,
    allTags,
    selectedCategory,
    selectedTags,
    handleInputChange,
    clearSearch,
    toggleCategory,
    toggleTag,
    clearFilters,
  };
};
