/**
 * 离线状态横幅组件
 *
 * 功能：
 *   当网络断开时，在页面顶部显示一条醒目的横幅提示用户当前处于离线状态。
 *   网络恢复后自动隐藏并短暂显示"已恢复"提示。
 *   Phase B 新增：显示待同步操作数量 + 同步重放进度提示。
 *
 * 数据来源：
 *   useNetworkStore.isOnline — 由 @react-native-community/netinfo 驱动
 *   useNetworkStore.isSyncing / lastSyncResult — 同步重放状态
 *
 * 放置位置：
 *   _layout.tsx 的 Stack 下方（全局覆盖所有页面）
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Animated, StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { getPendingSyncCount } from "../../services/database";
import { useNetworkStore } from "../../store/useNetworkStore";

export default function OfflineBanner() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const isSyncing = useNetworkStore((s) => s.isSyncing);
  const lastSyncResult = useNetworkStore((s) => s.lastSyncResult);

  // 跟踪"刚恢复在线"的短暂提示
  const [showBackOnline, setShowBackOnline] = useState(false);
  // Phase B: 待同步操作数量（离线时显示在横幅上）
  const [pendingCount, setPendingCount] = useState(0);
  const prevOnline = useRef(isOnline);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 检测从离线 → 在线的切换
    if (!prevOnline.current && isOnline) {
      setShowBackOnline(true);
      // 2 秒后隐藏"已恢复"提示
      const timer = setTimeout(() => setShowBackOnline(false), 2000);
      return () => clearTimeout(timer);
    }
    prevOnline.current = isOnline;
  }, [isOnline]);

  // Phase B: 离线时定期刷新待同步数量
  useEffect(() => {
    if (isOnline) {
      setPendingCount(0);
      return;
    }
    // 立即获取一次
    getPendingSyncCount()
      .then(setPendingCount)
      .catch(() => setPendingCount(0));
  }, [isOnline, lastSyncResult]);

  // 控制横幅滑入/滑出动画
  const shouldShow = !isOnline || showBackOnline || isSyncing;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: shouldShow ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [shouldShow, slideAnim]);

  // 完全隐藏时不渲染（节省性能）
  if (isOnline && !showBackOnline && !isSyncing) return null;

  // 确定横幅 UI 状态：同步中 > 恢复在线 > 离线
  let backgroundColor: string;
  let textColor: string;
  let iconName: keyof typeof Ionicons.glyphMap;
  let message: string;

  if (isSyncing) {
    // 正在同步重放
    backgroundColor = theme.colors.tertiaryContainer;
    textColor = theme.colors.onTertiaryContainer;
    iconName = "sync-outline";
    message = t("network.syncing");
  } else if (isOnline) {
    // 刚恢复在线
    backgroundColor = theme.colors.primaryContainer;
    textColor = theme.colors.onPrimaryContainer;
    iconName = "cloud-done-outline";
    message = t("network.back_online");
  } else {
    // 离线状态
    backgroundColor = theme.colors.errorContainer;
    textColor = theme.colors.onErrorContainer;
    iconName = "cloud-offline-outline";
    // 有待同步操作时附加数量提示
    message =
      pendingCount > 0
        ? t("network.offline_with_pending", { count: pendingCount })
        : t("network.offline_banner");
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor,
          opacity: slideAnim,
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-40, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={iconName} size={16} color={textColor} />
        <Text variant="labelSmall" style={[styles.text, { color: textColor }]}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 16,
    gap: 6,
  },
  text: {
    fontWeight: "600",
  },
});
