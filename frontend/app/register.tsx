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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const hasErrors = useMemo(() => {
    if (!username || !email || !password) return true;
    if (username.length < APP_CONFIG.VALIDATION.USERNAME_MIN) return true;
    if (password.length < APP_CONFIG.VALIDATION.PASSWORD_MIN) return true;
    // 基础邮箱校验，防止明显错误
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(email)) return true;
    return false;
  }, [username, email, password]);

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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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
          left={<TextInput.Icon icon="account" />}
        />

        {/* Email */}
        <TextInput
          label={t("auth.email_placeholder")}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          mode="outlined"
          style={styles.input}
          left={<TextInput.Icon icon="email" />}
        />

        {/* Password */}
        <TextInput
          label={t("auth.password_placeholder")}
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry={!isPasswordVisible}
          style={styles.input}
          left={<TextInput.Icon icon="lock" />}
          right={
            <TextInput.Icon
              icon={isPasswordVisible ? "eye-off" : "eye"}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            />
          }
        />

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
