import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { authService } from "../services/authService";
import { useAuthStore } from "../store/useAuthStore";
import { AuthForm, LoginResponse } from "../types";

/**
 * 身份认证 Hook
 * 封装了 Login, Register, Logout 的逻辑
 * 并自动同步到全局 Store
 */
export const useAuth = () => {
  const router = useRouter(); // Expo Router 导航
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  // 1. 登录 Mutation
  const loginMutation = useMutation({
    mutationFn: (form: Pick<AuthForm, "username" | "password">) =>
      authService.login(form),
    onSuccess: (data: LoginResponse) => {
      // 登录成功，更新 Global Store
      setAuth(data.user, data.token);
      // 可选：导航跳转通常在 UI 层处理，或者在这里统一处理
      // router.replace("/(tabs)");
    },
    onError: (error: Error) => {
      // 错误由 UI 层展示
      console.error("Login failed:", error.message);
    },
  });

  // 2. 注册 Mutation
  const registerMutation = useMutation({
    mutationFn: (form: AuthForm) => authService.register(form),
    onSuccess: (data) => {
      console.log("Register success", data);
    },
    onError: (error: Error) => {
      console.error("Register failed:", error.message);
    },
  });

  // 3. 退出登录 Mutation
  // Logout 通常不一定需要 Mutation (如果是纯同步清除本地)，
  // 但如果服务端也有 logout 接口，用 mutation 更好。目前 authService.logout 是 async 的。
  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      clearAuth();
      // 退出后可能需要重置路由到登录页，或者由 Root Layout 监听 isAuthenticated 状态自动跳转
      router.replace("/");
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

    // States (Expose derived states for UI feedback)
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    isLoginSuccess: loginMutation.isSuccess,

    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    isRegisterSuccess: registerMutation.isSuccess,
  };
};
