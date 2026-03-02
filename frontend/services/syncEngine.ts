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

import { NoteMutationItem, NoteMutationResult } from "../types";
import {
  fetchPendingSyncOps,
  getPendingSyncCount,
  incrementSyncRetry,
  removeSyncOperation,
  updateNoteSyncStatus,
  type SyncQueueItem,
} from "./database";
import { syncService } from "./syncService";

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
    const actionableOps = operations.filter(
      (op) => op.retryCount < MAX_SYNC_RETRIES,
    );

    result.skipped = operations.length - actionableOps.length;

    if (actionableOps.length === 0) {
      return result;
    }

    const mutations = actionableOps.map(toMutationItem);
    const response = await syncService.replayMutationsBatch(mutations);

    await applyMutationResults(actionableOps, response.results, result);
  } finally {
    isSyncing = false;
  }

  console.log(
    `[SyncEngine] Replay complete: ${result.succeeded} ok, ${result.failed} failed, ${result.skipped} skipped`,
  );

  return result;
};

// ============================================================================
// 批量回放结果处理
// ============================================================================

/**
 * 本地 queue op 转后端 mutations item
 */
const toMutationItem = (op: SyncQueueItem): NoteMutationItem => {
  const payload = parsePayload(op.payload);

  if (op.type === "edit") {
    return {
      op_id: String(op.id),
      type: "update_note",
      note_id: op.noteId,
      patch: payload,
    };
  }

  if (op.type === "favorite") {
    return {
      op_id: String(op.id),
      type: "set_favorite",
      note_id: op.noteId,
      is_favorite: !!payload.is_favorite,
    };
  }

  return {
    op_id: String(op.id),
    type: "delete_note",
    note_id: op.noteId,
  };
};

/**
 * 根据 mutations 返回结果更新本地队列与统计
 */
const applyMutationResults = async (
  ops: SyncQueueItem[],
  results: NoteMutationResult[],
  summary: SyncReplayResult,
): Promise<void> => {
  const opMap = new Map<number, SyncQueueItem>();
  for (const op of ops) {
    opMap.set(op.id, op);
  }

  for (const item of results) {
    const opId = Number(item.op_id);
    const op = Number.isNaN(opId) ? undefined : opMap.get(opId);

    if (!op) {
      continue;
    }

    // 成功、目标不存在都视为已处理，移除队列
    if (item.status === "applied" || item.status === "not_found") {
      await removeSyncOperation(op.id);
      if (op.type !== "delete") {
        await updateNoteSyncStatus(op.noteId, true);
      }
      summary.succeeded++;
      continue;
    }

    // invalid / failed 进入重试
    await incrementSyncRetry(op.id);
    summary.failed++;
  }

  // 防御：results 中未出现的任务，计为失败并增加重试
  const handledIds = new Set(results.map((item) => Number(item.op_id)));
  for (const op of ops) {
    if (!handledIds.has(op.id)) {
      await incrementSyncRetry(op.id);
      summary.failed++;
    }
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
