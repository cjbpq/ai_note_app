import { ENDPOINTS } from "../constants/config";
import i18next from "../i18n";
import {
  AuthForm,
  ChangeEmailRequest,
  ChangeEmailResponse,
  ChangePasswordRequest,
  EmailLoginRequest,
  EmailRegisterRequest,
  EmailSendCodeRequest,
  EmailSendCodeResponse,
  LoginResponse,
  MessageResponse,
  ResetPasswordRequest,
  TokenRefreshResponse,
  User,
  UserResponse,
} from "../types";
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

  // ========================================
  // 邮箱验证码相关接口
  // ========================================

  /**
   * 发送邮箱验证码
   * 向指定邮箱发送 6 位数字验证码，后端按 purpose 隔离
   * @param req - { email, purpose }
   * @returns { message, expires_in }（expires_in 单位秒，通常 300）
   */
  sendEmailCode: async (
    req: EmailSendCodeRequest,
  ): Promise<EmailSendCodeResponse> => {
    if (USE_MOCK) {
      console.log("[Mock API] sendEmailCode called", req);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { message: "验证码已发送", expires_in: 300 };
    }

    try {
      // 调试日志：确认请求体包含 email + purpose
      if (__DEV__) {
        console.log("[AuthService] sendEmailCode req:", JSON.stringify(req));
      }
      const response = await api.post<EmailSendCodeResponse>(
        ENDPOINTS.AUTH.EMAIL_SEND_CODE,
        req,
      );
      return response as unknown as EmailSendCodeResponse;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.auth.sendCodeFailed",
        statusMap: {
          400: {
            key: "error.auth.sendCodeFailed",
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
   * 邮箱验证码注册
   * 使用验证码 + 用户名 + 密码完成注册
   * 注意：注册成功返回 UserResponse（不含 Token），需用户手动登录
   * @param req - { email, code, username, password }
   * @returns UserResponse
   */
  emailRegister: async (req: EmailRegisterRequest): Promise<UserResponse> => {
    if (USE_MOCK) {
      console.log("[Mock API] emailRegister called", req);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return {
        username: req.username,
        email: req.email,
        id: "user-" + Math.random().toString(36).substr(2, 9),
        created_at: new Date().toISOString(),
      };
    }

    try {
      const response = await api.post<UserResponse>(
        ENDPOINTS.AUTH.EMAIL_REGISTER,
        req,
      );
      return response as unknown as UserResponse;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.auth.registerFailed",
        statusMap: {
          400: {
            // 后端 400 常见原因：验证码无效/过期
            key: "error.auth.invalidCode",
            toastType: "error",
          },
          409: {
            key: "error.auth.emailExists",
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

  /**   * 邮箱验证码登录
   * 使用邮箱 + 6 位验证码登录，后端返回 Token
   * 登录流程与密码登录一致：保存 Token → 获取用户信息 → 返回 LoginResponse
   * @param req - { email, code }
   * @returns LoginResponse
   */
  emailLogin: async (req: EmailLoginRequest): Promise<LoginResponse> => {
    if (USE_MOCK) {
      console.log("[Mock API] emailLogin called", req);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const mockUser: User = {
        id: "user-456",
        username: "email_user",
        email: req.email,
        avatar: "https://i.pravatar.cc/150?u=" + req.email,
      };
      const mockToken = "mock-email-login-token-" + Date.now();

      await tokenService.saveToken(mockToken);
      await tokenService.saveUser(mockUser);

      return { token: mockToken, user: mockUser };
    }

    try {
      // 调用邮箱验证码登录接口，后端返回 { access_token, token_type }
      const response = await api.post<{
        access_token: string;
        token_type: string;
      }>(ENDPOINTS.AUTH.EMAIL_LOGIN, req);

      const accessToken =
        (response as any).access_token || (response as any).token;

      if (!accessToken) {
        throw new Error("Email login response missing token");
      }

      // 保存 Token
      await tokenService.saveToken(accessToken, (response as any).expires_at);
      console.log(
        "[AuthService] Email login token saved:",
        accessToken.substring(0, 10) + "...",
      );

      // 获取用户信息（与密码登录复用相同流程）
      const user = await authService.getCurrentUser();
      await tokenService.saveUser(user);

      return { token: accessToken, user };
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.auth.emailLoginFailed",
        statusMap: {
          400: {
            // 验证码无效/过期
            key: "error.auth.invalidCode",
            toastType: "error",
          },
          401: {
            key: "error.auth.invalidCode",
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

  /**   * 刷新 Token
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

  // ========================================
  // 账户管理接口（修改密码 / 重置密码 / 修改邮箱）
  // ========================================

  /**
   * 修改密码（已登录用户，旧密码验证）
   * 需要 Bearer Token，后端校验旧密码通过后更新
   * @param req - { old_password, new_password }
   * @returns { message }
   */
  changePassword: async (
    req: ChangePasswordRequest,
  ): Promise<MessageResponse> => {
    if (USE_MOCK) {
      console.log("[Mock API] changePassword called", req);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { message: "密码修改成功" };
    }

    try {
      const response = await api.post<MessageResponse>(
        ENDPOINTS.AUTH.PASSWORD_CHANGE,
        req,
      );
      return response as unknown as MessageResponse;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.auth.changePasswordFailed",
        statusMap: {
          400: {
            // 旧密码错误
            key: "error.auth.wrongOldPassword",
            toastType: "error",
          },
          401: {
            key: "error.auth.unauthorized",
            toastType: "info",
            actionKey: "common.login",
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
   * 重置密码（通过邮箱验证码，不需要登录态）
   * 用于忘记旧密码场景，校验邮箱验证码后直接重置
   * @param req - { email, code, new_password }
   * @returns { message }
   */
  resetPassword: async (
    req: ResetPasswordRequest,
  ): Promise<MessageResponse> => {
    if (USE_MOCK) {
      console.log("[Mock API] resetPassword called", req);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { message: "密码重置成功" };
    }

    try {
      const response = await api.post<MessageResponse>(
        ENDPOINTS.AUTH.PASSWORD_RESET,
        req,
      );
      return response as unknown as MessageResponse;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.auth.resetPasswordFailed",
        statusMap: {
          400: {
            // 验证码无效/过期
            key: "error.auth.invalidCode",
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
   * 修改绑定邮箱（已登录用户）
   * 验证码发送到新邮箱，校验通过后更新账号绑定邮箱
   * @param req - { new_email, code }
   * @returns { message, email }
   */
  /**
   * 注销当前账号
   * DELETE /auth/me — 删除用户和相关数据（笔记、上传任务），返回确认信息
   * 调用成功后前端需清理本地状态并跳转登录页
   */
  deleteAccount: async (): Promise<MessageResponse> => {
    if (USE_MOCK) {
      console.log("[Mock API] deleteAccount called");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { message: "账号已注销" };
    }

    try {
      const response = await api.delete<MessageResponse>(ENDPOINTS.AUTH.ME);
      return (response as unknown as MessageResponse) ?? { message: "ok" };
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.auth.deleteAccountFailed",
        statusMap: {
          401: {
            key: "error.auth.unauthorized",
            toastType: "info",
            actionKey: "common.login",
          },
          403: {
            key: "error.auth.forbidden",
            toastType: "error",
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

  changeEmail: async (
    req: ChangeEmailRequest,
  ): Promise<ChangeEmailResponse> => {
    if (USE_MOCK) {
      console.log("[Mock API] changeEmail called", req);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { message: "邮箱修改成功", email: req.new_email };
    }

    try {
      const response = await api.post<ChangeEmailResponse>(
        ENDPOINTS.AUTH.EMAIL_CHANGE,
        req,
      );
      return response as unknown as ChangeEmailResponse;
    } catch (error) {
      throw parseServiceError(error, {
        fallbackKey: "error.auth.changeEmailFailed",
        statusMap: {
          400: {
            // 验证码无效/过期
            key: "error.auth.invalidCode",
            toastType: "error",
          },
          401: {
            key: "error.auth.unauthorized",
            toastType: "info",
            actionKey: "common.login",
          },
          409: {
            // 新邮箱已被其他账号绑定
            key: "error.auth.emailAlreadyBound",
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
};
