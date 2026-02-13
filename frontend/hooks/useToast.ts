import { useCallback } from "react";

import { useToastStore } from "../store/useToastStore";
import { ToastType } from "../types";

/**
 * useToast Hook
 *
 * 提供便捷的 Toast 显示方法，封装 Store 操作。
 * 推荐在 UI 组件中使用此 Hook，而非直接调用 Store。
 *
 * 【基本用法】
 * const { showSuccess, showError, showInfo, showWarning } = useToast();
 *
 * // 成功提示
 * showSuccess(t('toast.save_success'));
 *
 * // 错误提示
 * showError(t('toast.save_failed'));
 *
 * // 带操作按钮
 * showInfo(t('toast.deleted'), {
 *   actionLabel: t('common.undo'),
 *   onAction: handleUndo
 * });
 */
export const useToast = () => {
  const { showToast, hideToast, clearAll } = useToastStore();

  /**
   * 显示成功提示（绿色调）
   * 适用场景：保存成功、操作完成等
   */
  const showSuccess = useCallback(
    (
      message: string,
      options?: {
        duration?: number;
        actionLabel?: string;
        onAction?: () => void;
      },
    ) => {
      showToast(message, "success", options);
    },
    [showToast],
  );

  /**
   * 显示错误提示（红色调）
   * 适用场景：保存失败、网络错误等
   */
  const showError = useCallback(
    (
      message: string,
      options?: {
        duration?: number;
        actionLabel?: string;
        onAction?: () => void;
      },
    ) => {
      showToast(message, "error", options);
    },
    [showToast],
  );

  /**
   * 显示普通信息（主题色）
   * 适用场景：一般性提示、状态变更通知
   */
  const showInfo = useCallback(
    (
      message: string,
      options?: {
        duration?: number;
        actionLabel?: string;
        onAction?: () => void;
      },
    ) => {
      showToast(message, "info", options);
    },
    [showToast],
  );

  /**
   * 显示警告提示（橙色调）
   * 适用场景：权限不足、需要注意的事项
   */
  const showWarning = useCallback(
    (
      message: string,
      options?: {
        duration?: number;
        actionLabel?: string;
        onAction?: () => void;
      },
    ) => {
      showToast(message, "warning", options);
    },
    [showToast],
  );

  /**
   * 通用显示方法（可动态指定类型）
   * 适用场景：类型由变量决定时
   */
  const show = useCallback(
    (
      message: string,
      type: ToastType = "info",
      options?: {
        duration?: number;
        actionLabel?: string;
        onAction?: () => void;
      },
    ) => {
      showToast(message, type, options);
    },
    [showToast],
  );

  return {
    // 快捷方法（推荐使用）
    showSuccess,
    showError,
    showInfo,
    showWarning,
    // 通用方法
    show,
    // 控制方法
    hide: hideToast,
    clearAll,
  };
};
