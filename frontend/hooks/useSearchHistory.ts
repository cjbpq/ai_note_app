/**
 * 搜索历史 Hook
 *
 * 职责：
 * - 封装 searchHistoryService，通过 TanStack Query 管理缓存与自动刷新
 * - 暴露增/删/清空操作，mutation 成功后自动失效缓存
 *
 * 依赖：searchHistoryService（Service 层）
 * 使用方：app/search.tsx → SearchIdleContent → SearchHistory
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { searchHistoryService } from "../services/searchHistoryService";

/** TanStack Query 缓存 key */
const HISTORY_QUERY_KEY = ["searchHistory"] as const;

/**
 * useSearchHistory 返回值类型
 */
interface UseSearchHistoryReturn {
  /** 搜索历史列表（最新在前） */
  history: string[];
  /** 数据是否正在加载 */
  isLoading: boolean;
  /** 新增一条历史记录（笔记标题） */
  addHistory: (title: string) => void;
  /** 删除单条历史记录 */
  removeOne: (title: string) => void;
  /** 清空所有历史记录 */
  clearAll: () => void;
}

export const useSearchHistory = (): UseSearchHistoryReturn => {
  const queryClient = useQueryClient();

  // ── 读取历史记录 ─────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: HISTORY_QUERY_KEY,
    queryFn: searchHistoryService.getHistory,
    // 本地存储读取很快，短时间缓存即可
    staleTime: 1000 * 60,
  });

  // ── 新增记录 ─────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: searchHistoryService.addHistory,
    onSuccess: () => {
      // 写入成功后立即刷新列表缓存
      queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
    },
  });

  // ── 删除单条 ─────────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: searchHistoryService.removeOne,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
    },
  });

  // ── 清空全部 ─────────────────────────────────────
  const clearMutation = useMutation({
    mutationFn: searchHistoryService.clearAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
    },
  });

  return {
    history: data ?? [],
    isLoading,
    addHistory: (title: string) => addMutation.mutate(title),
    removeOne: (title: string) => removeMutation.mutate(title),
    clearAll: () => clearMutation.mutate(),
  };
};
