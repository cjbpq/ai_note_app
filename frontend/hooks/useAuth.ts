import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import i18next from "../i18n";
import { authEventEmitter } from "../services/api";
import { authService } from "../services/authService";
import { clearLocalNewCategories } from "../services/categoryService";
import { clearLocalNotes } from "../services/database";
import { searchHistoryService } from "../services/searchHistoryService";
import { useAuthStore } from "../store/useAuthStore";
import { AuthForm, LoginResponse, ServiceError } from "../types";
import { useToast } from "./useToast";

/**
 * 身份认证 Hook
 *
 * 职责：
 * 1. 封装 Login, Register, Logout 的异步操作
 * 2. 自动同步认证状态到全局 Store
 * 3. 监听认证过期事件，自动处理跳转
 *
 * 注意：
 * - Token 操作由 Service 层统一处理
 * - Store 层只维护内存状态
 * - 401 刷新在 API 拦截器中自动完成（静默刷新）
 */
export const useAuth = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showError, showSuccess, showInfo } = useToast();
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  /**
   * 清理与“当前账号”强绑定的数据缓存
   * - React Query: 避免跨账号复用同一份 query cache
   * - SQLite: 本地仅做临时缓存，切换账号必须清空避免串号
   */
  const clearAccountBoundCaches = useCallback(() => {
    queryClient.removeQueries({ queryKey: ["notes"] });
    queryClient.removeQueries({ queryKey: ["note"] });
    queryClient.removeQueries({ queryKey: ["categories"] });
    queryClient.removeQueries({ queryKey: ["searchHistory"] });

    // 清理旧版本遗留的“全局共享 key”，避免升级后继续串号
    clearLocalNewCategories().catch((e) => {
      console.warn("[useAuth] Failed to clear legacy local categories:", e);
    });
    searchHistoryService.clearAll().catch((e) => {
      console.warn("[useAuth] Failed to clear legacy search history:", e);
    });

    clearLocalNotes().catch((e) => {
      console.warn("[useAuth] Failed to clear local notes cache:", e);
    });
  }, [queryClient]);

  // ========================================
  // 监听认证过期事件
  // 当 Token 刷新失败时，自动跳转登录页
  // ========================================
  useEffect(() => {
    const handleAuthExpired = () => {
      console.log("[useAuth] Auth expired, redirecting to login...");
      clearAccountBoundCaches();
      clearAuth();
      router.replace("/login");
    };

    authEventEmitter.on("AUTH_EXPIRED", handleAuthExpired);

    return () => {
      authEventEmitter.off("AUTH_EXPIRED", handleAuthExpired);
    };
  }, [clearAccountBoundCaches, clearAuth, router]);

  // ========================================
  // 1. 登录 Mutation
  // ========================================
  const loginMutation = useMutation({
    mutationFn: (form: Pick<AuthForm, "username" | "password">) =>
      authService.login(form),
    onSuccess: (data: LoginResponse) => {
      // 切换账号 / 重新登录：先清理旧账号缓存，再写入新用户状态
      clearAccountBoundCaches();
      // 登录成功，更新 Store（Token 已由 Service 保存）
      setAuth(data.user);
      console.log("[useAuth] Login success:", data.user.username);
      showSuccess(i18next.t("auth.login_success"));
    },
    onError: (error: Error) => {
      if (__DEV__) {
        console.log("[useAuth] Login failed:", error.message);
      }
      showError(error.message || i18next.t("error.auth.loginFailed"));
    },
  });

  // ========================================
  // 2. 注册 Mutation
  // ========================================
  const registerMutation = useMutation({
    mutationFn: (form: AuthForm) => authService.register(form),
    onSuccess: (data) => {
      console.log("[useAuth] Register success:", data);
      showSuccess(i18next.t("auth.register_success"));
    },
    onError: (error: Error) => {
      if (__DEV__) {
        console.log("[useAuth] Register failed:", error.message);
      }
      showError(error.message || i18next.t("error.auth.registerFailed"));
    },
  });

  // ========================================
  // 3. 退出登录 Mutation
  // ========================================
  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      clearAccountBoundCaches();
      clearAuth();
      router.replace("/login");
      console.log("[useAuth] Logout success");
      showInfo(i18next.t("auth.logout_success"));
    },
    onError: (error: Error) => {
      // 即使退出失败，也清理本地状态
      clearAccountBoundCaches();
      clearAuth();
      router.replace("/login");
      if (__DEV__) {
        console.log("[useAuth] Logout error:", error.message);
      }
      showError(i18next.t("error.auth.logoutFailed"));
    },
  });

  // ========================================
  // 4. 手动刷新 Token（可选，通常由拦截器自动处理）
  // ========================================
  const refreshMutation = useMutation({
    mutationFn: () => authService.refreshToken(),
    onSuccess: () => {
      console.log("[useAuth] Token refreshed manually");
    },
    onError: (error: Error) => {
      if (__DEV__) {
        console.log("[useAuth] Manual refresh failed:", error.message);
      }
      showInfo(
        error instanceof ServiceError
          ? error.message
          : i18next.t("error.auth.refreshFailed"),
      );
      clearAuth();
      router.replace("/login");
    },
  });

  return {
    // Actions
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    register: registerMutation.mutate,
    registerAsync: registerMutation.mutateAsync,
    logout: logoutMutation.mutate,
    logoutAsync: logoutMutation.mutateAsync,
    refreshToken: refreshMutation.mutate,

    // Login States
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    isLoginSuccess: loginMutation.isSuccess,

    // Register States
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    isRegisterSuccess: registerMutation.isSuccess,

    // Logout States
    isLoggingOut: logoutMutation.isPending,
  };
};
