import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Href,
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { PaperProvider } from "react-native-paper";
import "../i18n"; // 初始化国际化配置
import { initDatabase } from "../services/database";
import { useAuthStore } from "../store/useAuthStore";

// 创建 React Query 客户端实例
const queryClient = new QueryClient();

export default function RootLayout() {
  const { isAuthenticated, isRestoring, loadAuth } = useAuthStore();
  const segments = useSegments() as string[];
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // App 启动时初始化数据库 和 恢复用户登录状态
  useEffect(() => {
    initDatabase();
    loadAuth(); // <--- 关键：恢复状态
  }, [loadAuth]);

  // 路由守卫：监听认证状态
  useEffect(() => {
    // 0. 确保导航树已挂载且身份恢复完成，否则不执行跳转逻辑
    if (!navigationState?.key || isRestoring) return;

    // 1. 获取当前所在的分组/页面
    // 如果 segments 为空，说明是根路径，通常默认为 (tabs) 或 index
    const inAuthGroup = segments[0] === "(tabs)" || segments.length === 0;

    // 2. 如果未登录且试图访问受保护区域 -> 踢回 login
    if (!isAuthenticated && inAuthGroup) {
      router.replace("/login" as Href);
    }
    // 3. 如果已登录且在 login 页面 -> 进 (tabs)
    else if (isAuthenticated && segments[0] === "login") {
      router.replace("/(tabs)" as Href);
    }
  }, [isAuthenticated, segments, navigationState?.key, isRestoring, router]);

  // 如果正在恢复状态，显示启动加载页，避免闪烁
  if (isRestoring || !navigationState?.key) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack>
      </PaperProvider>
    </QueryClientProvider>
  );
}
