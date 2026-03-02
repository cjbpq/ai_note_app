import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import i18next from "../i18n";
import {
  applyIncrementalSync,
  batchSaveDetailNotes,
  getUncachedNoteIds,
} from "../services/database";
import { replaySyncQueue } from "../services/syncEngine";
import { syncService } from "../services/syncService";
import { useAuthStore } from "../store/useAuthStore";
import { useNetworkStore } from "../store/useNetworkStore";
import { ServiceError } from "../types";
import { useToast } from "./useToast";

interface SyncRunResult {
  updatedCount: number;
  deletedCount: number;
  cachedCount: number;
  totalToCache: number;
}

interface SyncViewState {
  isSyncing: boolean;
  lastResult: SyncRunResult | null;
  lastSyncAt: number | null;
}

interface UseSyncEngineOptions {
  autoRun?: boolean;
}

// 全局锁：防止多个页面/Hook实例重复并发同步
let runningSyncPromise: Promise<SyncRunResult> | null = null;

/**
 * Phase C 同步编排 Hook
 *
 * 触发链路：
 * 1) 批量回放离线队列（mutations）
 * 2) 增量拉取列表摘要（notes/sync）
 * 3) 增量结果写入本地 SQLite
 * 4) 后台分批静默缓存详情（notes/batch）
 */
export const useSyncEngine = (options: UseSyncEngineOptions = {}) => {
  const { autoRun = false } = options;

  const queryClient = useQueryClient();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const { showError } = useToast();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cacheProgress, setCacheProgress] = useState({ done: 0, total: 0 });
  const [viewState, setViewState] = useState<SyncViewState>({
    isSyncing: false,
    lastResult: null,
    lastSyncAt: null,
  });
  const prevOnline = useRef(isOnline);

  const runSyncPipeline = useCallback(async (): Promise<SyncRunResult> => {
    if (!isAuthenticated || !isOnline || !userId) {
      return {
        updatedCount: 0,
        deletedCount: 0,
        cachedCount: 0,
        totalToCache: 0,
      };
    }

    // 1) 先重放离线变更，保证本地修改优先提交
    await replaySyncQueue();

    // 2) 读取增量游标并执行增量同步
    const since = await syncService.getLastSyncTime(userId);
    const incremental = await syncService.incrementalSync(since);

    // 3) 写入本地（摘要级）
    await applyIncrementalSync(incremental.updated, incremental.deletedIds);
    await syncService.setLastSyncTime(incremental.serverTime, userId);

    // 先刷新列表，用户可立即看到摘要更新
    await queryClient.invalidateQueries({ queryKey: ["notes"] });

    // 4) 后台静默缓存详情
    const updatedIds = incremental.updated.map((note) => note.id);
    const uncachedIds = await getUncachedNoteIds(updatedIds);

    let cachedCount = 0;
    if (uncachedIds.length > 0) {
      setCacheProgress({ done: 0, total: uncachedIds.length });
      const detailedNotes = await syncService.batchFetchNoteDetails(
        uncachedIds,
        (done, total) => {
          setCacheProgress({ done, total });
        },
      );
      await batchSaveDetailNotes(detailedNotes);
      cachedCount = detailedNotes.length;
      setCacheProgress({ done: uncachedIds.length, total: uncachedIds.length });
    } else {
      setCacheProgress({ done: 0, total: 0 });
    }

    // 静默缓存完成后再刷新一次，保证详情级字段可被消费
    await queryClient.invalidateQueries({ queryKey: ["notes"] });

    return {
      updatedCount: incremental.updated.length,
      deletedCount: incremental.deletedIds.length,
      cachedCount,
      totalToCache: uncachedIds.length,
    };
  }, [isAuthenticated, isOnline, queryClient, userId]);

  const triggerSync = useCallback(async (): Promise<SyncRunResult> => {
    if (runningSyncPromise) {
      return runningSyncPromise;
    }

    setIsRefreshing(true);
    setViewState((prev) => ({ ...prev, isSyncing: true }));

    runningSyncPromise = runSyncPipeline()
      .then((result) => {
        if (__DEV__) {
          console.log("[SyncEngine] Sync done", result);
        }
        setViewState({
          isSyncing: false,
          lastResult: result,
          lastSyncAt: Date.now(),
        });
        return result;
      })
      .catch((error: unknown) => {
        const message =
          error instanceof ServiceError
            ? error.message
            : i18next.t("error.sync.pullFailed");
        showError(message);
        setViewState((prev) => ({ ...prev, isSyncing: false }));
        throw error;
      })
      .finally(() => {
        setIsRefreshing(false);
        runningSyncPromise = null;
      });

    return runningSyncPromise;
  }, [runSyncPipeline, showError]);

  // 自动触发：App 启动后首次可用时执行一次
  useEffect(() => {
    if (!autoRun) return;
    if (!isAuthenticated || !isOnline) return;

    triggerSync().catch(() => {
      // 错误已在 triggerSync 内统一 toast
    });
  }, [autoRun, isAuthenticated, isOnline, triggerSync]);

  // 自动触发：网络从离线恢复到在线
  useEffect(() => {
    if (!autoRun) {
      prevOnline.current = isOnline;
      return;
    }

    if (!prevOnline.current && isOnline && isAuthenticated) {
      triggerSync().catch(() => {
        // 错误已在 triggerSync 内统一 toast
      });
    }

    prevOnline.current = isOnline;
  }, [autoRun, isOnline, isAuthenticated, triggerSync]);

  return {
    triggerSync,
    isRefreshing,
    cacheProgress,
    isSyncing: viewState.isSyncing,
    lastResult: viewState.lastResult,
    lastSyncAt: viewState.lastSyncAt,
  };
};
