import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Appbar,
  Button,
  Dialog,
  Divider,
  List,
  Paragraph,
  Portal,
  Switch,
  Text,
  useTheme,
} from "react-native-paper";
import { ThemeModeToggle } from "../components/common";
import { useAuth } from "../hooks/useAuth";
import { useAuthStore } from "../store/useAuthStore";

/**
 * UserSettingsScreen - 用户中心的设置详情页
 *
 * 职责：
 * 1. 展示账户信息（个人资料、邮箱、修改密码入口）
 * 2. 承载外观相关设置（主题切换、字体大小占位）
 * 3. 承载通知开关占位（MVP 展示）
 */
export default function UserSettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuthStore();
  const { deleteAccount, isDeletingAccount } = useAuth();

  // MVP：通知开关仅做本地展示状态，后续再接真实配置持久化
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  // 注销账户确认弹窗
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const disabledTextColor =
    theme.colors.onSurfaceDisabled ?? theme.colors.onSurfaceVariant;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <Appbar.Header
        mode="small"
        style={{ backgroundColor: theme.colors.surface }}
        elevated={false}
      >
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title={t("settings.detail.title")} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {t("settings.detail.account_section")}
          </Text>
          <Divider />

          <List.Item
            title={t("settings.detail.profile")}
            description={user?.username ?? t("settings.guest_user")}
            left={(props) => (
              <List.Icon
                {...props}
                icon={() => (
                  <Ionicons
                    name="person-outline"
                    size={22}
                    color={theme.colors.primary}
                  />
                )}
              />
            )}
          />
          <Divider />

          <List.Item
            title={t("settings.detail.email")}
            description={user?.email ?? t("settings.not_logged_in")}
            left={(props) => (
              <List.Icon
                {...props}
                icon={() => (
                  <Ionicons
                    name="mail-outline"
                    size={22}
                    color={theme.colors.primary}
                  />
                )}
              />
            )}
            right={() => (
              <Button
                mode="text"
                compact
                onPress={() => router.push("/change-email" as Href)}
                style={styles.changeEmailButton}
              >
                {t("settings.detail.change_email_button")}
              </Button>
            )}
          />
          <Divider />

          <List.Item
            title={t("settings.detail.change_password")}
            onPress={() => router.push("/change-password" as Href)}
            left={(props) => (
              <List.Icon
                {...props}
                icon={() => (
                  <Ionicons
                    name="lock-closed-outline"
                    size={22}
                    color={theme.colors.primary}
                  />
                )}
              />
            )}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {t("settings.detail.appearance_section")}
          </Text>
          <Divider />

          <View style={styles.themeBlock}>
            <ThemeModeToggle />
          </View>
          <Divider />

          <List.Item
            title={t("settings.detail.font_size")}
            description={t("settings.detail.coming_soon")}
            titleStyle={{ color: disabledTextColor }}
            descriptionStyle={{ color: disabledTextColor }}
            left={(props) => (
              <List.Icon
                {...props}
                icon={() => (
                  <Ionicons
                    name="text-outline"
                    size={22}
                    color={disabledTextColor}
                  />
                )}
              />
            )}
            right={() => (
              <Text style={[styles.trailingText, { color: disabledTextColor }]}>
                {t("settings.detail.font_size_value")}
              </Text>
            )}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.onSurfaceVariant },
            ]}
          >
            {t("settings.detail.notification_section")}
          </Text>
          <Divider />

          <List.Item
            title={t("settings.detail.push_notification")}
            description={t("settings.detail.coming_soon")}
            titleStyle={{ color: disabledTextColor }}
            descriptionStyle={{ color: disabledTextColor }}
            left={(props) => (
              <List.Icon
                {...props}
                icon={() => (
                  <Ionicons
                    name="notifications-outline"
                    size={22}
                    color={disabledTextColor}
                  />
                )}
              />
            )}
            right={() => (
              <Switch
                value={notificationEnabled}
                onValueChange={setNotificationEnabled}
                disabled
              />
            )}
          />
        </View>

        {/* 注销账户按钮 — 红色 outlined，位于页面最底部 */}
        <Button
          mode="outlined"
          onPress={() => setDeleteDialogVisible(true)}
          loading={isDeletingAccount}
          disabled={isDeletingAccount}
          textColor={theme.colors.error}
          style={[styles.deleteButton, { borderColor: theme.colors.error }]}
          icon="account-remove-outline"
        >
          {t("account.delete_account_button")}
        </Button>
      </ScrollView>

      {/* 注销账户确认弹窗 */}
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
        >
          <Dialog.Title>{t("account.delete_account_title")}</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{t("account.delete_account_message")}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>
              {t("account.delete_account_cancel")}
            </Button>
            <Button
              textColor={theme.colors.error}
              loading={isDeletingAccount}
              disabled={isDeletingAccount}
              onPress={() => {
                setDeleteDialogVisible(false);
                deleteAccount();
              }}
            >
              {t("account.delete_account_confirm")}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  card: {
    borderRadius: 18,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "500",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  themeBlock: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  trailingText: {
    alignSelf: "center",
    marginRight: 16,
    fontSize: 14,
  },
  changeEmailButton: {
    alignSelf: "center",
    marginRight: 4,
  },
  deleteButton: {
    marginTop: 8,
    borderWidth: 1,
  },
});
