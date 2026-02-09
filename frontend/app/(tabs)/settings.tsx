import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import {
  Avatar,
  Button,
  Dialog,
  Divider,
  List,
  Portal,
  Text,
  useTheme,
} from "react-native-paper";
import { ThemeModeToggle } from "../../components/common";
import { useAuth } from "../../hooks/useAuth";
import { useNotes } from "../../hooks/useNotes";
import { useAuthStore } from "../../store/useAuthStore";

/**
 * SettingsScreen - 个人中心页面
 *
 * 功能说明:
 * 1. 展示用户基本信息（头像、用户名、登录状态）
 * 2. 展示用户统计数据（笔记数、分类数、使用天数）
 * 3. 提供功能菜单入口
 * 4. 退出登录功能
 *
 * 数据流向:
 * - useAuthStore: 获取用户信息和登录状态
 * - useAuth: 提供 logout 方法
 * - useNotes: 获取笔记数量
 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  // =========================================================================
  // 1. 状态管理与 Hooks
  // =========================================================================
  const { user, isAuthenticated } = useAuthStore();
  const { logout } = useAuth();
  const { notes } = useNotes();

  // 退出登录确认弹窗状态
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);

  // =========================================================================
  // 2. 用户数据（从 Store 和 Hook 中获取）
  // =========================================================================
  // 笔记数量：从 useNotes hook 获取实际数据
  const notesCount = notes?.length ?? 0;
  // 分类数量：暂时使用固定值，后续可通过 API 获取
  const categoriesCount = 0;
  // 使用天数：暂时使用固定值，后续可根据注册日期计算
  const daysUsed = 0;

  // =========================================================================
  // 3. 事件处理
  // =========================================================================

  // 显示退出登录确认弹窗
  const handleLogoutPress = () => {
    setLogoutDialogVisible(true);
  };

  // 确认退出登录
  const handleLogoutConfirm = () => {
    setLogoutDialogVisible(false);
    logout(); // 调用 Hook 中的 logout 方法，会自动跳转到登录页
  };

  // 取消退出登录
  const handleLogoutCancel = () => {
    setLogoutDialogVisible(false);
  };

  // =========================================================================
  // 4. 渲染组件
  // =========================================================================
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* 顶部用户信息区域（带背景） */}
      <View
        style={[
          styles.headerContainer,
          { backgroundColor: theme.colors.primary },
        ]}
      >
        {/* 头像 */}
        <View style={styles.avatarContainer}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
          ) : (
            <Avatar.Icon
              size={80}
              icon="account"
              style={{ backgroundColor: theme.colors.surfaceVariant }}
            />
          )}
        </View>

        {/* 用户名和登录状态 */}
        <Text
          variant="titleLarge"
          style={[styles.userName, { color: theme.colors.onPrimary }]}
        >
          {isAuthenticated ? user?.username : t("settings.guest_user")}
        </Text>
        <Text
          variant="bodyMedium"
          style={[styles.loginStatus, { color: theme.colors.onPrimary }]}
        >
          {isAuthenticated ? user?.email : t("settings.not_logged_in")}
        </Text>
      </View>

      {/* 统计数据卡片 */}
      <View
        style={[
          styles.statsCard,
          {
            backgroundColor: theme.colors.surface,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        {/* 笔记数 */}
        <View style={styles.statItem}>
          <Text
            variant="headlineSmall"
            style={[styles.statNumber, { color: theme.colors.primary }]}
          >
            {notesCount}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("settings.stats.notes_count")}
          </Text>
        </View>

        {/* 分类数 */}
        <View style={styles.statItem}>
          <Text
            variant="headlineSmall"
            style={[styles.statNumber, { color: theme.colors.primary }]}
          >
            {categoriesCount}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("settings.stats.categories_count")}
          </Text>
        </View>

        {/* 使用天数 */}
        <View style={styles.statItem}>
          <Text
            variant="headlineSmall"
            style={[styles.statNumber, { color: theme.colors.primary }]}
          >
            {daysUsed}
          </Text>
          <Text
            variant="bodySmall"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {t("settings.stats.days_used")}
          </Text>
        </View>
      </View>

      {/* 功能菜单列表 */}
      <View
        style={[
          styles.menuCard,
          {
            backgroundColor: theme.colors.surface,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        {/* 我的笔记 */}
        <List.Item
          title={t("settings.menu.my_notes")}
          left={(props) => (
            <List.Icon
              {...props}
              icon={() => (
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={theme.colors.primary}
                />
              )}
            />
          )}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => {
            // TODO: 跳转到笔记列表页面
            console.log("Navigate to My Notes");
          }}
        />
        <Divider />

        {/* 设置 */}
        <List.Item
          title={t("settings.menu.settings")}
          left={(props) => (
            <List.Icon
              {...props}
              icon={() => (
                <Ionicons
                  name="settings-outline"
                  size={24}
                  color={theme.colors.primary}
                />
              )}
            />
          )}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => {
            // TODO: 跳转到设置详情页面
            console.log("Navigate to Settings Detail");
          }}
        />
        <Divider />

        {/* 帮助与反馈 */}
        <List.Item
          title={t("settings.menu.help_feedback")}
          left={(props) => (
            <List.Icon
              {...props}
              icon={() => (
                <Ionicons
                  name="help-circle-outline"
                  size={24}
                  color={theme.colors.primary}
                />
              )}
            />
          )}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => {
            // TODO: 跳转到帮助页面
            console.log("Navigate to Help");
          }}
        />
        <Divider />

        {/* 关于 */}
        <List.Item
          title={t("settings.menu.about")}
          left={(props) => (
            <List.Icon
              {...props}
              icon={() => (
                <Ionicons
                  name="information-circle-outline"
                  size={24}
                  color={theme.colors.primary}
                />
              )}
            />
          )}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => {
            // TODO: 跳转到关于页面
            console.log("Navigate to About");
          }}
        />
      </View>

      {/*
        主题模式切换（MVP）：放在“虚假导航栏”列表下方。
        组件内部通过 Hook 管理状态，后续可自由移植到任意页面/区域。
      */}
      <ThemeModeToggle />

      {/* 退出登录按钮（仅登录状态显示） */}
      {isAuthenticated && (
        <Button
          mode="outlined"
          onPress={handleLogoutPress}
          style={[styles.logoutButton, { borderColor: theme.colors.error }]}
          textColor={theme.colors.error}
        >
          {t("settings.logout_button")}
        </Button>
      )}

      {/* 退出登录确认弹窗 */}
      <Portal>
        <Dialog visible={logoutDialogVisible} onDismiss={handleLogoutCancel}>
          <Dialog.Title>{t("settings.logout_confirm_title")}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {t("settings.logout_confirm_message")}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleLogoutCancel}>{t("settings.cancel")}</Button>
            <Button
              onPress={handleLogoutConfirm}
              textColor={theme.colors.error}
            >
              {t("settings.confirm")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

// =========================================================================
// 样式定义
// =========================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  // 顶部用户信息区域样式
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  userName: {
    fontWeight: "600",
    marginBottom: 4,
  },
  loginStatus: {
    // 使用透明度表达“次要文本”，避免 hardcode rgba
    opacity: 0.8,
  },
  // 统计数据卡片样式
  statsCard: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: 16,
    marginTop: -20, // 向上偏移，与 header 重叠
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  // 功能菜单卡片样式
  menuCard: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  // 退出登录按钮样式
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 24,
  },
});
