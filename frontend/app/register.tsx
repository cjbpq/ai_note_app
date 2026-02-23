import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import {
  Button,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { APP_CONFIG } from "../constants/config";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { ServiceError } from "../types";

export default function RegisterScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { register, isRegistering, registerError } = useAuth();
  const { showSuccess, showError } = useToast();

  // UI state 仅在本页使用，避免无谓的全局存储
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);

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

  const isEmailValid = useMemo(() => {
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    return emailRegex.test(email);
  }, [email]);

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

  const hasErrors = useMemo(() => {
    if (!username || !email || !password || !confirmPassword) return true;
    if (username.length < APP_CONFIG.VALIDATION.USERNAME_MIN) return true;
    if (username.length > APP_CONFIG.VALIDATION.USERNAME_MAX) return true;
    if (password.length > APP_CONFIG.VALIDATION.PASSWORD_MAX) return true;
    if (!isPasswordStrong) return true;
    if (!isEmailValid) return true;
    if (!isConfirmPasswordMatched) return true;
    return false;
  }, [
    username,
    email,
    password,
    confirmPassword,
    isPasswordStrong,
    isEmailValid,
    isConfirmPasswordMatched,
  ]);

  const handleRegister = () => {
    if (hasErrors) return;

    register(
      { username, email, password },
      {
        onSuccess: () => {
          showSuccess(t("auth.register_success"));
          router.replace("/login");
        },
        onError: (error) => {
          showError(error?.message ?? t("auth.register_failed"));
        },
      },
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.formContainer}>
        {/* Title */}
        <Text
          variant="headlineMedium"
          style={[styles.title, { color: theme.colors.primary }]}
        >
          AI Note App
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          {t("auth.register_button")}
        </Text>

        {/* Username */}
        <TextInput
          label={t("auth.username_placeholder")}
          value={username}
          onChangeText={setUsername}
          mode="outlined"
          style={styles.input}
          error={
            username.length > APP_CONFIG.VALIDATION.USERNAME_MAX ||
            (registerError instanceof ServiceError &&
              !!registerError.fieldErrors?.username)
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
        {registerError instanceof ServiceError &&
        !!registerError.fieldErrors?.username ? (
          <HelperText type="error" visible>
            {registerError.fieldErrors?.username}
          </HelperText>
        ) : null}

        {/* Email */}
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
            (registerError instanceof ServiceError &&
              !!registerError.fieldErrors?.email)
          }
          left={<TextInput.Icon icon="email" />}
        />
        {email.length > 0 && !isEmailValid ? (
          <HelperText type="error" visible>
            {t("auth.validation.email_invalid")}
          </HelperText>
        ) : null}
        {registerError instanceof ServiceError &&
        !!registerError.fieldErrors?.email ? (
          <HelperText type="error" visible>
            {registerError.fieldErrors?.email}
          </HelperText>
        ) : null}

        {/* Password */}
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
            (registerError instanceof ServiceError &&
              !!registerError.fieldErrors?.password)
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
        {registerError instanceof ServiceError &&
        !!registerError.fieldErrors?.password ? (
          <HelperText type="error" visible>
            {registerError.fieldErrors?.password}
          </HelperText>
        ) : null}

        {/* Confirm Password */}
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

        {/* Error Feedback */}
        {registerError ? (
          <HelperText
            type="error"
            visible={!!registerError}
            style={styles.error}
          >
            {registerError instanceof Error
              ? registerError.message
              : t("auth.register_failed")}
          </HelperText>
        ) : null}

        {/* Submit */}
        <Button
          mode="contained"
          onPress={handleRegister}
          loading={isRegistering}
          disabled={isRegistering || hasErrors}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          {t("auth.register_button")}
        </Button>

        {/* Back to Login */}
        <Button
          mode="text"
          onPress={() => router.replace("/login")}
          style={styles.textButton}
        >
          {t("auth.switch_to_login")}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
