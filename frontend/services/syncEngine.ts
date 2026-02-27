/**
 * 离线同步重放引擎 (Sync Replay Engine)
 *
 * 职责：
 *   当网络从离线恢复为在线时，按创建时间顺序逐条重放 sync_queue 中的操作。
 *   重放成功后移除队列条目 + 标记 isSynced=1；失败时增加重试计数。
 *
 * 设计决策：
 *   - 逐条串行重放（避免并发导致顺序依赖问题，如先 edit 后 delete）
 *   - 最大重试次数 MAX_SYNC_RETRIES，超过后跳过（留待下次恢复在线再试）
 *   - 同一笔记连续多次 edit → 仅最后一条有意义，但仍全部发送（幂等）
 *   - delete 后的 edit/favorite 无意义，但后端会返回 404 → 自动跳过
 *
 * 消费方：
 *   由 useNetworkStore 在 isOnline 从 false→true 时触发 `replaySyncQueue()`。
 *   也可由用户手动触发（如设置页"立即同步"按钮 — 未来迭代）。
 */

import { ENDPOINTS } from "../constants/config";
import api from "./api";
import {
  fetchPendingSyncOps,
  getPendingSyncCount,
  incrementSyncRetry,
  removeSyncOperation,
  updateNoteSyncStatus,
  type SyncQueueItem,
} from "./database";

// ============================================================================
// 常量配置
// ============================================================================

/** 单条操作最大重试次数，超过后本轮跳过 */
const MAX_SYNC_RETRIES = 5;

// ============================================================================
// 重放结果类型
// ============================================================================

export interface SyncReplayResult {
  /** 总待同步数量 */
  total: number;
  /** 成功数量 */
  succeeded: number;
  /** 失败数量 */
  failed: number;
  /** 跳过数量（超过最大重试次数） */
  skipped: number;
}

// ============================================================================
// 防重入锁
// ============================================================================

let isSyncing = false;

/**
 * 当前是否正在同步（供 UI 层查询展示状态）
 */
export const getIsSyncing = (): boolean => isSyncing;

// ============================================================================
// 核心重放逻辑
// ============================================================================

/**
 * 重放同步队列
 *
 * 按 createdAt 升序逐条处理每个离线操作：
 *   - edit   → PUT /library/notes/:id (发送 toAPIFormat 后的 payload)
 *   - delete → DELETE /library/notes/:id
 *   - favorite → POST /library/notes/:id/favorite
 *
 * @returns 重放结果统计
 */
export const replaySyncQueue = async (): Promise<SyncReplayResult> => {
  // 防重入：如果已经在同步中，跳过
  if (isSyncing) {
    console.log("[SyncEngine] Already syncing, skipping duplicate call");
    return { total: 0, succeeded: 0, failed: 0, skipped: 0 };
  }

  const pendingCount = await getPendingSyncCount();
  if (pendingCount === 0) {
    console.log("[SyncEngine] No pending operations, nothing to replay");
    return { total: 0, succeeded: 0, failed: 0, skipped: 0 };
  }

  isSyncing = true;
  console.log(`[SyncEngine] Starting replay of ${pendingCount} operations...`);

  const result: SyncReplayResult = {
    total: pendingCount,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    const operations = await fetchPendingSyncOps();

    for (const op of operations) {
      // 超过最大重试次数 → 跳过，不删除（留待用户处理或下次手动同步）
      if (op.retryCount >= MAX_SYNC_RETRIES) {
        console.warn(
          `[SyncEngine] Skipping op #${op.id} (${op.type} note:${op.noteId}) — exceeded max retries (${op.retryCount})`,
        );
        result.skipped++;
        continue;
      }

      try {
        await replaySingleOperation(op);
        // 成功：移除队列条目 + 标记笔记已同步
        await removeSyncOperation(op.id);
        // delete 操作后笔记已不存在，不需要标记 isSynced
        if (op.type !== "delete") {
          await updateNoteSyncStatus(op.noteId, true);
        }
        result.succeeded++;
        console.log(
          `[SyncEngine] ✅ Replayed op #${op.id}: ${op.type} note:${op.noteId}`,
        );
      } catch (error: unknown) {
        // 特殊处理：404 表示笔记已在服务端不存在
        // 对于 edit/favorite 操作遇到 404，意味着笔记已被删除，直接移除队列条目
        const statusCode = extractStatusCode(error);
        if (statusCode === 404 && op.type !== "delete") {
          console.warn(
            `[SyncEngine] Op #${op.id}: note ${op.noteId} not found on server (404), removing from queue`,
          );
          await removeSyncOperation(op.id);
          result.succeeded++; // 视为"已处理"
          continue;
        }

        // 对于 delete 操作遇到 404，也视为成功（本就是要删除的）
        if (statusCode === 404 && op.type === "delete") {
          console.log(
            `[SyncEngine] Op #${op.id}: delete target already gone (404), removing from queue`,
          );
          await removeSyncOperation(op.id);
          result.succeeded++;
          continue;
        }

        // 其他错误：增加重试计数
        await incrementSyncRetry(op.id);
        result.failed++;
        console.error(
          `[SyncEngine] ❌ Failed op #${op.id}: ${op.type} note:${op.noteId}`,
          error,
        );
      }
    }
  } finally {
    isSyncing = false;
  }

  console.log(
    `[SyncEngine] Replay complete: ${result.succeeded} ok, ${result.failed} failed, ${result.skipped} skipped`,
  );

  return result;
};

// ============================================================================
// 单条操作重放
// ============================================================================

/**
 * 根据操作类型调用对应的后端 API
 */
const replaySingleOperation = async (op: SyncQueueItem): Promise<void> => {
  const payload = parsePayload(op.payload);

  switch (op.type) {
    case "edit":
      // PUT /library/notes/:id — payload 已经是 toAPIFormat 后的格式
      await api.put(`${ENDPOINTS.LIBRARY.GET_NOTE}/${op.noteId}`, payload);
      break;

    case "delete":
      // DELETE /library/notes/:id
      await api.delete(`${ENDPOINTS.LIBRARY.GET_NOTE}/${op.noteId}`);
      break;

    case "favorite":
      // POST /library/notes/:id/favorite
      await api.post(ENDPOINTS.LIBRARY.TOGGLE_FAVORITE(op.noteId));
      break;

    default:
      console.warn(`[SyncEngine] Unknown operation type: ${op.type}`);
  }
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 安全解析操作载荷 JSON
 */
const parsePayload = (raw: string): Record<string, unknown> => {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

/**
 * 从 Axios 错误中提取 HTTP 状态码
 */
const extractStatusCode = (error: unknown): number | undefined => {
  if (error && typeof error === "object") {
    // Axios error 通常有 response.status
    const axiosError = error as { response?: { status?: number } };
    return axiosError.response?.status;
  }
  return undefined;
};
