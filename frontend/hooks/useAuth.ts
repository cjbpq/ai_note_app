import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import i18next from "../i18n";
import { authEventEmitter } from "../services/api";
import { authService } from "../services/authService";
import { clearLocalNewCategories } from "../services/categoryService";
import { clearLocalNotes, clearSyncQueue } from "../services/database";
import { searchHistoryService } from "../services/searchHistoryService";
import { syncService } from "../services/syncService";
import { useAuthStore } from "../store/useAuthStore";
import {
  AuthForm,
  ChangeEmailRequest,
  ChangePasswordRequest,
  EmailLoginRequest,
  EmailRegisterRequest,
  EmailSendCodeRequest,
  LoginResponse,
  ResetPasswordRequest,
  ServiceError,
} from "../types";
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
  const currentUserId = useAuthStore((state) => state.user?.id);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  /**
   * 清理与“当前账号”强绑定的数据缓存
   * - React Query: 避免跨账号复用同一份 query cache
   * - SQLite: 本地仅做临时缓存，切换账号必须清空避免串号
   */
  const clearAccountBoundCaches = useCallback(
    async (userId?: string) => {
      queryClient.removeQueries({ queryKey: ["notes"] });
      queryClient.removeQueries({ queryKey: ["note"] });
      queryClient.removeQueries({ queryKey: ["categories"] });
      queryClient.removeQueries({ queryKey: ["searchHistory"] });

      const clearResults = await Promise.allSettled([
        clearLocalNewCategories(userId),
        searchHistoryService.clearAll(userId),
        clearLocalNotes(),
        // Phase B: 清空离线同步队列（账号隔离，避免旧账号操作被新账号重放）
        clearSyncQueue(),
        // Phase C: 清除增量同步游标，避免账号间串用 since
        syncService.clearLastSyncTime(userId),
      ]);

      clearResults.forEach((item) => {
        if (item.status === "rejected") {
          console.warn(
            "[useAuth] Failed to clear account bound cache:",
            item.reason,
          );
        }
      });
    },
    [queryClient],
  );

  // ========================================
  // 监听认证过期事件
  // 当 Token 刷新失败时，自动跳转登录页
  // ========================================
  useEffect(() => {
    const handleAuthExpired = () => {
      console.log("[useAuth] Auth expired, redirecting to login...");
      const expiredUserId = currentUserId;
      clearAccountBoundCaches(expiredUserId)
        .finally(() => {
          clearAuth();
          router.replace("/login");
        })
        .catch(() => {
          // 忽略，最终流程在 finally 统一收口
        });
    };

    authEventEmitter.on("AUTH_EXPIRED", handleAuthExpired);

    return () => {
      authEventEmitter.off("AUTH_EXPIRED", handleAuthExpired);
    };
  }, [clearAccountBoundCaches, clearAuth, currentUserId, router]);

  // ========================================
  // 1. 登录 Mutation
  // ========================================
  const loginMutation = useMutation({
    mutationFn: (form: Pick<AuthForm, "username" | "password">) =>
      authService.login(form),
    onSuccess: async (data: LoginResponse) => {
      // 切换账号 / 重新登录：先清理旧账号缓存，再写入新用户状态
      await clearAccountBoundCaches(currentUserId);
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
  // 2. 注册 Mutation（旧版用户名注册，已由邮箱验证码注册替代）
  // @deprecated UI 层不再调用，保留以兼容 Mock 模式
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
  // 2.1 发送邮箱验证码 Mutation
  // ========================================
  const sendCodeMutation = useMutation({
    mutationFn: (req: EmailSendCodeRequest) => authService.sendEmailCode(req),
    onSuccess: () => {
      console.log("[useAuth] Email code sent successfully");
      showSuccess(i18next.t("auth.code_sent"));
    },
    onError: (error: Error) => {
      if (__DEV__) {
        console.log("[useAuth] Send code failed:", error.message);
      }
      showError(error.message || i18next.t("error.auth.sendCodeFailed"));
    },
  });

  // ========================================
  // 2.2 邮箱验证码注册 Mutation
  // ========================================
  const emailRegisterMutation = useMutation({
    mutationFn: (req: EmailRegisterRequest) => authService.emailRegister(req),
    onSuccess: (data) => {
      console.log("[useAuth] Email register success:", data.username);
      showSuccess(i18next.t("auth.register_success"));
    },
    onError: (error: Error) => {
      if (__DEV__) {
        console.log("[useAuth] Email register failed:", error.message);
      }
      showError(error.message || i18next.t("error.auth.registerFailed"));
    },
  });

  // ========================================
  // 2.3 邮箱验证码登录 Mutation
  // 登录成功后与密码登录一致：清理旧账号缓存 → 写入新用户状态
  // ========================================
  const emailLoginMutation = useMutation({
    mutationFn: (req: EmailLoginRequest) => authService.emailLogin(req),
    onSuccess: async (data: LoginResponse) => {
      await clearAccountBoundCaches(currentUserId);
      setAuth(data.user);
      console.log("[useAuth] Email login success:", data.user.username);
      showSuccess(i18next.t("auth.login_success"));
    },
    onError: (error: Error) => {
      if (__DEV__) {
        console.log("[useAuth] Email login failed:", error.message);
      }
      showError(error.message || i18next.t("error.auth.emailLoginFailed"));
    },
  });

  // ========================================
  // 3. 退出登录 Mutation
  // ========================================
  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: async () => {
      await clearAccountBoundCaches(currentUserId);
      clearAuth();
      router.replace("/login");
      console.log("[useAuth] Logout success");
      showInfo(i18next.t("auth.logout_success"));
    },
    onError: async (error: Error) => {
      // 即使退出失败，也清理本地状态
      await clearAccountBoundCaches(currentUserId);
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

  // ========================================
  // 5. 修改密码 Mutation（已登录用户，旧密码验证）
  // ========================================
  const changePasswordMutation = useMutation({
    mutationFn: (req: ChangePasswordRequest) => authService.changePassword(req),
    onSuccess: () => {
      console.log("[useAuth] Password changed successfully");
      showSuccess(i18next.t("account.change_password_success"));
    },
    onError: (error: Error) => {
      if (__DEV__) {
        console.log("[useAuth] Change password failed:", error.message);
      }
      showError(error.message || i18next.t("error.auth.changePasswordFailed"));
    },
  });

  // ========================================
  // 6. 重置密码 Mutation（邮箱验证码，不需要登录态）
  // ========================================
  const resetPasswordMutation = useMutation({
    mutationFn: (req: ResetPasswordRequest) => authService.resetPassword(req),
    onSuccess: () => {
      console.log("[useAuth] Password reset successfully");
      showSuccess(i18next.t("account.reset_password_success"));
    },
    onError: (error: Error) => {
      if (__DEV__) {
        console.log("[useAuth] Reset password failed:", error.message);
      }
      showError(error.message || i18next.t("error.auth.resetPasswordFailed"));
    },
  });

  // ========================================
  // 7. 修改绑定邮箱 Mutation
  // 成功后刷新用户信息，确保设置页显示新邮箱
  // ========================================
  const changeEmailMutation = useMutation({
    mutationFn: (req: ChangeEmailRequest) => authService.changeEmail(req),
    onSuccess: async (data) => {
      console.log("[useAuth] Email changed to:", data.email);
      // 刷新用户信息：从后端拉取最新用户数据并更新 Store + AsyncStorage
      try {
        const updatedUser = await authService.getCurrentUser();
        setAuth(updatedUser);
      } catch {
        // 如果获取失败，至少本地更新邮箱字段
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          setAuth({ ...currentUser, email: data.email });
        }
      }
      showSuccess(i18next.t("account.change_email_success"));
    },
    onError: (error: Error) => {
      if (__DEV__) {
        console.log("[useAuth] Change email failed:", error.message);
      }
      showError(error.message || i18next.t("error.auth.changeEmailFailed"));
    },
  });

  // ========================================
  // 8. 注销账户 Mutation
  // 调用后端 DELETE /auth/me 删除账号及所有数据，然后清理本地状态并跳转登录页
  // ========================================
  const deleteAccountMutation = useMutation({
    mutationFn: () => authService.deleteAccount(),
    onSuccess: async () => {
      console.log("[useAuth] Account deleted successfully");
      await clearAccountBoundCaches(currentUserId);
      clearAuth();
      router.replace("/login");
      showInfo(i18next.t("account.delete_account_success"));
    },
    onError: (error: Error) => {
      if (__DEV__) {
        console.log("[useAuth] Delete account failed:", error.message);
      }
      showError(error.message || i18next.t("error.auth.deleteAccountFailed"));
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
    sendCode: sendCodeMutation.mutate,
    sendCodeAsync: sendCodeMutation.mutateAsync,
    emailRegister: emailRegisterMutation.mutate,
    emailRegisterAsync: emailRegisterMutation.mutateAsync,
    emailLogin: emailLoginMutation.mutate,
    emailLoginAsync: emailLoginMutation.mutateAsync,
    changePassword: changePasswordMutation.mutate,
    changePasswordAsync: changePasswordMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutate,
    resetPasswordAsync: resetPasswordMutation.mutateAsync,
    changeEmail: changeEmailMutation.mutate,
    changeEmailAsync: changeEmailMutation.mutateAsync,
    deleteAccount: deleteAccountMutation.mutate,
    deleteAccountAsync: deleteAccountMutation.mutateAsync,

    // Login States
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    isLoginSuccess: loginMutation.isSuccess,

    // Register States（旧版，保留兼容）
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    isRegisterSuccess: registerMutation.isSuccess,

    // Send Code States
    isSendingCode: sendCodeMutation.isPending,
    sendCodeError: sendCodeMutation.error,

    // Email Register States
    isEmailRegistering: emailRegisterMutation.isPending,
    emailRegisterError: emailRegisterMutation.error,
    isEmailRegisterSuccess: emailRegisterMutation.isSuccess,

    // Email Login States
    isEmailLoggingIn: emailLoginMutation.isPending,
    emailLoginError: emailLoginMutation.error,
    isEmailLoginSuccess: emailLoginMutation.isSuccess,

    // Change Password States
    isChangingPassword: changePasswordMutation.isPending,
    changePasswordError: changePasswordMutation.error,
    isChangePasswordSuccess: changePasswordMutation.isSuccess,

    // Reset Password States
    isResettingPassword: resetPasswordMutation.isPending,
    resetPasswordError: resetPasswordMutation.error,
    isResetPasswordSuccess: resetPasswordMutation.isSuccess,

    // Change Email States
    isChangingEmail: changeEmailMutation.isPending,
    changeEmailError: changeEmailMutation.error,
    isChangeEmailSuccess: changeEmailMutation.isSuccess,

    // Delete Account States
    isDeletingAccount: deleteAccountMutation.isPending,
    deleteAccountError: deleteAccountMutation.error,

    // Logout States
    isLoggingOut: logoutMutation.isPending,
  };
};
