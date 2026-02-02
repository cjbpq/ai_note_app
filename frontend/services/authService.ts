import AsyncStorage from "@react-native-async-storage/async-storage";
import { ENDPOINTS, STORAGE_KEYS } from "../constants/config";
import i18next from "../i18n";
import { AuthForm, LoginResponse } from "../types";
import api from "./api";

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

      return {
        token: "mock-jwt-token-" + Date.now(),
        user: {
          id: "user-123",
          username: form.username,
          email: "mock@example.com",
          avatar: "https://i.pravatar.cc/150?u=" + form.username,
        },
      };
    }

    const response = await api.post<LoginResponse>(ENDPOINTS.AUTH.LOGIN, form);

    // 自动保存 Token 到本地存储
    if (response) {
      // 注意：这里需要根据后端实际返回字段调整。
      // 假设返回结构是 { access_token: "...", token_type: "bearer" }
      // 需要将其映射到我们定义的 User 类型或单纯存储 Token
      const token = (response as any).access_token || (response as any).token;
      if (token) {
        await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
        console.log("Token saved to storage:", token.substring(0, 10) + "...");
      } else {
        console.warn("Login response did not contain a token:", response);
      }
    }

    return response as unknown as LoginResponse;
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

    const response = await api.post<{ message: string; user_id: string }>(
      ENDPOINTS.AUTH.REGISTER,
      form,
    );
    return response as unknown as { message: string; user_id: string };
  },

  /**
   * 退出登录
   * 清除本地存储的 Token
   */
  logout: async (): Promise<void> => {
    if (USE_MOCK) {
      console.log("[Mock API] logout called");
    }
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  },
};
