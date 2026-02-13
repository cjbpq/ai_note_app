import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/config";

/**
 * Token 服务层
 *
 * 职责：统一管理 Token 的读写操作
 * 设计原则：Store 层不直接操作 Token，所有 Token 操作通过此服务
 *
 * 后续生产环境升级方向：
 * 将 AsyncStorage 替换为 expo-secure-store，此处只需修改内部实现，
 * 对外接口保持不变，符合开闭原则
 */
export const tokenService = {
  /**
   * 保存 Token 及过期时间
   * @param token - JWT Token
   * @param expiresAt - 过期时间（ISO 8601 格式，可选）
   */
  saveToken: async (token: string, expiresAt?: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      if (expiresAt) {
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt);
      }
      console.log("[TokenService] Token saved successfully");
    } catch (error) {
      console.error("[TokenService] Failed to save token:", error);
      throw error;
    }
  },

  /**
   * 获取 Token
   * @returns Token 字符串或 null
   */
  getToken: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error("[TokenService] Failed to get token:", error);
      return null;
    }
  },

  /**
   * 获取 Token 过期时间
   * @returns 过期时间字符串或 null
   */
  getTokenExpiresAt: async (): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    } catch (error) {
      console.error("[TokenService] Failed to get token expiry:", error);
      return null;
    }
  },

  /**
   * 检查 Token 是否即将过期（5 分钟内）
   * 用于主动刷新策略（可选功能）
   */
  isTokenExpiringSoon: async (): Promise<boolean> => {
    try {
      const expiresAt = await AsyncStorage.getItem(
        STORAGE_KEYS.TOKEN_EXPIRES_AT,
      );
      if (!expiresAt) return false;

      const expiryTime = new Date(expiresAt).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      return expiryTime - now < fiveMinutes;
    } catch (error) {
      console.error("[TokenService] Failed to check token expiry:", error);
      return false;
    }
  },

  /**
   * 清除 Token 相关数据
   */
  clearToken: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.TOKEN_EXPIRES_AT,
      ]);
      console.log("[TokenService] Token cleared");
    } catch (error) {
      console.error("[TokenService] Failed to clear token:", error);
    }
  },

  /**
   * 保存用户信息
   * @param user - 用户对象
   */
  saveUser: async (user: object): Promise<void> => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(user));
      console.log("[TokenService] User saved successfully");
    } catch (error) {
      console.error("[TokenService] Failed to save user:", error);
    }
  },

  /**
   * 获取用户信息
   * @returns 用户对象或 null
   */
  getUser: async <T>(): Promise<T | null> => {
    try {
      const userStr = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_USER);
      return userStr ? (JSON.parse(userStr) as T) : null;
    } catch (error) {
      console.error("[TokenService] Failed to get user:", error);
      return null;
    }
  },

  /**
   * 清除所有认证数据（Token + User + 过期时间）
   */
  clearAll: async (): Promise<void> => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.AUTH_USER,
        STORAGE_KEYS.TOKEN_EXPIRES_AT,
      ]);
      console.log("[TokenService] All auth data cleared");
    } catch (error) {
      console.error("[TokenService] Failed to clear all auth data:", error);
    }
  },
};
