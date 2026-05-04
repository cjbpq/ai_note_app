import { Href, useLocalSearchParams, useRouter } from "expo-router";
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
  const { noteId, noteTitle } = useLocalSearchParams<{
    noteId?: string;
    noteTitle?: string;
  }>();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [draft, setDraft] = useState("");

  const referenceNoteId = useMemo(() => {
    return Array.isArray(noteId) ? noteId[0] : noteId;
  }, [noteId]);

  const referencedNoteIds = useMemo(() => {
    return referenceNoteId ? [referenceNoteId] : [];
  }, [referenceNoteId]);

  const referenceTitle = useMemo(() => {
    if (!noteTitle) return t("chat.reference_note_fallback");
    return Array.isArray(noteTitle) ? noteTitle[0] : noteTitle;
  }, [noteTitle, t]);

  const {
    messages,
    conversationId,
    isStreaming,
    hasReferenceAnchor,
    sendMessage,
    stopStreaming,
    resetChat,
  } = useChat({ referencedNoteIds, referenceNoteTitle: referenceTitle });

  const canSend = draft.trim().length > 0 && !isStreaming;
  const shouldShowComposerReference = !!referenceNoteId && !hasReferenceAnchor;

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
    if (referenceNoteId) return t("chat.note_conversation");
    return t("chat.new_conversation");
  }, [conversationId, isStreaming, referenceNoteId, t]);

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
      const referenceTitle =
        typeof item.metadata?.referenceTitle === "string"
          ? item.metadata.referenceTitle
          : undefined;

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
            {isUser && referenceTitle ? (
              <View
                style={[
                  styles.messageAttachment,
                  { borderColor: theme.colors.outlineVariant },
                ]}
              >
                <IconButton
                  icon="paperclip"
                  size={14}
                  iconColor={theme.colors.onPrimaryContainer}
                  style={styles.messageAttachmentIcon}
                />
                <Text
                  variant="labelSmall"
                  numberOfLines={1}
                  style={[
                    styles.messageAttachmentText,
                    { color: theme.colors.onPrimaryContainer },
                  ]}
                >
                  {referenceTitle}
                </Text>
              </View>
            ) : null}
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
      theme.colors.outlineVariant,
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
              {!referenceNoteId ? (
                <>
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
                </>
              ) : null}
            </View>
          }
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
        />

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
          {shouldShowComposerReference ? (
            <View style={styles.composerAttachmentRow}>
              <Surface
                elevation={0}
                style={[
                  styles.composerAttachment,
                  {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <IconButton
                  icon="paperclip"
                  size={14}
                  iconColor={theme.colors.primary}
                  style={styles.composerAttachmentIcon}
                />
                <Text
                  variant="labelSmall"
                  numberOfLines={1}
                  style={[
                    styles.composerAttachmentText,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {t("chat.reference_attachment")} · {referenceTitle}
                </Text>
              </Surface>
            </View>
          ) : null}

          <View style={styles.composerInputRow}>
            <TextInput
              mode="outlined"
              dense
              value={draft}
              onChangeText={setDraft}
              placeholder={
                shouldShowComposerReference
                  ? t("chat.input_note_placeholder")
                  : t("chat.input_placeholder")
              }
              placeholderTextColor={theme.colors.outline}
              multiline
              numberOfLines={1}
              maxLength={1000}
              style={styles.input}
              contentStyle={styles.inputContent}
              outlineStyle={styles.inputOutline}
              textAlignVertical="top"
              disabled={false}
              returnKeyType="send"
            />
            {isStreaming ? (
              <IconButton
                mode="contained-tonal"
                icon="stop"
                size={20}
                accessibilityLabel={t("chat.stop")}
                onPress={stopStreaming}
              />
            ) : (
              <IconButton
                mode="contained"
                icon="send"
                size={20}
                accessibilityLabel={t("chat.send")}
                disabled={!canSend}
                onPress={handleSend}
              />
            )}
          </View>
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
  messageAttachment: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    marginBottom: 8,
    paddingRight: 8,
  },
  messageAttachmentIcon: {
    width: 22,
    height: 22,
    margin: 0,
  },
  messageAttachmentText: {
    flexShrink: 1,
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  composerAttachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  composerAttachment: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "86%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingRight: 8,
  },
  composerAttachmentIcon: {
    width: 24,
    height: 24,
    margin: 0,
    marginRight: 2,
  },
  composerAttachmentText: {
    flexShrink: 1,
  },
  composerInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 112,
    fontSize: 15,
  },
  inputContent: {
    minHeight: 42,
    paddingTop: 7,
    paddingBottom: 7,
    fontSize: 15,
    lineHeight: 20,
  },
  inputOutline: {
    borderRadius: 8,
  },
});
