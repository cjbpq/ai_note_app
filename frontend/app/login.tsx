import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  HelperText,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { APP_CONFIG } from "../constants/config";
import { useAuth } from "../hooks/useAuth";
import { ServiceError } from "../types";

/**
 * 登录页 — 支持密码登录 / 邮箱验证码登录 Tab 切换
 *
 * Tab A（密码登录）：用户名 + 密码 + "忘记密码？使用验证码登录" 引导
 * Tab B（验证码登录）：邮箱 + 6 位验证码 → 登录成功直接进入首页
 */
export default function LoginScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  // 从 Hook 中解构密码登录 & 邮箱验证码登录所需的 actions / states
  const {
    login,
    isLoggingIn,
    loginError,
    emailLogin,
    isEmailLoggingIn,
    emailLoginError,
    sendCode,
    isSendingCode,
  } = useAuth();

  // ── Tab 切换状态 ──────────────────────────────
  // "password" = 密码登录 | "emailCode" = 验证码登录
  const [activeTab, setActiveTab] = useState<string>("password");

  // ── 密码登录表单 ──────────────────────────────
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // ── 验证码登录表单 ──────────────────────────────
  const [email, setEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");

  // ── 验证码倒计时 ──────────────────────────────
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 卸载时清理倒计时定时器 */
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  /** 启动冷却倒计时 */
  const startCooldown = useCallback(() => {
    setCooldown(APP_CONFIG.VALIDATION.VERIFY_CODE_COOLDOWN);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── 邮箱格式校验 ──────────────────────────────
  const isEmailValid = useMemo(() => {
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    return emailRegex.test(email);
  }, [email]);

  /** 验证码格式校验：6 位纯数字 */
  const isCodeValid = useMemo(() => {
    return /^\d{6}$/.test(verifyCode);
  }, [verifyCode]);

  /** 验证码输入时是否应显示错误态 */
  const shouldShowCodeError = useMemo(() => {
    if (!verifyCode) return false;
    return !isCodeValid;
  }, [verifyCode, isCodeValid]);

  // ── 事件处理 ──────────────────────────────

  /** 密码登录 */
  const handlePasswordLogin = useCallback(() => {
    if (!username || !password) return;
    login(
      { username, password },
      {
        onSuccess: () => {
          router.replace("/(tabs)");
        },
      },
    );
  }, [username, password, login, router]);

  /** 发送验证码（purpose = "login"） */
  const handleSendCode = useCallback(() => {
    if (!isEmailValid || cooldown > 0 || isSendingCode) return;
    sendCode(
      { email, purpose: "login" },
      {
        onSuccess: () => {
          startCooldown();
        },
      },
    );
  }, [email, isEmailValid, cooldown, isSendingCode, sendCode, startCooldown]);

  /** 邮箱验证码登录 */
  const handleEmailLogin = useCallback(() => {
    if (!isEmailValid || !isCodeValid) return;
    emailLogin(
      { email, code: verifyCode },
      {
        onSuccess: () => {
          router.replace("/(tabs)");
        },
      },
    );
  }, [isEmailValid, isCodeValid, emailLogin, email, verifyCode, router]);

  /** 发送按钮文案：冷却中显示倒计时 */
  const sendButtonLabel = useMemo(() => {
    if (cooldown > 0) return t("auth.code_cooldown", { seconds: cooldown });
    return t("auth.send_code_button");
  }, [cooldown, t]);

  // ── Tab 按钮配置 ──────────────────────────────
  const tabButtons = useMemo(
    () => [
      { value: "password", label: t("auth.tab_password") },
      { value: "emailCode", label: t("auth.tab_email_code") },
    ],
    [t],
  );

  // ── 当前 Tab 对应的错误对象 ──────────────────────────────
  const currentError = activeTab === "password" ? loginError : emailLoginError;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContainer}>
          {/* ── 标题区域 ── */}
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.primary }]}
          >
            AI Note App
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            {t("auth.login_button")}
          </Text>

          {/* ── Tab 切换（SegmentedButtons） ── */}
          <SegmentedButtons
            value={activeTab}
            onValueChange={setActiveTab}
            buttons={tabButtons}
            style={styles.segmentedButtons}
          />

          {/* ══════════════════════════════════════
              Tab A: 密码登录
              ══════════════════════════════════════ */}
          {activeTab === "password" && (
            <>
              {/* 用户名 */}
              <TextInput
                label={t("auth.username_placeholder")}
                value={username}
                onChangeText={setUsername}
                mode="outlined"
                style={styles.input}
                error={
                  loginError instanceof ServiceError &&
                  !!loginError.fieldErrors?.username
                }
                left={<TextInput.Icon icon="account" />}
              />
              {loginError instanceof ServiceError &&
              !!loginError.fieldErrors?.username ? (
                <HelperText type="error" visible>
                  {loginError.fieldErrors?.username}
                </HelperText>
              ) : null}

              {/* 密码 */}
              <TextInput
                label={t("auth.password_placeholder")}
                value={password}
                onChangeText={setPassword}
                mode="outlined"
                secureTextEntry={!isPasswordVisible}
                autoCorrect={false}
                autoCapitalize="none"
                spellCheck={false}
                autoComplete="off"
                textContentType="none"
                contextMenuHidden
                importantForAutofill="noExcludeDescendants"
                keyboardType="default"
                style={styles.input}
                error={
                  loginError instanceof ServiceError &&
                  !!loginError.fieldErrors?.password
                }
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={isPasswordVisible ? "eye" : "eye-off"}
                    onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                  />
                }
              />
              {loginError instanceof ServiceError &&
              !!loginError.fieldErrors?.password ? (
                <HelperText type="error" visible>
                  {loginError.fieldErrors?.password}
                </HelperText>
              ) : null}

              {/* 密码登录按钮 */}
              <Button
                mode="contained"
                onPress={handlePasswordLogin}
                loading={isLoggingIn}
                disabled={isLoggingIn || !username || !password}
                style={styles.button}
                contentStyle={styles.buttonContent}
              >
                {t("auth.login_button")}
              </Button>

              {/* 忘记密码？使用验证码登录 — 点击切换到验证码 Tab */}
              <Button
                mode="text"
                onPress={() => setActiveTab("emailCode")}
                style={styles.forgotButton}
                labelStyle={styles.forgotLabel}
                compact
              >
                {t("auth.forgot_password_hint")}
              </Button>
            </>
          )}

          {/* ══════════════════════════════════════
              Tab B: 邮箱验证码登录
              ══════════════════════════════════════ */}
          {activeTab === "emailCode" && (
            <>
              {/* 邮箱 */}
              <TextInput
                label={t("auth.email_placeholder")}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                mode="outlined"
                style={styles.input}
                error={email.length > 0 && !isEmailValid}
                left={<TextInput.Icon icon="email" />}
              />
              {email.length > 0 && !isEmailValid ? (
                <HelperText type="error" visible>
                  {t("auth.validation.email_invalid")}
                </HelperText>
              ) : null}

              {/* 验证码行（输入框 + 发送按钮） */}
              <View style={styles.codeRow}>
                <TextInput
                  label={t("auth.code_placeholder")}
                  value={verifyCode}
                  onChangeText={(text) => {
                    // 只接受数字，最多 6 位
                    const digits = text.replace(/\D/g, "").slice(0, 6);
                    setVerifyCode(digits);
                  }}
                  keyboardType="number-pad"
                  maxLength={APP_CONFIG.VALIDATION.VERIFY_CODE_LENGTH}
                  mode="outlined"
                  style={styles.codeInput}
                  error={shouldShowCodeError}
                  left={<TextInput.Icon icon="shield-key" />}
                />
                <Button
                  mode="outlined"
                  onPress={handleSendCode}
                  loading={isSendingCode}
                  disabled={!isEmailValid || cooldown > 0 || isSendingCode}
                  style={styles.sendCodeButton}
                  labelStyle={styles.sendCodeLabel}
                  compact
                >
                  {sendButtonLabel}
                </Button>
              </View>
              {shouldShowCodeError ? (
                <HelperText type="error" visible>
                  {t("auth.validation.code_invalid")}
                </HelperText>
              ) : null}

              {/* 验证码登录按钮 */}
              <Button
                mode="contained"
                onPress={handleEmailLogin}
                loading={isEmailLoggingIn}
                disabled={isEmailLoggingIn || !isEmailValid || !isCodeValid}
                style={styles.button}
                contentStyle={styles.buttonContent}
              >
                {t("auth.login_button")}
              </Button>
            </>
          )}

          {/* ── 全局错误反馈（两个 Tab 共用位置） ── */}
          {currentError ? (
            <HelperText
              type="error"
              visible={!!currentError}
              style={styles.error}
            >
              {currentError instanceof ServiceError
                ? currentError.message
                : currentError instanceof Error
                  ? currentError.message
                  : t("auth.login_failed")}
            </HelperText>
          ) : null}

          {/* ── 底部链接：去注册 ── */}
          <Button
            mode="text"
            onPress={() => {
              router.replace("/register");
            }}
            style={styles.textButton}
          >
            {t("auth.switch_to_register")}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  formContainer: {
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: 8,
    fontWeight: "bold",
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 24,
    opacity: 0.7,
  },
  /** Tab 切换按钮组 */
  segmentedButtons: {
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  /** 验证码行：输入框 + 发送按钮水平排列 */
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  /** 验证码输入框占剩余空间 */
  codeInput: {
    flex: 1,
  },
  /** 发送验证码按钮 */
  sendCodeButton: {
    marginTop: 0,
    borderRadius: 8,
    height: 56,
    justifyContent: "center",
  },
  sendCodeLabel: {
    fontSize: 13,
  },
  button: {
    marginTop: 8,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 6,
  },
  /** "忘记密码？使用验证码登录" 按钮 */
  forgotButton: {
    marginTop: 8,
    alignSelf: "flex-end",
  },
  forgotLabel: {
    fontSize: 13,
  },
  textButton: {
    marginTop: 16,
  },
  error: {
    marginTop: 8,
    textAlign: "center",
  },
});
