import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { APP_CONFIG, ENDPOINTS } from "../constants/config";
import { TokenRefreshResponse } from "../types";
import { tokenService } from "./tokenService";

// ============================================================================
// 调试日志：验证环境变量是否正确加载
// 如果看到的 baseURL 不是你 .env 中配置的地址，说明环境变量没加载成功
// ============================================================================
console.log("[API Service] 环境变量检查:");
console.log("  EXPO_PUBLIC_API_URL =", process.env.EXPO_PUBLIC_API_URL);
console.log("  APP_CONFIG.API_BASE_URL =", APP_CONFIG.API_BASE_URL);

const api = axios.create({
  baseURL: APP_CONFIG.API_BASE_URL,
  timeout: APP_CONFIG.REQUEST_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================================================
// 认证事件发射器
// 用于通知 Store 层认证状态变化（避免循环依赖）
// ============================================================================
type AuthEventType = "AUTH_EXPIRED" | "TOKEN_REFRESHED";
type AuthEventCallback = () => void;

class AuthEventEmitter {
  private listeners: Map<AuthEventType, AuthEventCallback[]> = new Map();

  /** 订阅事件 */
  on(event: AuthEventType, callback: AuthEventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  /** 取消订阅 */
  off(event: AuthEventType, callback: AuthEventCallback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /** 触发事件 */
  emit(event: AuthEventType) {
    console.log(`[AuthEventEmitter] Emitting ${event}`);
    this.listeners.get(event)?.forEach((callback) => callback());
  }
}

export const authEventEmitter = new AuthEventEmitter();

// ============================================================================
// Token 刷新状态管理
// 防止多个并发请求同时触发刷新
// ============================================================================
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

/**
 * 订阅 Token 刷新完成事件
 * 当刷新完成后，所有等待的请求会用新 Token 重试
 */
const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

/**
 * 通知所有订阅者刷新完成
 */
const onTokenRefreshed = (newToken: string) => {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
};

/**
 * 通知所有订阅者刷新失败
 */
const onRefreshFailed = () => {
  refreshSubscribers = [];
};

// ============================================================================
// 请求拦截器：自动附加 Token
// ============================================================================
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    console.log(
      "[API Request]",
      config.method?.toUpperCase(),
      config.baseURL,
      config.url,
    );

    try {
      // 使用 tokenService 统一获取 Token
      const token = await tokenService.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      if (__DEV__) {
        console.warn("[API] Error fetching token:", error);
      }
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// ============================================================================
// 响应拦截器：处理 401 自动刷新
// ============================================================================
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data; // 直接返回 data 部分，简化调用
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (__DEV__) {
      console.log("[API Error]", error.response?.status, error.message);
    }

    // ========================================
    // 401 处理：尝试刷新 Token
    // ========================================
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      const requestUrl = originalRequest.url ?? "";

      // 登录/注册接口返回 401 时，不应触发 refresh
      if (
        requestUrl.includes(ENDPOINTS.AUTH.LOGIN) ||
        requestUrl.includes(ENDPOINTS.AUTH.REGISTER)
      ) {
        return Promise.reject(error);
      }

      // 如果是刷新接口本身返回 401，说明 Token 完全失效，需要重新登录
      if (requestUrl.includes(ENDPOINTS.AUTH.REFRESH)) {
        console.warn("[API] Refresh token failed, need re-login");
        await tokenService.clearAll();
        authEventEmitter.emit("AUTH_EXPIRED");
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      // 如果已经在刷新中，将请求加入等待队列
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          });
          // 超时处理，防止无限等待
          setTimeout(() => reject(error), 10000);
        });
      }

      isRefreshing = true;

      try {
        console.log("[API] Attempting to refresh token...");

        // 获取当前 Token 用于刷新
        const currentToken = await tokenService.getToken();
        if (!currentToken) {
          // 无 token 说明无法刷新，直接按原始 401 处理
          onRefreshFailed();
          isRefreshing = false;
          authEventEmitter.emit("AUTH_EXPIRED");
          return Promise.reject(error);
        }

        // 直接用 axios 调用刷新接口，避免拦截器循环
        const refreshResponse = await axios.post<TokenRefreshResponse>(
          `${APP_CONFIG.API_BASE_URL}${ENDPOINTS.AUTH.REFRESH}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${currentToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        const { access_token, expires_at } = refreshResponse.data;

        // 保存新 Token
        await tokenService.saveToken(access_token, expires_at);
        console.log("[API] Token refreshed successfully");

        // 通知所有等待的请求
        onTokenRefreshed(access_token);
        isRefreshing = false;

        // 触发刷新成功事件
        authEventEmitter.emit("TOKEN_REFRESHED");

        // 重试原请求
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        if (__DEV__) {
          console.warn("[API] Token refresh failed:", refreshError);
        }
        onRefreshFailed();
        isRefreshing = false;

        // 刷新失败，清除所有认证数据
        await tokenService.clearAll();
        // 触发认证过期事件，通知 UI 层处理（如跳转登录页）
        authEventEmitter.emit("AUTH_EXPIRED");

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
