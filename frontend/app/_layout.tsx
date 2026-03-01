import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Href,
  Stack,
  useRootNavigationState,
  useRouter,
  useSegments,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import { GlobalSnackbar, OfflineBanner } from "../components/common";
import { useAndroidSystemNavigationBar } from "../hooks/useAndroidSystemNavigationBar";
import { useThemeMode } from "../hooks/useThemeMode";
import "../i18n"; // 初始化国际化配置
import { authEventEmitter } from "../services/api";
import {
  clearLocalNotes,
  clearSyncQueue,
  initDatabase,
} from "../services/database";
import { useAuthStore } from "../store/useAuthStore";
import {
  cleanupNetworkListener,
  initNetworkListener,
  useNetworkStore,
} from "../store/useNetworkStore";

// 创建 React Query 客户端实例
const queryClient = new QueryClient();

export default function RootLayout() {
  const { isAuthenticated, isRestoring, loadAuth, clearAuth } = useAuthStore();
  const segments = useSegments() as string[];
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // 全局主题模式（MVP）：使用 Paper 内置 MD3 Light/Dark
  const { isDark } = useThemeMode();
  const paperTheme = isDark ? MD3DarkTheme : MD3LightTheme;

  // Android 系统导航栏跟随主题，避免 auth 页面出现浅色底栏
  useAndroidSystemNavigationBar(isDark, paperTheme.colors.background);

  // ========================================
  // App 启动初始化
  // ========================================
  useEffect(() => {
    initDatabase();
    loadAuth(); // 恢复认证状态
    initNetworkListener(); // 启动网络状态监听

    return () => {
      cleanupNetworkListener(); // 清理网络监听器
    };
  }, [loadAuth]);

  // ========================================
  // 监听认证过期事件（全局级别）
  // 当 Token 刷新失败时，自动清理状态并跳转登录页
  // ========================================
  useEffect(() => {
    const handleAuthExpired = () => {
      console.log(
        "[RootLayout] Auth expired, clearing state and redirecting...",
      );

      // 关键：认证失效时清理账号绑定缓存，避免仍能看到旧账号笔记
      queryClient.removeQueries({ queryKey: ["notes"] });
      queryClient.removeQueries({ queryKey: ["note"] });
      clearLocalNotes().catch(() => {
        // ignore
      });
      // Phase B: 同步队列也需清理（账号隔离）
      clearSyncQueue().catch(() => {
        // ignore
      });

      clearAuth();
      // 确保导航器已准备好再跳转
      if (navigationState?.key) {
        router.replace("/login" as Href);
      }
    };

    authEventEmitter.on("AUTH_EXPIRED", handleAuthExpired);
    return () => {
      authEventEmitter.off("AUTH_EXPIRED", handleAuthExpired);
    };
  }, [clearAuth, router, navigationState?.key]);

  // ========================================
  // Phase B: 同步重放完成后刷新 React Query 缓存
  // 当 sync engine 完成离线操作重放后，需要刷新列表/详情缓存
  // 以确保 UI 显示服务端最新状态
  // ========================================
  const lastSyncResult = useNetworkStore((s) => s.lastSyncResult);
  useEffect(() => {
    if (lastSyncResult && lastSyncResult.succeeded > 0) {
      console.log(
        "[RootLayout] Sync replay completed, invalidating query caches...",
      );
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["note"] });
    }
  }, [lastSyncResult]);

  // ========================================
  // 路由守卫：监听认证状态变化
  // ========================================
  useEffect(() => {
    // 确保导航树已挂载且身份恢复完成
    if (!navigationState?.key || isRestoring) return;

    const inAuthGroup = segments[0] === "(tabs)" || segments.length === 0;

    // 未登录且试图访问受保护区域 -> 跳转登录页
    if (!isAuthenticated && inAuthGroup) {
      router.replace("/login" as Href);
    }
    // 已登录且在登录页 -> 跳转主页
    else if (isAuthenticated && segments[0] === "login") {
      router.replace("/(tabs)" as Href);
    }
  }, [isAuthenticated, segments, navigationState?.key, isRestoring, router]);

  // 加载中显示
  if (isRestoring || !navigationState?.key) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={paperTheme}>
        {/* 状态栏随主题切换，避免深色模式下图标不清晰 */}
        <StatusBar
          style={isDark ? "light" : "dark"}
          backgroundColor={paperTheme.colors.background}
          animated
        />
        <Stack
          // 顶部 Header（例如详情页 note/[id]）跟随主题，避免深色模式下过亮/过暗
          screenOptions={{
            headerStyle: { backgroundColor: paperTheme.colors.surface },
            headerTintColor: paperTheme.colors.onSurface,
            headerTitleStyle: { color: paperTheme.colors.onSurface },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: paperTheme.colors.background },
          }}
        >
          {/* Tab 导航组 - 主要页面 */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* 登录页面 */}
          <Stack.Screen
            name="login"
            options={{
              headerShown: false,
              animation: "fade",
              animationDuration: 200,
            }}
          />
          {/* 注册页面 */}
          <Stack.Screen
            name="register"
            options={{
              headerShown: false,
              animation: "fade",
              animationDuration: 200,
            }}
          />
          {/* 笔记详情页面 - 使用动态路由 */}
          <Stack.Screen
            name="note/[id]"
            options={{
              headerShown: true,
              presentation: "card",
              gestureEnabled: true,
            }}
          />
          {/* 搜索页面 - 全屏 push，无底部 Tab */}
          <Stack.Screen
            name="search"
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
          {/* 收藏列表页 - 全屏 push，与搜索页同级 */}
          <Stack.Screen
            name="favorites"
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
          {/* 用户设置详情页 - 页面内已自带 Appbar，隐藏 Stack Header 避免双顶栏 */}
          <Stack.Screen
            name="user-settings"
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
          {/* 帮助与反馈页 */}
          <Stack.Screen
            name="help"
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
          {/* 关于页 */}
          <Stack.Screen
            name="about"
            options={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
        </Stack>
        {/* 离线状态横幅 - 全局覆盖，网络断开时顶部显示提示 */}
        <OfflineBanner />
        {/* 全局 Snackbar 组件 - 放在 Stack 外部确保覆盖所有页面 */}
        <GlobalSnackbar />
      </PaperProvider>
    </QueryClientProvider>
  );
}
