import { create } from "zustand";

import { UploadTask } from "../types";

// ============================================================================
// 上传任务状态管理 Store
// ============================================================================
//
// 职责：
//   管理多个并发上传任务的 UI 状态（任务列表、状态更新、已读标记等）。
//   仅存储客户端 Session 级状态（内存，不持久化），App 关闭即清空。
//
// 数据流：
//   useUploadTasks (Hook) ──调用──> useUploadTaskStore (Store)
//   UI 组件 (UploadTaskTray) ──读取──> useUploadTaskStore (Store)
//
// 注意：
//   并发调度、轮询控制等逻辑在 Hook 层处理，Store 只做状态 CRUD。
// ============================================================================

interface UploadTaskState {
  /** 有序任务列表，最新在前 */
  tasks: UploadTask[];

  /**
   * 用户尚未点进详情页查看过的新笔记 ID 列表。
   * 与 tasks 生命周期解耦：清除任务不影响此列表，
   * 只有用户真正打开笔记详情页时才会移除对应 ID。
   * 用于驱动阅读 Tab 角标数字。
   */
  unviewedNoteIds: string[];

  // ===== 基础操作 =====
  /** 添加新上传任务 */
  addTask: (task: UploadTask) => void;
  /** 更新任务部分字段（按 ID 匹配） */
  updateTask: (id: string, partial: Partial<UploadTask>) => void;
  /** 替换任务 ID（上传成功后将临时 ID → 后端 jobId） */
  replaceTaskId: (oldId: string, newId: string) => void;
  /** 删除单个任务 */
  removeTask: (id: string) => void;
  /** 标记任务为已查看 */
  markAsRead: (id: string) => void;
  /** 清除所有已完成/已失败的任务 */
  clearFinished: () => void;
  /** 重置所有任务（App 级清理） */
  resetAll: () => void;

  // ===== 未查看笔记管理 =====
  /** 任务完成时调用：将 noteId 加入未查看列表 */
  addUnviewedNote: (noteId: string) => void;
  /** 用户打开笔记详情页时调用：将 noteId 从未查看列表移除 */
  markNoteViewed: (noteId: string) => void;
}

export const useUploadTaskStore = create<UploadTaskState>((set) => ({
  tasks: [],
  unviewedNoteIds: [],

  addTask: (task) =>
    set((state) => ({
      tasks: [task, ...state.tasks],
    })),

  updateTask: (id, partial) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...partial } : t)),
    })),

  replaceTaskId: (oldId, newId) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === oldId ? { ...t, id: newId } : t)),
    })),

  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    })),

  markAsRead: (id) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, isRead: true } : t)),
    })),

  clearFinished: () =>
    set((state) => ({
      tasks: state.tasks.filter(
        (t) => t.status !== "completed" && t.status !== "failed",
      ),
    })),

  resetAll: () => set({ tasks: [], unviewedNoteIds: [] }),

  // ===== 未查看笔记管理 =====
  addUnviewedNote: (noteId) =>
    set((state) => ({
      // 防重复添加
      unviewedNoteIds: state.unviewedNoteIds.includes(noteId)
        ? state.unviewedNoteIds
        : [...state.unviewedNoteIds, noteId],
    })),

  markNoteViewed: (noteId) =>
    set((state) => ({
      unviewedNoteIds: state.unviewedNoteIds.filter((id) => id !== noteId),
    })),
}));

// ============================================================================
// 派生选择器 (Selectors)
// ============================================================================
// 推荐在组件中使用这些选择器，避免不必要的重渲染。
// 使用方式：const activeTasks = useUploadTaskStore(selectActiveTasks);
// ============================================================================

/** 正在上传或处理中的活跃任务 */
export const selectActiveTasks = (state: UploadTaskState): UploadTask[] =>
  state.tasks.filter(
    (t) =>
      t.status === "uploading" ||
      t.status === "processing" ||
      t.status === "queued",
  );

/** @deprecated 已被 selectUnviewedNoteCount 替代 */
export const selectUnreadCompletedCount = (state: UploadTaskState): number =>
  state.tasks.filter((t) => t.status === "completed" && !t.isRead).length;

/**
 * 用户尚未打开详情页查看过的新笔记数量。
 * 与任务列表生命周期解耦：清除/删除任务不影响此计数。
 * 仅在用户真正点进笔记详情页后才减少。
 */
export const selectUnviewedNoteCount = (state: UploadTaskState): number =>
  state.unviewedNoteIds.length;

/** 所有任务数量 */
export const selectTotalTaskCount = (state: UploadTaskState): number =>
  state.tasks.length;

/** 是否有任何活跃任务（上传中/处理中/排队中） */
export const selectHasActiveTasks = (state: UploadTaskState): boolean =>
  state.tasks.some(
    (t) =>
      t.status === "uploading" ||
      t.status === "processing" ||
      t.status === "queued",
  );

/** 当前正在上传/处理中的任务数（用于并发控制） */
export const selectRunningCount = (state: UploadTaskState): number =>
  state.tasks.filter(
    (t) => t.status === "uploading" || t.status === "processing",
  ).length;
