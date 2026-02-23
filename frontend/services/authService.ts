import { ENDPOINTS } from "../constants/config";
import i18next from "../i18n";
import { AuthForm, LoginResponse, TokenRefreshResponse, User } from "../types";
import api from "./api";
import { parseServiceError } from "./errorService";
import { tokenService } from "./tokenService";

const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === "true";

export const authService = {
  /**
   * 用户登录
   * @param form - 登录表单 {username, password}
   * @returns 登录响应（包含 token 和用户信息）
   */
  login: async (
    form: Pick<AuthForm, "username" | "password">,
  ): Promise<LoginResponse> => {
    if (USE_MOCK) {
      console.log("[Mock API] login called", form);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 模拟验证：简单判断非空
      if (!form.username || !form.password) {
        throw new Error(i18next.t("service.auth_missing_fields"));
      }

      const mockUser: User = {
        id: "user-123",
        username: form.username,
        email: "mock@example.com",
        avatar: "https://i.pravatar.cc/150?u=" + form.username,
      };
      const mockToken = "mock-jwt-token-" + Date.now();

      // 使用 tokenService 保存认证数据
      await tokenService.saveToken(mockToken);
      await tokenService.saveUser(mockUser);

      return { token: mockToken, user: mockUser };
    }

    // 真实 API 调用
    try {
      const response = await api.post<{
        access_token: string;
        token_type: string;
        expires_in?: number;
        expires_at?: string;
      }>(ENDPOINTS.AUTH.LOGIN, form);

      // 后端返回 { access_token, token_type }，需要提取 Token
      const accessToken =
        (response as any).access_token || (response as any).token;

      if (!accessToken) {
        throw new Error("Login response missing token");
      }

      // 使用 tokenService 保存 Token
      await tokenService.saveToken(accessToken, (response as any).expires_at);
      console.log(
        "[AuthService] Token saved:",
        accessToken.substring(0, 10) + "...",
      );

      // 获取用户信息（如果登录接口不返回用户信息，需要单独调用 /auth/me）
      const user = await authService.getCurrentUser();
      await tokenService.saveUser(user);

      return { token: accessToken, user };
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.auth.loginFailed",
        statusMap: {
          401: {
            key: "error.auth.invalidCredentials",
            toastType: "error",
          },
          422: {
            key: "error.validation.invalid",
            toastType: "warning",
          },
          429: {
            key: "error.common.rateLimited",
            toastType: "warning",
            retryable: true,
          },
        },
      });
    }
  },

  /**
   * 获取当前用户信息
   * 需要已登录状态（Token 有效）
   */
  getCurrentUser: async (): Promise<User> => {
    if (USE_MOCK) {
      const savedUser = await tokenService.getUser<User>();
      if (savedUser) return savedUser;

      return {
        id: "user-123",
        username: "mockuser",
        email: "mock@example.com",
      };
    }

    try {
      const response = await api.get<User>(ENDPOINTS.AUTH.ME);
      return response as unknown as User;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.auth.fetchUserFailed",
        statusMap: {
          401: {
            key: "error.auth.unauthorized",
            toastType: "info",
            actionKey: "common.login",
          },
        },
      });
    }
  },

  /**
   * 用户注册
   * @param form - 注册表单 {username, email, password}
   * @returns 注册响应
   */
  register: async (
    form: AuthForm,
  ): Promise<{ message: string; user_id: string }> => {
    if (USE_MOCK) {
      console.log("[Mock API] register called", form);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return {
        message: "Registration successful",
        user_id: "user-" + Math.random().toString(36).substr(2, 9),
      };
    }

    try {
      const response = await api.post<{ message: string; user_id: string }>(
        ENDPOINTS.AUTH.REGISTER,
        form,
      );
      return response as unknown as { message: string; user_id: string };
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.auth.registerFailed",
        statusMap: {
          400: {
            // 临时兜底：后端校验标准未稳定时，将常见重复用户名场景友好提示
            key: "error.auth.userExists",
            toastType: "warning",
          },
          409: {
            key: "error.auth.userExists",
            toastType: "warning",
          },
          422: {
            key: "error.validation.invalid",
            toastType: "warning",
          },
          429: {
            key: "error.common.rateLimited",
            toastType: "warning",
            retryable: true,
          },
        },
      });
    }
  },

  /**
   * 刷新 Token
   * 使用当前有效 Token 获取新 Token
   * 注意：通常由 API 拦截器自动调用，无需手动调用
   */
  refreshToken: async (): Promise<TokenRefreshResponse> => {
    if (USE_MOCK) {
      console.log("[Mock API] refresh token called");
      await new Promise((resolve) => setTimeout(resolve, 500));

      const newToken = "mock-refreshed-token-" + Date.now();
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      await tokenService.saveToken(newToken, expiresAt);

      return {
        access_token: newToken,
        token_type: "bearer",
        expires_in: 604800,
        expires_at: expiresAt,
      };
    }

    try {
      const response = await api.post<TokenRefreshResponse>(
        ENDPOINTS.AUTH.REFRESH,
      );
      const data = response as unknown as TokenRefreshResponse;

      // 保存新 Token
      await tokenService.saveToken(data.access_token, data.expires_at);

      return data;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.auth.refreshFailed",
        statusMap: {
          401: {
            key: "error.auth.unauthorized",
            toastType: "info",
            actionKey: "common.login",
          },
        },
      });
    }
  },

  /**
   * 退出登录
   * 清除所有本地认证数据
   */
  logout: async (): Promise<void> => {
    if (USE_MOCK) {
      console.log("[Mock API] logout called");
    }
    // 统一通过 tokenService 清理所有认证数据
    await tokenService.clearAll();
  },

  /**
   * 检查是否已登录
   * 仅检查本地 Token 是否存在
   */
  isLoggedIn: async (): Promise<boolean> => {
    const token = await tokenService.getToken();
    return !!token;
  },
};
