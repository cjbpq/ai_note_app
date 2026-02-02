import { Tabs } from "expo-router";
// 使用 Expo 自带的图标库
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2f95dc", // 选中时的颜色
        headerShown: true, // 显示当前页面的标题栏
      }}
    >
      {/* 首页 Tab (添加笔记/拍照) */}
      <Tabs.Screen
        name="index"
        options={{
          title: t("tab.home"),
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
        }}
      />
    </Tabs>
  );
}
