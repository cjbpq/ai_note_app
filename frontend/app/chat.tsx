import { Href, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  Appbar,
  IconButton,
  Surface,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useChat } from "../hooks/useChat";
import { ChatMessage } from "../types";

export default function ChatScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [draft, setDraft] = useState("");

  const {
    messages,
    conversationId,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
    resetChat,
  } = useChat();

  const canSend = draft.trim().length > 0 && !isStreaming;

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/read" as Href);
  }, [router]);

  const handleSend = useCallback(() => {
    if (!draft.trim() || isStreaming) {
      void sendMessage(draft);
      return;
    }

    const message = draft;
    setDraft("");
    void sendMessage(message);
  }, [draft, isStreaming, sendMessage]);

  const subtitle = useMemo(() => {
    if (isStreaming) return t("chat.streaming");
    if (conversationId) return t("chat.connected");
    return t("chat.new_conversation");
  }, [conversationId, isStreaming, t]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.role === "user";
      const isError = item.status === "error";
      const isStopped = item.status === "stopped";
      const isEmptyStreaming =
        item.role === "assistant" && item.isStreaming && !item.content;

      return (
        <View
          style={[
            styles.messageRow,
            isUser ? styles.userRow : styles.assistantRow,
          ]}
        >
          <Surface
            elevation={0}
            style={[
              styles.bubble,
              {
                backgroundColor: isUser
                  ? theme.colors.primaryContainer
                  : theme.colors.surfaceVariant,
              },
              isError && {
                backgroundColor: theme.colors.errorContainer,
              },
            ]}
          >
            {isEmptyStreaming ? (
              <View style={styles.loadingLine}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text
                  variant="bodyMedium"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {t("chat.thinking")}
                </Text>
              </View>
            ) : (
              <Text
                variant="bodyMedium"
                style={{
                  color: isError
                    ? theme.colors.onErrorContainer
                    : isUser
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSurfaceVariant,
                }}
              >
                {item.content}
              </Text>
            )}
            {isStopped ? (
              <Text
                variant="labelSmall"
                style={[
                  styles.statusText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t("chat.stopped_status")}
              </Text>
            ) : null}
          </Surface>
        </View>
      );
    },
    [
      t,
      theme.colors.errorContainer,
      theme.colors.onErrorContainer,
      theme.colors.onPrimaryContainer,
      theme.colors.onSurfaceVariant,
      theme.colors.primary,
      theme.colors.primaryContainer,
      theme.colors.surfaceVariant,
    ],
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={[]}
    >
      <Appbar.Header statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={handleBack} />
        <Appbar.Content title={t("chat.title")} subtitle={subtitle} />
        {messages.length > 0 ? (
          <Appbar.Action
            icon="plus"
            accessibilityLabel={t("chat.new_chat")}
            disabled={isStreaming}
            onPress={resetChat}
          />
        ) : null}
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && styles.emptyListContent,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text
                variant="titleMedium"
                style={{ color: theme.colors.onSurface }}
              >
                {t("chat.empty_title")}
              </Text>
              <Text
                variant="bodyMedium"
                style={[
                  styles.emptyText,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {t("chat.empty_subtitle")}
              </Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
        />

        {error ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: theme.colors.errorContainer },
            ]}
          >
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onErrorContainer }}
            >
              {error.message}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.composer,
            {
              borderTopColor: theme.colors.outlineVariant,
              backgroundColor: theme.colors.surface,
              paddingBottom:
                Platform.OS === "ios" ? Math.max(insets.bottom, 12) : 12,
            },
          ]}
        >
          <TextInput
            mode="outlined"
            value={draft}
            onChangeText={setDraft}
            placeholder={t("chat.input_placeholder")}
            multiline
            maxLength={1000}
            style={styles.input}
            contentStyle={styles.inputContent}
            outlineStyle={styles.inputOutline}
            textAlignVertical="center"
            disabled={false}
            returnKeyType="send"
          />
          {isStreaming ? (
            <IconButton
              mode="contained-tonal"
              icon="stop"
              accessibilityLabel={t("chat.stop")}
              onPress={stopStreaming}
            />
          ) : (
            <IconButton
              mode="contained"
              icon="send"
              accessibilityLabel={t("chat.send")}
              disabled={!canSend}
              onPress={handleSend}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  userRow: {
    justifyContent: "flex-end",
  },
  assistantRow: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "86%",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  loadingLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    marginTop: 6,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
  },
  inputContent: {
    minHeight: 52,
    paddingTop: 8,
    paddingBottom: 8,
  },
  inputOutline: {
    borderRadius: 8,
  },
});
