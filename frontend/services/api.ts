import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { APP_CONFIG, STORAGE_KEYS } from "../constants/config";

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

// 请求拦截器：可以在这里统一添加 Token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 调试日志：打印每个请求的完整 URL
    console.log(
      "[API Request]",
      config.method?.toUpperCase(),
      config.baseURL,
      config.url,
    );

    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error fetching token from storage:", error);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// 响应拦截器：可以在这里统一处理 401, 500 等错误
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data; // 直接返回 data 部分，简化调用
  },
  (error: AxiosError) => {
    // 可以在这里打印日志或触发全局提示
    console.error("API Error:", error.response?.status, error.message);

    // 401 处理：仅记录或提示，不强制跳转，交由 UI 层处理
    if (error.response?.status === 401) {
      // 可以在这里派发一个全局事件或者只是 console.warn
      // 到后面可以使用 event emitter 或者 zustand store 来通知 UI 显示 Toast
      console.warn("Token expired or unauthorized.");
    }

    return Promise.reject(error);
  },
);

export default api;
