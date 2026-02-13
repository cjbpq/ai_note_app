import { create } from "zustand";
import { authEventEmitter } from "../services/api";
import { tokenService } from "../services/tokenService";
import { User } from "../types";

/**
 * 认证状态接口
 *
 * 设计说明：
 * - Store 层只管理内存中的认证状态
 * - Token 的持久化操作统一由 tokenService 处理
 * - 通过事件监听响应认证过期
 */
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isRestoring: boolean;

  // Actions
  setAuth: (user: User) => void;
  clearAuth: () => void;
  loadAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  // ========================================
  // 监听认证过期事件
  // 当 API 层检测到 Token 刷新失败时触发
  // ========================================
  authEventEmitter.on("AUTH_EXPIRED", () => {
    console.log("[AuthStore] Received AUTH_EXPIRED event, clearing state");
    set({ user: null, isAuthenticated: false });
  });

  return {
    user: null,
    isAuthenticated: false,
    isRestoring: true,

    /**
     * 设置认证状态（登录成功后调用）
     * 注意：Token 保存由 authService 处理，Store 只更新内存状态
     */
    setAuth: (user: User) => {
      set({ user, isAuthenticated: true });
      // 异步保存用户信息（不阻塞 UI）
      tokenService.saveUser(user).catch((e) => {
        console.warn("[AuthStore] Failed to persist user:", e);
      });
    },

    /**
     * 清除认证状态（退出登录时调用）
     * 注意：Token 清理由 authService.logout 统一处理
     */
    clearAuth: () => {
      set({ user: null, isAuthenticated: false });
    },

    /**
     * 恢复认证状态（App 启动时调用）
     * 从本地存储读取 Token 和用户信息
     */
    loadAuth: async () => {
      set({ isRestoring: true });
      try {
        // 从 tokenService 读取
        const token = await tokenService.getToken();
        const user = await tokenService.getUser<User>();

        if (token && user) {
          set({ user, isAuthenticated: true });
          console.log("[AuthStore] Auth restored for user:", user.username);
        } else {
          set({ user: null, isAuthenticated: false });
          console.log("[AuthStore] No saved auth found");
        }
      } catch (e) {
        console.warn("[AuthStore] Failed to load auth:", e);
        set({ user: null, isAuthenticated: false });
      } finally {
        set({ isRestoring: false });
      }
    },
  };
});
