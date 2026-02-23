import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import {
  Button,
  HelperText,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useAuth } from "../hooks/useAuth";
import { ServiceError } from "../types";

export default function LoginScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { login, isLoggingIn, loginError } = useAuth(); // 使用封装好的 Hook

  // UI State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // 简单的表单校验状态
  const hasErrors = () => {
    return !username || !password;
  };

  const handleLogin = () => {
    if (hasErrors()) return;

    // 调用 Hook 中的 login 方法
    login(
      { username, password },
      {
        onSuccess: () => {
          // 登录成功后，路由跳转由 _layout 守卫或 Hook 内部处理均可
          // 此处做个显式跳转更稳健
          router.replace("/(tabs)");
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
          {t("auth.login_button")}
        </Text>

        {/* Username Input */}
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

        {/* Password Input */}
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

        {/* Error Feedback */}
        {loginError ? (
          <HelperText type="error" visible={!!loginError} style={styles.error}>
            {/* 如果 error 是 Error 对象，取 message，实际项目中建议i18n处理后端错误码 */}
            {loginError instanceof ServiceError
              ? loginError.message
              : loginError instanceof Error
                ? loginError.message
                : t("auth.login_failed")}
          </HelperText>
        ) : null}

        {/* Action Button */}
        <Button
          mode="contained"
          onPress={handleLogin}
          loading={isLoggingIn}
          disabled={isLoggingIn || !username || !password}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          {t("auth.login_button")}
        </Button>

        {/* Switch to Register */}
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
