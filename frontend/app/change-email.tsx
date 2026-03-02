import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Appbar,
  Button,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { APP_CONFIG } from "../constants/config";
import { useAuth } from "../hooks/useAuth";
import { useAuthStore } from "../store/useAuthStore";

// 简易邮箱格式校验
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ChangeEmailScreen - 修改绑定邮箱页面
 *
 * 流程：
 * 1. 用户输入新邮箱地址
 * 2. 点击"发送验证码"→ 验证码发送到新邮箱
 * 3. 输入验证码后提交 → 后端校验通过后更新绑定邮箱
 * 4. 成功后自动刷新用户信息（Store + AsyncStorage）并返回上一页
 *
 * 架构落点：
 * - UI 层仅负责表单渲染和校验
 * - 通过 useAuth Hook 调用 changeEmail / sendCode
 * - 成功后 Hook 层自动刷新用户信息到 Store
 */
export default function ChangeEmailScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { changeEmail, sendCode, isChangingEmail, isSendingCode } = useAuth();

  // ========================================
  // 表单状态
  // ========================================
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const initialEmailRef = useRef((user?.email ?? "").trim().toLowerCase());

  // 验证码倒计时
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ========================================
  // 验证码倒计时逻辑
  // ========================================
  const startCooldown = useCallback(() => {
    setCooldown(APP_CONFIG.VALIDATION.VERIFY_CODE_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // 清理倒计时
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // ========================================
  // 表单校验
  // ========================================
  const isEmailValid = EMAIL_REGEX.test(newEmail);
  const isSameEmail = newEmail.trim().toLowerCase() === initialEmailRef.current;
  const isCodeValid =
    emailCode.length === APP_CONFIG.VALIDATION.VERIFY_CODE_LENGTH;

  const canSendCode = isEmailValid && !isSameEmail && cooldown === 0;
  const canSubmit = isEmailValid && !isSameEmail && isCodeValid;

  // ========================================
  // 发送验证码（发送到新邮箱）
  // ========================================
  const handleSendCode = useCallback(() => {
    if (!canSendCode || isSendingCode) return;
    sendCode(
      { email: newEmail.trim(), purpose: "change_email" },
      { onSuccess: () => startCooldown() },
    );
  }, [canSendCode, isSendingCode, newEmail, sendCode, startCooldown]);

  // ========================================
  // 提交表单
  // ========================================
  const handleSubmit = useCallback(() => {
    if (!canSubmit || isChangingEmail) return;
    changeEmail(
      {
        new_email: newEmail.trim(),
        code: emailCode,
      },
      {
        onSuccess: () => {
          router.back();
        },
      },
    );
  }, [canSubmit, isChangingEmail, newEmail, emailCode, changeEmail, router]);

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
        <Appbar.Content title={t("account.change_email_title")} />
      </Appbar.Header>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* 当前邮箱信息卡片 */}
          <View
            style={[
              styles.currentEmailCard,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
            <View style={styles.currentEmailInfo}>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {t("account.current_email_label")}
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurface }}
              >
                {initialEmailRef.current || t("settings.not_logged_in")}
              </Text>
            </View>
          </View>

          {/* 表单区域 */}
          <View
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            {/* 新邮箱输入 */}
            <TextInput
              label={t("account.new_email_label")}
              placeholder={t("account.new_email_placeholder")}
              value={newEmail}
              onChangeText={setNewEmail}
              mode="outlined"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              left={<TextInput.Icon icon="email-plus-outline" />}
              error={(newEmail.length > 0 && !isEmailValid) || isSameEmail}
            />
            {newEmail.length > 0 && !isEmailValid && (
              <HelperText type="error" visible>
                {t("auth.validation.email_invalid")}
              </HelperText>
            )}
            {isSameEmail && newEmail.length > 0 && (
              <HelperText type="error" visible>
                {t("account.email_same_as_current")}
              </HelperText>
            )}

            {/* 验证码输入 + 发送按钮 */}
            <View style={styles.codeRow}>
              <TextInput
                label={t("auth.code_placeholder")}
                value={emailCode}
                onChangeText={(text) =>
                  setEmailCode(text.replace(/\D/g, "").slice(0, 6))
                }
                mode="outlined"
                style={styles.codeInput}
                keyboardType="number-pad"
                maxLength={6}
                left={<TextInput.Icon icon="shield-key-outline" />}
              />
              <Button
                mode="outlined"
                onPress={handleSendCode}
                disabled={!canSendCode || isSendingCode}
                loading={isSendingCode}
                style={styles.codeButton}
                compact
              >
                {cooldown > 0
                  ? t("auth.code_cooldown", { seconds: cooldown })
                  : t("auth.send_code_button")}
              </Button>
            </View>

            {/* 提示信息 */}
            <View style={styles.hintRow}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color={theme.colors.primary}
              />
              <Text
                variant="bodySmall"
                style={[
                  styles.hintText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t("account.change_email_code_hint")}
              </Text>
            </View>

            {/* 提交按钮 */}
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={isChangingEmail}
              disabled={!canSubmit || isChangingEmail}
              style={styles.submitButton}
              contentStyle={styles.submitButtonContent}
            >
              {t("account.change_email_button")}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
  },
  currentEmailCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    gap: 12,
  },
  currentEmailInfo: {
    flex: 1,
    gap: 2,
  },
  card: {
    borderRadius: 18,
    padding: 20,
  },
  input: {
    marginBottom: 12,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  codeInput: {
    flex: 1,
  },
  codeButton: {
    marginTop: 6,
    minWidth: 110,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 6,
  },
  hintText: {
    flex: 1,
  },
  submitButton: {
    borderRadius: 12,
  },
  submitButtonContent: {
    paddingVertical: 6,
  },
});
