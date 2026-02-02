import * as ImagePicker from "expo-image-picker";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import type { MD3Theme } from "react-native-paper";
import { Button, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import i18n from "../i18n";
import { authService } from "../services/authService";
import { noteService } from "../services/noteService";

/**
 * 临时 API 测试面板
 * 用于快速验证 Service 层和 Mock 数据是否正常工作
 */
export default function TestApiScreen() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testImage, setTestImage] = useState<string | null>(null);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mockMode = process.env.EXPO_PUBLIC_USE_MOCK === "true";

  const addLog = (title: string, data?: unknown) => {
    const timestamp = new Date().toLocaleTimeString();
    const message = `[${timestamp}] ${title}:\n${JSON.stringify(data, null, 2)}`;
    setLogs((prev) => [message, ...prev]);
  };

  const clearLogs = () => setLogs([]);

  // 0. 选择图片
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        const selectedUri = result.assets?.[0]?.uri;
        if (selectedUri) {
          setTestImage(selectedUri);
          addLog(i18n.t("testApi.logs.imageSelected"), selectedUri);
        } else {
          addLog(
            i18n.t("testApi.logs.imageSelectFailed"),
            i18n.t("common.unknown_error"),
          );
        }
      }
    } catch (error: any) {
      addLog(
        i18n.t("testApi.logs.imageSelectFailed"),
        error?.message ?? i18n.t("common.unknown_error"),
      );
    }
  };

  // 1. 测试登录
  const testLogin = async () => {
    setIsLoading(true);
    try {
      addLog(i18n.t("testApi.logs.loginStart"), { username: "666666" });
      const res = await authService.login({
        username: "666666",
        password: "123456",
      });
      addLog(i18n.t("testApi.logs.loginSuccess"), res);
    } catch (error: any) {
      addLog(
        i18n.t("testApi.logs.loginFailed"),
        error?.message ?? i18n.t("common.unknown_error"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 测试获取笔记列表
  const testFetchNotes = async () => {
    setIsLoading(true);
    try {
      addLog(i18n.t("testApi.logs.fetchNotesStart"), {});
      const res = await noteService.fetchNotes();
      addLog(
        i18n.t("testApi.logs.fetchNotesSuccess"),
        i18n.t("testApi.status.notesCount", { count: res?.length ?? 0 }),
      );
    } catch (error: any) {
      addLog(
        i18n.t("testApi.logs.fetchNotesFailed"),
        error?.message ?? i18n.t("common.unknown_error"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 3. 测试完整流程：上传图片 -> 轮询 -> 获取结果
  const testUploadFlow = async () => {
    if (!testImage && !mockMode) {
      addLog(i18n.t("testApi.logs.error"), i18n.t("testApi.logs.missingImage"));
      return;
    }

    setIsLoading(true);
    try {
      // 如果没有选图且是Mock模式，用假路径；否则用真图
      const imageToUpload = testImage || "file://mock_image.jpg";

      addLog(i18n.t("testApi.logs.uploadStart"), imageToUpload);

      const uploadRes = await noteService.uploadImageNote(imageToUpload);
      const jobId = uploadRes.job_id;
      const noteIdFromUpload = uploadRes.note_id;

      if (!noteIdFromUpload) {
        addLog(
          i18n.t("testApi.logs.missingNoteId"),
          i18n.t("testApi.logs.pollingWithJobOnly"),
        );
      }

      // Step 2: 轮询等待
      addLog(i18n.t("testApi.logs.pollingStart"), {
        jobId,
      });
      const noteId = await noteService.waitForJobCompletion(jobId);
      addLog(i18n.t("testApi.logs.jobCompleted"), { noteId });

      // Step 3: 获取详情
      addLog(i18n.t("testApi.logs.fetchNoteDetailStart"), { noteId });
      const noteDetail = await noteService.getNoteById(noteId);
      addLog(i18n.t("testApi.logs.flowCompleted"), noteDetail);
    } catch (error: any) {
      addLog(
        i18n.t("testApi.logs.flowError"),
        error?.message ?? i18n.t("common.unknown_error"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{i18n.t("testApi.title")}</Text>
        <Text style={styles.subtitle}>
          {i18n.t("testApi.subtitle", { mode: String(mockMode) })}
        </Text>
      </View>

      <View style={styles.controls}>
        <Button mode="contained" onPress={testLogin} disabled={isLoading}>
          {i18n.t("testApi.buttons.login")}
        </Button>
        <Button mode="outlined" onPress={pickImage} disabled={isLoading}>
          {i18n.t("testApi.buttons.pickImage")}
        </Button>
        {testImage && (
          <Text style={styles.selectedText}>
            {i18n.t("testApi.status.selectedSuffix", {
              tail: testImage.slice(-20),
            })}
          </Text>
        )}
        <View style={styles.spacer} />
        <Button mode="contained" onPress={testFetchNotes} disabled={isLoading}>
          {i18n.t("testApi.buttons.fetchNotes")}
        </Button>
        <View style={styles.spacer} />
        <Button mode="contained" onPress={testUploadFlow} disabled={isLoading}>
          {i18n.t("testApi.buttons.uploadFlow")}
        </Button>
        <View style={styles.spacer} />
        <Button
          mode="outlined"
          onPress={clearLogs}
          textColor={theme.colors.error}
        >
          {i18n.t("testApi.buttons.clearLogs")}
        </Button>
      </View>

      {isLoading && <ActivityIndicator size="large" style={styles.loader} />}

      <ScrollView
        style={styles.logContainer}
        contentContainerStyle={styles.logContent}
      >
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>{i18n.t("testApi.status.empty")}</Text>
        ) : (
          logs.map((log, index) => (
            <View key={index} style={styles.logItem}>
              <Text style={styles.logText}>{log}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.outline,
      backgroundColor: theme.colors.surface,
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.colors.onSurface,
    },
    subtitle: {
      fontSize: 14,
      color: theme.colors.onSurfaceVariant,
      marginTop: 4,
    },
    controls: {
      padding: 16,
      flexDirection: "column",
      gap: 10,
    },
    selectedText: {
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    spacer: {
      height: 10,
    },
    loader: {
      marginVertical: 10,
    },
    logContainer: {
      flex: 1,
      backgroundColor: theme.colors.surfaceVariant,
      margin: 16,
      borderRadius: 8,
    },
    logContent: {
      padding: 10,
    },
    logItem: {
      marginBottom: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.colors.outline,
      paddingBottom: 5,
    },
    logText: {
      color: theme.colors.onSurfaceVariant,
      fontFamily: "monospace",
      fontSize: 12,
    },
    emptyText: {
      color: theme.colors.onSurfaceVariant,
      textAlign: "center",
      marginTop: 20,
    },
  });
