/**
 * 分类管理 Hook
 *
 * 职责：
 *   - TanStack Query 管理后端分类列表缓存
 *   - 合并本地新建分类（尚未上传的）
 *   - 提供"新建分类"操作（乐观更新 Query 缓存 + AsyncStorage 持久化）
 *   - 统计各分类下笔记数量（从 useNotes 缓存计算）
 *
 * 数据来源（三个界面共享同一数据源）：
 *   ┌──────────────────────────────────────────────┐
 *   │  后端 GET /categories → TanStack Query 缓存   │
 *   │          +                                    │
 *   │  AsyncStorage 本地新建分类                     │
 *   │          ↓ 合并去重                           │
 *   │  categories: NoteCategory[]                   │
 *   │          ↓ 供给                               │
 *   │  上传选择器 / 阅读 Drawer / 搜索筛选 Chip     │
 *   └──────────────────────────────────────────────┘
 *
 * 使用方：
 *   - app/(tabs)/index.tsx（上传界面 — CategoryPicker）
 *   - app/(tabs)/read.tsx（阅读界面 — CategoryDrawer）
 *   - hooks/useSearch.ts（搜索界面 — 间接通过 extractCategories）
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { APP_CONFIG } from "../constants/config";
import {
  fetchCategories,
  getLocalNewCategories,
  saveLocalNewCategory,
} from "../services/categoryService";
import { useAuthStore } from "../store/useAuthStore";
import { NoteCategory } from "../types";
import { useNotes } from "./useNotes";

// ── Query Key（包含 userId 避免账号串缓存） ──
const useCategoriesKey = (userId: string) => ["categories", userId] as const;

/**
 * useCategories — 分类数据统一管理 Hook
 *
 * 返回值：
 * - categories: 合并后端+本地的完整分类列表（含 noteCount）
 * - isLoading / isError
 * - addLocalCategory: 新建分类（乐观更新）
 * - refetchCategories: 刷新
 */
export const useCategories = () => {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id) ?? "anonymous";
  const queryKey = useCategoriesKey(userId);

  // ── 笔记列表（用于统计各分类下数量） ──
  const { notes } = useNotes();

  // ── TanStack Query: 后端分类 + 本地新建合并 ──
  const categoriesQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<NoteCategory[]> => {
      // 并行获取后端分类和本地新建分类
      const [remoteCats, localNames] = await Promise.all([
        fetchCategories(),
        getLocalNewCategories(),
      ]);

      // 合并：后端优先，本地新建去重追加
      const remoteNames = new Set(remoteCats.map((c) => c.name));
      const localOnly = localNames.filter((n) => !remoteNames.has(n));

      const merged: NoteCategory[] = [
        ...remoteCats,
        ...localOnly.map((name) => ({ id: name, name, noteCount: 0 })),
      ];

      return merged;
    },
    enabled: isAuthenticated,
    staleTime: APP_CONFIG.CATEGORY_STALE_TIME,
  });

  // ── 给分类附加真实 noteCount（从笔记缓存实时计算） ──
  const categoriesWithCount = useMemo(() => {
    const baseCats = categoriesQuery.data ?? [];
    if (!notes?.length) return baseCats;

    // 统计每个分类下的笔记数量
    const countMap = new Map<string, number>();
    notes.forEach((n) => {
      const cat = n.category?.trim();
      if (cat) {
        countMap.set(cat, (countMap.get(cat) ?? 0) + 1);
      }
    });

    return baseCats.map((c) => ({
      ...c,
      noteCount: countMap.get(c.name) ?? 0,
    }));
  }, [categoriesQuery.data, notes]);

  // ── 新建分类（乐观更新 + AsyncStorage 持久化） ──
  const addLocalCategory = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      // 1. 乐观更新 Query 缓存（立即在 UI 中可见）
      queryClient.setQueryData<NoteCategory[]>(queryKey, (old) => {
        const existing = old ?? [];
        // 已存在则不重复添加
        if (existing.some((c) => c.name === trimmed)) return existing;
        return [...existing, { id: trimmed, name: trimmed, noteCount: 0 }];
      });

      // 2. 持久化到 AsyncStorage
      await saveLocalNewCategory(trimmed);
    },
    [queryClient, queryKey],
  );

  // ── 刷新 ──
  const refetchCategories = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    /** 完整分类列表（含 noteCount，三个界面共享） */
    categories: categoriesWithCount,
    /** 是否正在加载 */
    isLoading: categoriesQuery.isLoading,
    /** 是否出错 */
    isError: categoriesQuery.isError,
    /** 新建本地分类（乐观更新） */
    addLocalCategory,
    /** 刷新分类列表 */
    refetchCategories,
  };
};
