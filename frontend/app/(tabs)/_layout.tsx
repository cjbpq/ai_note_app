import { Tabs } from "expo-router";
// 使用 Expo 自带的图标库
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";

export default function TabLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const outlineVariant = theme.colors.outlineVariant ?? theme.colors.outline;

  return (
    <Tabs
      screenOptions={{
        // 使用主题色，避免硬编码（为后续深色模式做准备）
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        // TabBar 背景/边框跟随主题，深色模式下不会刺眼
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: outlineVariant,
        },
        // 即使未来某些 Tab 打开 header，也确保 header 颜色跟随主题
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: { color: theme.colors.onSurface },
        headerShown: true, // 显示当前页面的标题栏
      }}
    >
      {/* 首页 Tab (添加笔记/拍照) */}
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab.home"),
          // MVP：页面内自行管理顶部区域，不使用顶层 Header
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="camera-outline" size={28} color={color} />
          ),
        }}
      />
      {/* 阅读 Tab (笔记列表) */}
      <Tabs.Screen
        name="read"
        options={{
          title: t("tab.read"),
          // MVP：阅读页使用页面内 Appbar（预留搜索入口），不使用顶层 Header
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="documents-outline" size={24} color={color} />
          ),
        }}
      />
      {/* 设置 Tab */}
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tab.settings"),
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings" size={24} color={color} />
          ),
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
