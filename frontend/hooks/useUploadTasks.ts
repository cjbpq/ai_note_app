import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { APP_CONFIG, ROUTES } from "../constants/config";
import { noteService } from "../services/noteService";
import {
  selectRunningCount,
  useUploadTaskStore,
} from "../store/useUploadTaskStore";
import { ServiceError, UploadTask } from "../types";
import { useToast } from "./useToast";

// ============================================================================
// useUploadTasks Hook
// ============================================================================
//
// 职责：
//   多任务并发上传调度 + 独立轮询 + 自动保存 + 完成通知。
//   是"任务引擎"层，UI 组件只消费 Store 中的状态。
//
// 核心机制（并发调度原理）：
//   ┌─────────────────────────────────────────────────────────────┐
//   │ 1. submitTask(imageUri)                                     │
//   │    ├─ 在 Store 中创建 task（status: uploading）              │
//   │    ├─ 调用 noteService.uploadImageNote(imageUri)            │
//   │    ├─ 上传成功 → replaceTaskId(临时ID → jobId)              │
//   │    │            → updateTask(status: processing)            │
//   │    │            → 启动该任务的独立 polling                   │
//   │    └─ 上传失败 → updateTask(status: failed, error)          │
//   │                                                             │
//   │ 2. 独立 polling（每个 task 一个 setInterval）                │
//   │    ├─ 每 2s 调用 getJobStatus(jobId)                        │
//   │    ├─ completed → 自动 sync + 刷新列表 + Snackbar 通知      │
//   │    ├─ failed → updateTask(status: failed, error)            │
//   │    └─ 超过 MAX_RETRIES → timeout 失败                       │
//   │                                                             │
//   │ 3. 并发控制                                                 │
//   │    ├─ running (uploading+processing) >= MAX_CONCURRENT       │
//   │    │  → 新任务 status: queued（排队等待）                    │
//   │    └─ 有任务完成/失败时 → 自动检查 queued 任务并提升         │
//   │                                                             │
//   │ 4. 防重复提交                                               │
//   │    └─ 5 秒内同一图片 URI 不允许再次提交                      │
//   └─────────────────────────────────────────────────────────────┘
//
// ============================================================================

/** 最大并发任务数（uploading + processing） */
const MAX_CONCURRENT = 3;

/** 防重复提交窗口（毫秒） */
const DUPLICATE_WINDOW_MS = 5000;

/**
 * 生成临时任务 ID（上传成功后被后端 jobId 替换）
 */
const generateTempId = () =>
  `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const useUploadTasks = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showSuccess, showError, showInfo } = useToast();

  // Store actions & state
  const {
    tasks,
    addTask,
    updateTask,
    replaceTaskId,
    removeTask,
    markAsRead,
    clearFinished,
    addUnviewedNote,
  } = useUploadTaskStore();

  // ===== Refs：存储轮询 timer，不触发重渲染 =====
  // key: taskId (jobId), value: setInterval ID
  const pollingTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map(),
  );
  // key: taskId, value: 已轮询次数
  const pollingCounts = useRef<Map<string, number>>(new Map());
  // 最近提交的 imageUri → 时间戳，用于防重复
  const recentSubmits = useRef<Map<string, number>>(new Map());
  // 刷新列表的 debounce timer
  const refreshDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // =========================================================================
  // 内部方法：debounced 刷新笔记列表
  // =========================================================================
  // 多任务连续完成时，合并为一次刷新请求，避免高频 API 调用
  const debouncedRefresh = useCallback(() => {
    if (refreshDebounce.current) {
      clearTimeout(refreshDebounce.current);
    }
    refreshDebounce.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["note"] });
      refreshDebounce.current = null;
    }, 1000);
  }, [queryClient]);

  // =========================================================================
  // 内部方法：停止某个任务的轮询
  // =========================================================================
  const stopPolling = useCallback((taskId: string) => {
    const timer = pollingTimers.current.get(taskId);
    if (timer) {
      clearInterval(timer);
      pollingTimers.current.delete(taskId);
    }
    pollingCounts.current.delete(taskId);
  }, []);

  // =========================================================================
  // 内部方法：检查排队任务，有空位时触发上传
  // =========================================================================
  const processQueue = useCallback(() => {
    const currentRunning = useUploadTaskStore
      .getState()
      .tasks.filter(
        (t) => t.status === "uploading" || t.status === "processing",
      ).length;

    if (currentRunning >= MAX_CONCURRENT) return;

    const slots = MAX_CONCURRENT - currentRunning;
    const queued = useUploadTaskStore
      .getState()
      .tasks.filter((t) => t.status === "queued");

    // 按创建时间排序，先提交的先处理
    const toProcess = queued
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, slots);

    toProcess.forEach((task) => {
      const uris = task.imageUris?.length ? task.imageUris : [task.imageUri];
      executeUpload(task.id, uris, task.category);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =========================================================================
  // 内部方法：任务完成回调
  // =========================================================================
  const handleTaskCompleted = useCallback(
    async (taskId: string, noteId: string) => {
      stopPolling(taskId);

      // 1. 更新任务状态 + 记录为未查看笔记（驱动阅读 Tab 角标）
      updateTask(taskId, { status: "completed", noteId });
      addUnviewedNote(noteId);

      // 2. 尝试获取笔记标题（用于 Snackbar 文案）
      let noteTitle = "";
      try {
        const note = await noteService.getNoteById(noteId);
        noteTitle = note?.title ?? "";
        updateTask(taskId, { noteTitle });

        // 3. 自动同步笔记到本地 SQLite 缓存
        if (note) {
          await noteService.syncNoteToLocal(note);
        }
      } catch {
        // 获取标题失败不影响主流程
        if (__DEV__) {
          console.warn("[useUploadTasks] Failed to fetch note title:", noteId);
        }
      }

      // 4. debounced 刷新笔记列表 + 分类缓存
      debouncedRefresh();
      // 上传成功可能产生新分类，刷新分类列表缓存
      queryClient.invalidateQueries({ queryKey: ["categories"] });

      // 5. Snackbar 通知用户（带"查看"按钮）
      const displayTitle = noteTitle || t("upload.task.completed");
      showSuccess(t("upload.task.noteReady", { title: displayTitle }), {
        duration: 4000,
        actionLabel: t("upload.task.viewNote"),
        onAction: () => {
          // 标记已读并跳转到笔记详情
          markAsRead(taskId);
          router.push(`${ROUTES.NOTE_DETAIL}/${noteId}` as never);
        },
      });

      // 6. 检查排队任务
      processQueue();
    },
    [
      stopPolling,
      updateTask,
      addUnviewedNote,
      debouncedRefresh,
      showSuccess,
      markAsRead,
      router,
      processQueue,
      t,
    ],
  );

  // =========================================================================
  // 内部方法：任务失败回调
  // =========================================================================
  const handleTaskFailed = useCallback(
    (taskId: string, errorMessage: string) => {
      stopPolling(taskId);
      updateTask(taskId, { status: "failed", error: errorMessage });
      showError(errorMessage);

      // 检查排队任务
      processQueue();
    },
    [stopPolling, updateTask, showError, processQueue],
  );

  // =========================================================================
  // 内部方法：启动某个任务的独立轮询
  // =========================================================================
  const startPolling = useCallback(
    (taskId: string) => {
      // 防止重复启动
      if (pollingTimers.current.has(taskId)) return;

      pollingCounts.current.set(taskId, 0);

      const timer = setInterval(async () => {
        const count = pollingCounts.current.get(taskId) ?? 0;

        // 超时检查
        if (count >= APP_CONFIG.JOB_MAX_RETRIES) {
          handleTaskFailed(taskId, t("error.upload.jobTimeout"));
          return;
        }

        pollingCounts.current.set(taskId, count + 1);

        try {
          const result = await noteService.getJobStatus(taskId);

          if (result.status === "completed" && result.note_id) {
            handleTaskCompleted(taskId, result.note_id);
          } else if (result.status === "failed") {
            handleTaskFailed(taskId, t("error.upload.jobFailed"));
          }
          // pending / processing → 继续轮询
        } catch (error) {
          if (__DEV__) {
            console.warn("[useUploadTasks] Polling error:", taskId, error);
          }
          // 轮询中的单次错误不终止任务，继续重试
        }
      }, APP_CONFIG.JOB_POLL_INTERVAL);

      pollingTimers.current.set(taskId, timer);
    },
    [handleTaskCompleted, handleTaskFailed, t],
  );

  // =========================================================================
  // 内部方法：执行单个上传任务
  // =========================================================================
  const executeUpload = useCallback(
    async (taskId: string, imageUris: string[], category?: string) => {
      updateTask(taskId, { status: "uploading" });

      try {
        // 调用 Service 层上传图片（支持多图数组）
        // category 透传为 note_type 参数，未选择则使用后端默认值
        const uploadRes = await noteService.uploadImageNote(
          imageUris,
          category || "学习笔记",
        );

        if (__DEV__) {
          console.log(
            "[useUploadTasks] Upload success, jobId:",
            uploadRes.job_id,
          );
        }

        // 防御性检查
        const jobId = uploadRes.job_id;
        if (!jobId) {
          handleTaskFailed(taskId, t("error.upload.failed"));
          return;
        }

        // 替换临时 ID 为后端返回的 jobId
        replaceTaskId(taskId, jobId);

        // 拼接缩略图 URL（后端新 schema 返回 file_urls 数组，兼容旧 file_url 单值）
        let fileUrl: string | undefined;
        const rawFileUrls = uploadRes.file_urls;
        const firstUrl =
          Array.isArray(rawFileUrls) && rawFileUrls.length > 0
            ? rawFileUrls[0]
            : uploadRes.file_url; // 兼容旧字段回退
        if (firstUrl) {
          fileUrl = firstUrl.startsWith("/")
            ? `${APP_CONFIG.STATIC_BASE_URL}${firstUrl}`
            : firstUrl;
        }

        // 更新状态为 processing
        updateTask(jobId, {
          status: "processing",
          fileUrl,
        });

        // 启动独立轮询
        startPolling(jobId);
      } catch (error) {
        const message =
          error instanceof ServiceError
            ? error.message
            : t("error.upload.failed");
        handleTaskFailed(taskId, message);
      }
    },
    [updateTask, replaceTaskId, startPolling, handleTaskFailed, t],
  );

  // =========================================================================
  // 公开方法：提交上传任务
  // =========================================================================
  const submitTask = useCallback(
    (imageUris: string[], category?: string) => {
      if (!imageUris.length) return;

      // ── 防重复提交检查（基于第一张图做简易去重） ──
      const dedupeKey = imageUris[0];
      const now = Date.now();
      const lastSubmit = recentSubmits.current.get(dedupeKey);
      if (lastSubmit && now - lastSubmit < DUPLICATE_WINDOW_MS) {
        showInfo(t("upload.task.duplicateBlocked"));
        return;
      }
      recentSubmits.current.set(dedupeKey, now);

      // 清理过期的重复记录
      recentSubmits.current.forEach((time, uri) => {
        if (now - time > DUPLICATE_WINDOW_MS) {
          recentSubmits.current.delete(uri);
        }
      });

      // ── 创建任务 ──
      const tempId = generateTempId();
      const task: UploadTask = {
        id: tempId,
        imageUri: imageUris[0], // 缩略图用第一张
        imageUris, // 保存完整列表用于上传 / 重试
        category, // 用户选择的分类（可选）
        status: "queued",
        createdAt: now,
        isRead: false,
      };
      addTask(task);

      // ── 并发检查 ──
      const running = selectRunningCount(useUploadTaskStore.getState());
      if (running < MAX_CONCURRENT) {
        // 有空位，立即执行
        executeUpload(tempId, imageUris, category);
      } else {
        // 满了，排队等待，提示用户
        showInfo(t("upload.task.queueFull", { max: MAX_CONCURRENT }));
      }
    },
    [addTask, executeUpload, showInfo, t],
  );

  // =========================================================================
  // 公开方法：重试失败任务
  // =========================================================================
  const retryTask = useCallback(
    (taskId: string) => {
      const task = useUploadTaskStore
        .getState()
        .tasks.find((t) => t.id === taskId);
      if (!task || task.status !== "failed") return;

      // 重置状态并重新提交
      updateTask(taskId, { status: "queued", error: undefined });

      const running = selectRunningCount(useUploadTaskStore.getState());
      if (running < MAX_CONCURRENT) {
        // 优先使用完整 imageUris 数组，兼容旧任务回退到单张
        const uris = task.imageUris?.length ? task.imageUris : [task.imageUri];
        executeUpload(taskId, uris, task.category);
      }
    },
    [updateTask, executeUpload],
  );

  // =========================================================================
  // 清理：组件卸载时停止所有轮询
  // =========================================================================
  useEffect(() => {
    // 捕获当前 ref 值，避免清理时 ref 已变化
    const timers = pollingTimers.current;
    const counts = pollingCounts.current;
    const debounceTimer = refreshDebounce.current;

    return () => {
      // 清理所有轮询 timer
      timers.forEach((timer) => clearInterval(timer));
      timers.clear();
      counts.clear();

      // 清理刷新 debounce
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, []);

  // =========================================================================
  // 返回给 UI 的公开 API
  // =========================================================================
  return {
    // ===== 动作方法 =====
    /** 提交新的上传任务（传入图片 URI） */
    submitTask,
    /** 重试失败的任务 */
    retryTask,
    /** 删除单个任务 */
    removeTask,
    /** 标记任务为已读 */
    markAsRead,
    /** 清除所有已完成/已失败任务 */
    clearFinished,

    // ===== 状态（直接来自 Store） =====
    /** 全部任务列表 */
    tasks,
  };
};
