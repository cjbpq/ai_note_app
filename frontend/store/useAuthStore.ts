import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { STORAGE_KEYS } from "../constants/config";
import { User } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isRestoring: boolean;

  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  loadAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isRestoring: true,

  setAuth: async (user, token) => {
    // 状态更新
    set({ user, token, isAuthenticated: true });
    // 持久化存储 (Service层已处理Token，这里为了保险或冗余可以再存储UserInfo，
    // 但通常Token足矣，或者可以在这里存储User信息以便离线显示)
    // 简单起见，这里假设 Service 层主要负责 Token，Store 负责内存状态。
    // 如果需要持久化 User 对象，也可以在这里 setItem
    try {
      await AsyncStorage.setItem("auth_user", JSON.stringify(user));
    } catch (e) {
      console.warn("Failed to save user info to storage");
    }
  },

  clearAuth: async () => {
    set({ user: null, token: null, isAuthenticated: false });
    try {
      await AsyncStorage.removeItem("auth_user");
      // Token removal is usually handled by Service, but Store clear should also ensure UI consistency
      // The logout hook will call Service.logout which clears Token from storage.
    } catch (e) {
      console.warn("Failed to clear auth info from storage");
    }
  },

  loadAuth: async () => {
    set({ isRestoring: true });
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const userStr = await AsyncStorage.getItem("auth_user");

      if (token && userStr) {
        const user = JSON.parse(userStr) as User;
        set({ token, user, isAuthenticated: true });
      } else {
        set({ token: null, user: null, isAuthenticated: false });
      }
    } catch (e) {
      console.warn("Failed to load auth info");
      set({ token: null, user: null, isAuthenticated: false });
    } finally {
      set({ isRestoring: false });
    }
  },
}));
