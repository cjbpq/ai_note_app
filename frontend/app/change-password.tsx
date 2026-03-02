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

/**
 * ChangePasswordScreen - 修改密码 / 重置密码页面
 *
 * 两种模式在同一页面内切换：
 * 1. "change" 模式：已登录用户通过旧密码修改（默认）
 * 2. "reset" 模式：通过邮箱验证码重置（忘记旧密码场景）
 *
 * 架构落点：
 * - UI 层仅负责表单渲染和校验
 * - 通过 useAuth Hook 调用 changePassword / resetPassword / sendCode
 * - 错误提示由 Hook 层的 onError 触发全局 toast
 */
export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const {
    changePassword,
    resetPassword,
    sendCode,
    isChangingPassword,
    isResettingPassword,
    isSendingCode,
    isChangePasswordSuccess,
    isResetPasswordSuccess,
  } = useAuth();

  // ========================================
  // 模式切换：change（默认）/ reset（忘记旧密码）
  // ========================================
  const [mode, setMode] = useState<"change" | "reset">("change");

  // ========================================
  // 表单状态
  // ========================================
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");

  // 密码可见性切换
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 验证码倒计时
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ========================================
  // 成功后自动返回上一页
  // ========================================
  useEffect(() => {
    if (isChangePasswordSuccess || isResetPasswordSuccess) {
      const timer = setTimeout(() => router.back(), 800);
      return () => clearTimeout(timer);
    }
  }, [isChangePasswordSuccess, isResetPasswordSuccess, router]);

  // ========================================
  // 验证码倒计时逻辑（复用注册页方案）
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
  const passwordMinLength = APP_CONFIG.VALIDATION.PASSWORD_MIN;

  const isNewPasswordValid = newPassword.length >= passwordMinLength;
  const isConfirmMatch =
    confirmPassword.length > 0 && newPassword === confirmPassword;

  // "修改密码"模式的提交校验
  const canSubmitChange =
    oldPassword.length > 0 && isNewPasswordValid && isConfirmMatch;

  // "重置密码"模式的提交校验
  const canSubmitReset =
    emailCode.length === APP_CONFIG.VALIDATION.VERIFY_CODE_LENGTH &&
    isNewPasswordValid &&
    isConfirmMatch;

  // ========================================
  // 发送验证码（重置密码模式）
  // ========================================
  const handleSendCode = useCallback(() => {
    if (!user?.email || cooldown > 0 || isSendingCode) return;
    sendCode(
      { email: user.email, purpose: "reset_password" },
      { onSuccess: () => startCooldown() },
    );
  }, [user?.email, cooldown, isSendingCode, sendCode, startCooldown]);

  // ========================================
  // 提交表单
  // ========================================
  const handleSubmit = useCallback(() => {
    if (mode === "change") {
      if (!canSubmitChange) return;
      changePassword({
        old_password: oldPassword,
        new_password: newPassword,
      });
    } else {
      if (!canSubmitReset || !user?.email) return;
      resetPassword({
        email: user.email,
        code: emailCode,
        new_password: newPassword,
      });
    }
  }, [
    mode,
    canSubmitChange,
    canSubmitReset,
    oldPassword,
    newPassword,
    emailCode,
    user?.email,
    changePassword,
    resetPassword,
  ]);

  // ========================================
  // 模式切换时清空表单
  // ========================================
  const switchMode = useCallback((newMode: "change" | "reset") => {
    setMode(newMode);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setEmailCode("");
    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }, []);

  const isSubmitting = isChangingPassword || isResettingPassword;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* 顶部导航栏：标题随模式变化 */}
      <Appbar.Header
        mode="small"
        style={{ backgroundColor: theme.colors.surface }}
        elevated={false}
      >
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content
          title={t(
            mode === "change"
              ? "account.change_password_title"
              : "account.reset_password_title",
          )}
        />
      </Appbar.Header>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[styles.card, { backgroundColor: theme.colors.surface }]}
          >
            {/* ======== "修改密码"模式 ======== */}
            {mode === "change" && (
              <>
                {/* 当前密码输入 */}
                <TextInput
                  label={t("account.old_password_label")}
                  placeholder={t("account.old_password_placeholder")}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  secureTextEntry={!showOldPassword}
                  left={<TextInput.Icon icon="lock-outline" />}
                  right={
                    <TextInput.Icon
                      icon={showOldPassword ? "eye-off" : "eye"}
                      onPress={() => setShowOldPassword((v) => !v)}
                    />
                  }
                  mode="outlined"
                  style={styles.input}
                  autoCapitalize="none"
                />

                {/* 新密码输入 */}
                <TextInput
                  label={t("account.new_password_label")}
                  placeholder={t("account.new_password_placeholder")}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  left={<TextInput.Icon icon="lock-reset" />}
                  right={
                    <TextInput.Icon
                      icon={showNewPassword ? "eye-off" : "eye"}
                      onPress={() => setShowNewPassword((v) => !v)}
                    />
                  }
                  mode="outlined"
                  style={styles.input}
                  autoCapitalize="none"
                  error={newPassword.length > 0 && !isNewPasswordValid}
                />
                {newPassword.length > 0 && !isNewPasswordValid && (
                  <HelperText type="error" visible>
                    {t("account.password_min_hint", {
                      min: passwordMinLength,
                    })}
                  </HelperText>
                )}

                {/* 确认新密码 */}
                <TextInput
                  label={t("account.confirm_password_label")}
                  placeholder={t("account.confirm_password_placeholder")}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  left={<TextInput.Icon icon="lock-check" />}
                  right={
                    <TextInput.Icon
                      icon={showConfirmPassword ? "eye-off" : "eye"}
                      onPress={() => setShowConfirmPassword((v) => !v)}
                    />
                  }
                  mode="outlined"
                  style={styles.input}
                  autoCapitalize="none"
                  error={confirmPassword.length > 0 && !isConfirmMatch}
                />
                {confirmPassword.length > 0 && !isConfirmMatch && (
                  <HelperText type="error" visible>
                    {t("account.password_mismatch")}
                  </HelperText>
                )}

                {/* 提交按钮 */}
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  loading={isChangingPassword}
                  disabled={!canSubmitChange || isSubmitting}
                  style={styles.submitButton}
                  contentStyle={styles.submitButtonContent}
                >
                  {t("account.change_password_button")}
                </Button>

                {/* 忘记旧密码入口 */}
                <Button
                  mode="text"
                  onPress={() => switchMode("reset")}
                  style={styles.switchModeButton}
                  compact
                >
                  {t("account.forgot_old_password")}
                </Button>
              </>
            )}

            {/* ======== "重置密码"模式 ======== */}
            {mode === "reset" && (
              <>
                {/* 提示信息 */}
                <View style={styles.hintRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={theme.colors.primary}
                  />
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.hintText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {t("account.reset_email_hint")}
                  </Text>
                </View>

                {/* 邮箱显示（预填当前账号邮箱，只读） */}
                <TextInput
                  label={t("auth.email_placeholder")}
                  value={user?.email ?? ""}
                  mode="outlined"
                  style={styles.input}
                  left={<TextInput.Icon icon="email-outline" />}
                  disabled
                />

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
                    disabled={!user?.email || cooldown > 0 || isSendingCode}
                    loading={isSendingCode}
                    style={styles.codeButton}
                    compact
                  >
                    {cooldown > 0
                      ? t("auth.code_cooldown", { seconds: cooldown })
                      : t("auth.send_code_button")}
                  </Button>
                </View>

                {/* 新密码输入 */}
                <TextInput
                  label={t("account.new_password_label")}
                  placeholder={t("account.new_password_placeholder")}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNewPassword}
                  left={<TextInput.Icon icon="lock-reset" />}
                  right={
                    <TextInput.Icon
                      icon={showNewPassword ? "eye-off" : "eye"}
                      onPress={() => setShowNewPassword((v) => !v)}
                    />
                  }
                  mode="outlined"
                  style={styles.input}
                  autoCapitalize="none"
                  error={newPassword.length > 0 && !isNewPasswordValid}
                />
                {newPassword.length > 0 && !isNewPasswordValid && (
                  <HelperText type="error" visible>
                    {t("account.password_min_hint", {
                      min: passwordMinLength,
                    })}
                  </HelperText>
                )}

                {/* 确认新密码 */}
                <TextInput
                  label={t("account.confirm_password_label")}
                  placeholder={t("account.confirm_password_placeholder")}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  left={<TextInput.Icon icon="lock-check" />}
                  right={
                    <TextInput.Icon
                      icon={showConfirmPassword ? "eye-off" : "eye"}
                      onPress={() => setShowConfirmPassword((v) => !v)}
                    />
                  }
                  mode="outlined"
                  style={styles.input}
                  autoCapitalize="none"
                  error={confirmPassword.length > 0 && !isConfirmMatch}
                />
                {confirmPassword.length > 0 && !isConfirmMatch && (
                  <HelperText type="error" visible>
                    {t("account.password_mismatch")}
                  </HelperText>
                )}

                {/* 提交按钮 */}
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  loading={isResettingPassword}
                  disabled={!canSubmitReset || isSubmitting}
                  style={styles.submitButton}
                  contentStyle={styles.submitButtonContent}
                >
                  {t("account.reset_password_button")}
                </Button>

                {/* 返回"修改密码"模式 */}
                <Button
                  mode="text"
                  onPress={() => switchMode("change")}
                  style={styles.switchModeButton}
                  compact
                >
                  {t("account.back_to_change")}
                </Button>
              </>
            )}
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
  },
  card: {
    borderRadius: 18,
    padding: 20,
  },
  input: {
    marginBottom: 12,
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
  submitButton: {
    marginTop: 8,
    borderRadius: 12,
  },
  submitButtonContent: {
    paddingVertical: 6,
  },
  switchModeButton: {
    marginTop: 12,
    alignSelf: "center",
  },
});
