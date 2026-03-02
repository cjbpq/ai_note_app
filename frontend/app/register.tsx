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
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { APP_CONFIG } from "../constants/config";
import { useAuth } from "../hooks/useAuth";
import { ServiceError } from "../types";

/**
 * 注册页面 — 邮箱验证码注册全流程
 *
 * 流程：填写邮箱 → 发送验证码 → 填写验证码+用户名+密码 → 提交注册
 * 注册成功后自动跳转登录页（后端注册接口不返回 Token）
 */
export default function RegisterScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const {
    emailRegister,
    isEmailRegistering,
    emailRegisterError,
    sendCode,
    isSendingCode,
  } = useAuth();

  // ── 表单状态 ──────────────────────────────
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);

  // ── 验证码倒计时状态 ──────────────────────────────
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** 卸载时清理倒计时定时器，防止内存泄漏 */
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  /** 启动 60 秒倒计时 */
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

  // ── 校验逻辑 ──────────────────────────────

  const isEmailValid = useMemo(() => {
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    return emailRegex.test(email);
  }, [email]);

  /** 验证码格式校验：6 位纯数字 */
  const isCodeValid = useMemo(() => {
    return /^\d{6}$/.test(verifyCode);
  }, [verifyCode]);

  const passwordChecks = useMemo(
    () => ({
      minLength: password.length >= APP_CONFIG.VALIDATION.PASSWORD_MIN,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    }),
    [password],
  );

  const isPasswordStrong = useMemo(() => {
    return Object.values(passwordChecks).every(Boolean);
  }, [passwordChecks]);

  const isConfirmPasswordMatched = useMemo(() => {
    if (!confirmPassword) return false;
    return confirmPassword === password;
  }, [confirmPassword, password]);

  /** 密码规则中未满足的条目（用于展示提示） */
  const missingPasswordRules = useMemo(() => {
    const missing: string[] = [];
    if (!passwordChecks.minLength) {
      missing.push(
        t("auth.validation.password_rule_min", {
          min: APP_CONFIG.VALIDATION.PASSWORD_MIN,
        }),
      );
    }
    if (!passwordChecks.hasUppercase) {
      missing.push(t("auth.validation.password_rule_uppercase"));
    }
    if (!passwordChecks.hasLowercase) {
      missing.push(t("auth.validation.password_rule_lowercase"));
    }
    if (!passwordChecks.hasNumber) {
      missing.push(t("auth.validation.password_rule_number"));
    }
    if (!passwordChecks.hasSpecial) {
      missing.push(t("auth.validation.password_rule_special"));
    }
    return missing;
  }, [passwordChecks, t]);

  const shouldShowPasswordRules = useMemo(() => {
    return password.length > 0 && !isPasswordStrong;
  }, [password.length, isPasswordStrong]);

  const shouldShowConfirmPasswordError = useMemo(() => {
    if (!confirmPassword) return false;
    return !isConfirmPasswordMatched;
  }, [confirmPassword, isConfirmPasswordMatched]);

  /** 验证码输入框是否应显示错误态 */
  const shouldShowCodeError = useMemo(() => {
    if (!verifyCode) return false;
    return !isCodeValid;
  }, [verifyCode, isCodeValid]);

  /** 整体表单是否可提交 */
  const hasErrors = useMemo(() => {
    if (!username || !email || !password || !confirmPassword || !verifyCode)
      return true;
    if (username.length < APP_CONFIG.VALIDATION.USERNAME_MIN) return true;
    if (username.length > APP_CONFIG.VALIDATION.USERNAME_MAX) return true;
    if (password.length > APP_CONFIG.VALIDATION.PASSWORD_MAX) return true;
    if (!isPasswordStrong) return true;
    if (!isEmailValid) return true;
    if (!isCodeValid) return true;
    if (!isConfirmPasswordMatched) return true;
    return false;
  }, [
    username,
    email,
    password,
    confirmPassword,
    verifyCode,
    isPasswordStrong,
    isEmailValid,
    isCodeValid,
    isConfirmPasswordMatched,
  ]);

  // ── 事件处理 ──────────────────────────────

  /** 发送验证码 — 只要邮箱合法且不在冷却中即可触发 */
  const handleSendCode = useCallback(() => {
    if (!isEmailValid || cooldown > 0 || isSendingCode) return;
    sendCode(
      { email, purpose: "register" },
      {
        onSuccess: () => {
          // 成功后启动前端倒计时
          startCooldown();
        },
      },
    );
  }, [email, isEmailValid, cooldown, isSendingCode, sendCode, startCooldown]);

  /** 提交邮箱验证码注册 */
  const handleRegister = useCallback(() => {
    if (hasErrors) return;
    emailRegister(
      { email, code: verifyCode, username, password },
      {
        onSuccess: () => {
          // 注册成功 → 跳转登录页
          router.replace("/login");
        },
      },
    );
  }, [hasErrors, emailRegister, email, verifyCode, username, password, router]);

  /** 发送按钮文案：冷却中显示倒计时，否则显示「发送验证码」 */
  const sendButtonLabel = useMemo(() => {
    if (cooldown > 0) return t("auth.code_cooldown", { seconds: cooldown });
    return t("auth.send_code_button");
  }, [cooldown, t]);

  // ── 注册错误引用（用于字段级错误定位） ──────────────────────────────
  const regError = emailRegisterError;

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
          {/* ── 标题 ── */}
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.primary }]}
          >
            AI Note App
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            {t("auth.register_button")}
          </Text>

          {/* ── 用户名（置顶） ── */}
          <TextInput
            label={t("auth.username_placeholder")}
            value={username}
            onChangeText={setUsername}
            mode="outlined"
            style={styles.input}
            error={
              username.length > APP_CONFIG.VALIDATION.USERNAME_MAX ||
              (regError instanceof ServiceError &&
                !!regError.fieldErrors?.username)
            }
            left={<TextInput.Icon icon="account" />}
          />
          {username.length > APP_CONFIG.VALIDATION.USERNAME_MAX ? (
            <HelperText type="error" visible>
              {t("auth.validation.username_max", {
                max: APP_CONFIG.VALIDATION.USERNAME_MAX,
              })}
            </HelperText>
          ) : null}
          {regError instanceof ServiceError &&
          !!regError.fieldErrors?.username ? (
            <HelperText type="error" visible>
              {regError.fieldErrors?.username}
            </HelperText>
          ) : null}

          {/* ── 邮箱 ── */}
          <TextInput
            label={t("auth.email_placeholder")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            mode="outlined"
            style={styles.input}
            error={
              (email.length > 0 && !isEmailValid) ||
              (regError instanceof ServiceError &&
                !!regError.fieldErrors?.email)
            }
            left={<TextInput.Icon icon="email" />}
          />
          {email.length > 0 && !isEmailValid ? (
            <HelperText type="error" visible>
              {t("auth.validation.email_invalid")}
            </HelperText>
          ) : null}
          {regError instanceof ServiceError && !!regError.fieldErrors?.email ? (
            <HelperText type="error" visible>
              {regError.fieldErrors?.email}
            </HelperText>
          ) : null}

          {/* ── 验证码输入行（输入框 + 发送按钮同行） ── */}
          <View style={styles.codeRow}>
            <TextInput
              label={t("auth.code_placeholder")}
              value={verifyCode}
              onChangeText={(text) => {
                // 只允许输入数字，最多 6 位
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

          {/* ── 密码 ── */}
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
              (password.length > 0 && !isPasswordStrong) ||
              password.length > APP_CONFIG.VALIDATION.PASSWORD_MAX ||
              (regError instanceof ServiceError &&
                !!regError.fieldErrors?.password)
            }
            left={<TextInput.Icon icon="lock" />}
            right={
              <TextInput.Icon
                icon={isPasswordVisible ? "eye" : "eye-off"}
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              />
            }
          />
          {shouldShowPasswordRules ? (
            <HelperText type="error" visible>
              {t("auth.validation.password_rules_title")}
              {missingPasswordRules.join("、")}
            </HelperText>
          ) : null}
          {password.length > APP_CONFIG.VALIDATION.PASSWORD_MAX ? (
            <HelperText type="error" visible>
              {t("auth.validation.password_max", {
                max: APP_CONFIG.VALIDATION.PASSWORD_MAX,
              })}
            </HelperText>
          ) : null}
          {regError instanceof ServiceError &&
          !!regError.fieldErrors?.password ? (
            <HelperText type="error" visible>
              {regError.fieldErrors?.password}
            </HelperText>
          ) : null}

          {/* ── 确认密码 ── */}
          <TextInput
            label={t("auth.confirm_password_placeholder")}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry={!isConfirmPasswordVisible}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            textContentType="none"
            contextMenuHidden
            importantForAutofill="noExcludeDescendants"
            keyboardType="default"
            style={styles.input}
            error={shouldShowConfirmPasswordError}
            left={<TextInput.Icon icon="shield-check" />}
            right={
              <TextInput.Icon
                icon={isConfirmPasswordVisible ? "eye" : "eye-off"}
                onPress={() =>
                  setIsConfirmPasswordVisible(!isConfirmPasswordVisible)
                }
              />
            }
          />
          {shouldShowConfirmPasswordError ? (
            <HelperText type="error" visible>
              {t("auth.validation.confirm_password_mismatch")}
            </HelperText>
          ) : null}

          {/* ── 全局错误反馈 ── */}
          {regError ? (
            <HelperText type="error" visible={!!regError} style={styles.error}>
              {regError instanceof Error
                ? regError.message
                : t("auth.register_failed")}
            </HelperText>
          ) : null}

          {/* ── 注册按钮 ── */}
          <Button
            mode="contained"
            onPress={handleRegister}
            loading={isEmailRegistering}
            disabled={isEmailRegistering || hasErrors}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {t("auth.register_button")}
          </Button>

          {/* ── 返回登录 ── */}
          <Button
            mode="text"
            onPress={() => router.replace("/login")}
            style={styles.textButton}
          >
            {t("auth.switch_to_login")}
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
    marginBottom: 32,
    opacity: 0.7,
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
  /** 发送验证码按钮 — 固定在右侧，自适应宽度 */
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
  textButton: {
    marginTop: 16,
  },
  error: {
    marginBottom: 8,
    textAlign: "center",
  },
});
