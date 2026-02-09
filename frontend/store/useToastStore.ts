import { create } from "zustand";

import { ToastMessage, ToastType } from "../types";

/**
 * Toast 状态管理 Store
 *
 * 职责：
 * 1. 维护当前显示的 Toast 消息
 * 2. 提供 show/hide 操作方法
 * 3. 支持消息队列（一次只显示一条，后续消息排队等待）
 *
 * 使用方式：
 * - 推荐通过 useToast Hook 调用，提供更友好的 API
 * - 在非组件代码中可直接调用: useToastStore.getState().showToast(...)
 */

interface ToastState {
  /** 当前显示的 Toast（null 表示无显示） */
  currentToast: ToastMessage | null;
  /** 等待显示的 Toast 队列 */
  queue: ToastMessage[];

  /** 显示 Toast（核心方法） */
  showToast: (
    message: string,
    type?: ToastType,
    options?: {
      duration?: number;
      actionLabel?: string;
      onAction?: () => void;
    },
  ) => void;

  /** 隐藏当前 Toast（自动显示队列中下一条） */
  hideToast: () => void;

  /** 清空所有 Toast（包括队列） */
  clearAll: () => void;
}

/**
 * 生成唯一 ID（用于标识每条 Toast）
 */
const generateId = () =>
  `toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const useToastStore = create<ToastState>((set, get) => ({
  currentToast: null,
  queue: [],

  showToast: (message, type = "info", options = {}) => {
    const newToast: ToastMessage = {
      id: generateId(),
      message,
      type,
      duration: options.duration,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
    };

    const { currentToast } = get();

    if (currentToast) {
      // 当前有 Toast 显示中，将新消息加入队列
      set((state) => ({
        queue: [...state.queue, newToast],
      }));
    } else {
      // 无显示中的 Toast，直接显示
      set({ currentToast: newToast });
    }
  },

  hideToast: () => {
    const { queue } = get();

    if (queue.length > 0) {
      // 队列中有等待的消息，显示下一条
      const [nextToast, ...restQueue] = queue;
      set({
        currentToast: nextToast,
        queue: restQueue,
      });
    } else {
      // 队列为空，清除当前 Toast
      set({ currentToast: null });
    }
  },

  clearAll: () => {
    set({
      currentToast: null,
      queue: [],
    });
  },
}));
