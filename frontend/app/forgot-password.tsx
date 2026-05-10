import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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
import { useVerificationCooldown } from "../hooks/useVerificationCooldown";
import { ServiceError } from "../types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const {
    sendCode,
    isSendingCode,
    resetPassword,
    isResettingPassword,
    resetPasswordError,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
    useState(false);

  const { cooldown, isCoolingDown, startCooldown } = useVerificationCooldown(
    "reset_password",
    email,
  );

  const trimmedEmail = email.trim();
  const isEmailValid = useMemo(
    () => EMAIL_REGEX.test(trimmedEmail),
    [trimmedEmail],
  );
  const isCodeValid = useMemo(() => /^\d{6}$/.test(code), [code]);
  const isPasswordLongEnough =
    newPassword.length >= APP_CONFIG.VALIDATION.REGISTER_PASSWORD_MIN;
  const isPasswordValid =
    isPasswordLongEnough &&
    newPassword.length <= APP_CONFIG.VALIDATION.PASSWORD_MAX;
  const isConfirmPasswordMatched =
    confirmPassword.length > 0 && confirmPassword === newPassword;
  const formError = resetPasswordError;

  const canSubmit =
    isEmailValid && isCodeValid && isPasswordValid && isConfirmPasswordMatched;

  const handleSendCode = useCallback(() => {
    if (!isEmailValid || isCoolingDown || isSendingCode) return;
    sendCode(
      { email: trimmedEmail, purpose: "reset_password" },
      { onSuccess: () => startCooldown() },
    );
  }, [
    isEmailValid,
    isCoolingDown,
    isSendingCode,
    sendCode,
    trimmedEmail,
    startCooldown,
  ]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit || isResettingPassword) return;
    resetPassword(
      {
        email: trimmedEmail,
        code,
        new_password: newPassword,
      },
      {
        onSuccess: () => {
          router.replace("/login");
        },
      },
    );
  }, [
    canSubmit,
    isResettingPassword,
    resetPassword,
    trimmedEmail,
    code,
    newPassword,
    router,
  ]);

  const sendButtonLabel =
    cooldown > 0
      ? t("auth.code_cooldown", { seconds: cooldown })
      : t("auth.send_code_button");

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
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.primary }]}
          >
            {t("account.reset_password_title")}
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {t("account.reset_password_guest_hint")}
          </Text>

          <TextInput
            label={t("auth.email_placeholder")}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            mode="outlined"
            style={styles.input}
            error={
              (email.length > 0 && !isEmailValid) ||
              (formError instanceof ServiceError &&
                !!formError.fieldErrors?.email)
            }
            left={<TextInput.Icon icon="email" />}
          />
          {email.length > 0 && !isEmailValid ? (
            <HelperText type="error" visible>
              {t("auth.validation.email_invalid")}
            </HelperText>
          ) : null}
          {formError instanceof ServiceError && !!formError.fieldErrors?.email ? (
            <HelperText type="error" visible>
              {formError.fieldErrors.email}
            </HelperText>
          ) : null}

          <View style={styles.codeRow}>
            <TextInput
              label={t("auth.code_placeholder")}
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={APP_CONFIG.VALIDATION.VERIFY_CODE_LENGTH}
              mode="outlined"
              style={styles.codeInput}
              error={
                (code.length > 0 && !isCodeValid) ||
                (formError instanceof ServiceError &&
                  !!formError.fieldErrors?.code)
              }
              left={<TextInput.Icon icon="shield-key" />}
            />
            <Button
              mode="outlined"
              onPress={handleSendCode}
              loading={isSendingCode}
              disabled={!isEmailValid || isCoolingDown || isSendingCode}
              style={styles.sendCodeButton}
              labelStyle={styles.sendCodeLabel}
              compact
            >
              {sendButtonLabel}
            </Button>
          </View>
          {code.length > 0 && !isCodeValid ? (
            <HelperText type="error" visible>
              {t("auth.validation.code_invalid")}
            </HelperText>
          ) : null}
          {formError instanceof ServiceError && !!formError.fieldErrors?.code ? (
            <HelperText type="error" visible>
              {formError.fieldErrors.code}
            </HelperText>
          ) : null}

          <TextInput
            label={t("account.new_password_label")}
            value={newPassword}
            onChangeText={setNewPassword}
            mode="outlined"
            secureTextEntry={!isPasswordVisible}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            style={styles.input}
            error={
              (newPassword.length > 0 && !isPasswordValid) ||
              (formError instanceof ServiceError &&
                !!formError.fieldErrors?.password)
            }
            left={<TextInput.Icon icon="lock" />}
            right={
              <TextInput.Icon
                icon={isPasswordVisible ? "eye" : "eye-off"}
                onPress={() => setIsPasswordVisible((value) => !value)}
              />
            }
          />
          {newPassword.length > 0 && !isPasswordLongEnough ? (
            <HelperText type="error" visible>
              {t("auth.validation.password_rule_min", {
                min: APP_CONFIG.VALIDATION.REGISTER_PASSWORD_MIN,
              })}
            </HelperText>
          ) : null}
          {newPassword.length > APP_CONFIG.VALIDATION.PASSWORD_MAX ? (
            <HelperText type="error" visible>
              {t("auth.validation.password_max", {
                max: APP_CONFIG.VALIDATION.PASSWORD_MAX,
              })}
            </HelperText>
          ) : null}

          <TextInput
            label={t("account.confirm_password_label")}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            secureTextEntry={!isConfirmPasswordVisible}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            style={styles.input}
            error={confirmPassword.length > 0 && !isConfirmPasswordMatched}
            left={<TextInput.Icon icon="shield-check" />}
            right={
              <TextInput.Icon
                icon={isConfirmPasswordVisible ? "eye" : "eye-off"}
                onPress={() => setIsConfirmPasswordVisible((value) => !value)}
              />
            }
          />
          {confirmPassword.length > 0 && !isConfirmPasswordMatched ? (
            <HelperText type="error" visible>
              {t("auth.validation.confirm_password_mismatch")}
            </HelperText>
          ) : null}

          {formError ? (
            <HelperText type="error" visible style={styles.error}>
              {formError instanceof Error
                ? formError.message
                : t("error.auth.resetPasswordFailed")}
            </HelperText>
          ) : null}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={isResettingPassword}
            disabled={!canSubmit || isResettingPassword}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {t("account.reset_password_button")}
          </Button>

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
    marginBottom: 28,
    opacity: 0.7,
  },
  input: {
    marginBottom: 16,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  codeInput: {
    flex: 1,
  },
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
