import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { create } from "zustand";
import { replaySyncQueue, type SyncReplayResult } from "../services/syncEngine";

/**
 * 网络状态 Store
 *
 * 职责：
 *   维护全局网络连接状态（isOnline），供 Service / UI 层消费。
 *   基于 @react-native-community/netinfo 订阅网络变化事件。
 *   **Phase B 新增：** 网络恢复时自动触发同步队列重放。
 *
 * 使用方式：
 *   - Service 层：`useNetworkStore.getState().isOnline` 同步读取
 *   - UI 层：`useNetworkStore((s) => s.isOnline)` 响应式订阅
 *
 * 设计原则：
 *   - 纯客户端状态，不存储业务数据（符合 Zustand 定位）
 *   - 初始化在 App 启动时调用一次 `initNetworkListener()`
 *   - 卸载时调用 `cleanupNetworkListener()` 释放订阅
 */

interface NetworkState {
  /** 当前是否有网络连接 */
  isOnline: boolean;
  /** 网络类型（wifi / cellular / none 等） */
  networkType: string | null;
  /** 是否正在重放同步队列 */
  isSyncing: boolean;
  /** 最近一次同步结果（供 UI 展示） */
  lastSyncResult: SyncReplayResult | null;
  /** 更新网络状态（内部使用） */
  _setNetworkState: (isOnline: boolean, networkType: string | null) => void;
  /** 更新同步状态（内部使用） */
  _setSyncState: (isSyncing: boolean, result?: SyncReplayResult) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  // 默认假设在线（避免 App 启动时误判为离线，导致首次请求直接走本地）
  isOnline: true,
  networkType: null,
  isSyncing: false,
  lastSyncResult: null,
  _setNetworkState: (isOnline, networkType) => set({ isOnline, networkType }),
  _setSyncState: (isSyncing, result) =>
    set({
      isSyncing,
      ...(result !== undefined ? { lastSyncResult: result } : {}),
    }),
}));

// ============================================================================
// 网络监听器管理
// ============================================================================

/** NetInfo 取消订阅函数 */
let unsubscribe: (() => void) | null = null;

/**
 * 触发同步队列重放（内部使用）
 *
 * Phase B 核心：网络从离线恢复为在线时调用。
 * 读取 sync_queue → 逐条重放 → 更新 Store 状态 → 打印结果日志。
 * 异步执行，不阻塞网络状态更新。
 */
const triggerSyncReplay = async () => {
  const { _setSyncState } = useNetworkStore.getState();

  try {
    _setSyncState(true);
    console.log("[Network] Triggering sync queue replay...");

    const result = await replaySyncQueue();
    _setSyncState(false, result);

    if (result.total > 0) {
      console.log(
        `[Network] Sync replay done: ${result.succeeded}/${result.total} succeeded`,
      );
    }
  } catch (error) {
    _setSyncState(false);
    console.error("[Network] Sync replay error:", error);
  }
};

/**
 * 初始化网络状态监听器
 *
 * 在 App 根组件 (_layout.tsx) 启动时调用一次。
 * 会立即获取当前网络状态，并持续监听后续变化。
 */
export const initNetworkListener = () => {
  if (unsubscribe) {
    // 防止重复订阅
    return;
  }

  const handleNetworkChange = (state: NetInfoState) => {
    // isConnected 可能为 null（未知），此时保守假设在线
    const isOnline = state.isConnected !== false;
    const networkType = state.type ?? null;

    const prev = useNetworkStore.getState().isOnline;
    useNetworkStore.getState()._setNetworkState(isOnline, networkType);

    // 仅在状态切换时打印日志，避免频繁输出
    if (prev !== isOnline) {
      console.log(
        `[Network] Status changed: ${isOnline ? "🟢 Online" : "🔴 Offline"} (${networkType})`,
      );

      // Phase B: 从离线恢复为在线时，自动触发同步队列重放
      if (isOnline && !prev) {
        triggerSyncReplay();
      }
    }
  };

  // NetInfo.addEventListener 会立即回调一次当前状态，然后持续监听
  unsubscribe = NetInfo.addEventListener(handleNetworkChange);
  console.log("[Network] Listener initialized");

  // Bug4 修复：App 启动时延迟检查待同步操作
  // 初始状态 isOnline=true + 首次回调 isOnline=true → 无 false→true 转换 → 不触发 sync
  // 因此需要在启动后独立检查一次，延迟 3s 确保 Auth Token 已加载
  setTimeout(() => {
    const { isOnline, isSyncing } = useNetworkStore.getState();
    if (isOnline && !isSyncing) {
      console.log("[Network] Startup sync check: online, triggering replay...");
      triggerSyncReplay();
    }
  }, 3000);
};

/**
 * 清理网络监听器（App 卸载时调用）
 */
export const cleanupNetworkListener = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
    console.log("[Network] Listener cleaned up");
  }
};
