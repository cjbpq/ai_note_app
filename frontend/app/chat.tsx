import { Href, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { ChatReferenceChipBar } from "../components/chat/chat-reference-chip-bar";
import { ChatReferencePickerSheet } from "../components/chat/chat-reference-picker-sheet";
import { useChat } from "../hooks/useChat";
import { useCategories } from "../hooks/useCategories";
import { useNotes } from "../hooks/useNotes";
import { useToast } from "../hooks/useToast";
import { ChatMessage, ChatReferenceNote } from "../types";

const MAX_REFERENCE_NOTES = 20;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const getMessageReferences = (
  metadata: Record<string, unknown> | undefined,
): ChatReferenceNote[] => {
  const rawReferences = metadata?.referenceNotes;

  if (Array.isArray(rawReferences)) {
    return rawReferences
      .filter(isRecord)
      .map((reference) => ({
        id:
          typeof reference.id === "string"
            ? reference.id
            : typeof reference.referenceNoteId === "string"
              ? reference.referenceNoteId
              : "",
        title:
          typeof reference.title === "string"
            ? reference.title
            : typeof reference.referenceTitle === "string"
              ? reference.referenceTitle
              : "",
        imageUrl:
          typeof reference.imageUrl === "string"
            ? reference.imageUrl
            : undefined,
        category:
          typeof reference.category === "string"
            ? reference.category
            : undefined,
      }))
      .filter((reference) => reference.id && reference.title);
  }

  if (
    typeof metadata?.referenceNoteId === "string" &&
    typeof metadata.referenceTitle === "string"
  ) {
    return [
      {
        id: metadata.referenceNoteId,
        title: metadata.referenceTitle,
      },
    ];
  }

  return [];
};

export default function ChatScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showWarning } = useToast();
  const { notes, isLoading: isNotesLoading } = useNotes();
  const { categories } = useCategories();
  const { noteId, noteTitle } = useLocalSearchParams<{
    noteId?: string;
    noteTitle?: string;
  }>();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const hasAppliedRouteReferenceRef = useRef(false);
  const pendingReferenceIdsRef = useRef<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [activeReferences, setActiveReferences] = useState<ChatReferenceNote[]>(
    [],
  );
  const [isReferencePickerVisible, setIsReferencePickerVisible] =
    useState(false);

  const referenceNoteId = useMemo(() => {
    return Array.isArray(noteId) ? noteId[0] : noteId;
  }, [noteId]);

  const routeReference = useMemo<ChatReferenceNote | null>(() => {
    if (!referenceNoteId) return null;

    const noteFromList = notes.find((note) => note.id === referenceNoteId);
    const routeTitle = Array.isArray(noteTitle) ? noteTitle[0] : noteTitle;

    return {
      id: referenceNoteId,
      title:
        noteFromList?.title ?? routeTitle ?? t("chat.reference_note_fallback"),
      imageUrl: noteFromList?.imageUrls?.[0],
      category: noteFromList?.category,
    };
  }, [noteTitle, notes, referenceNoteId, t]);

  const {
    messages,
    conversationId,
    isStreaming,
    sendMessage,
    stopStreaming,
    resetChat,
  } = useChat();

  const canSend = draft.trim().length > 0 && !isStreaming;
  const isReferenceLimitReached =
    activeReferences.length >= MAX_REFERENCE_NOTES;
  const composerBottomPadding =
    Platform.OS === "ios"
      ? Math.max(insets.bottom, 12)
      : Math.max(insets.bottom, 32);

  useEffect(() => {
    if (!routeReference || hasAppliedRouteReferenceRef.current) return;

    hasAppliedRouteReferenceRef.current = true;
    pendingReferenceIdsRef.current.add(routeReference.id);
    setActiveReferences((prev) =>
      prev.some((reference) => reference.id === routeReference.id)
        ? prev
        : [routeReference, ...prev],
    );
  }, [routeReference]);

  useEffect(() => {
    if (!routeReference || !hasAppliedRouteReferenceRef.current) return;

    setActiveReferences((prev) =>
      prev.map((reference) =>
        reference.id === routeReference.id
          ? {
              ...reference,
              title: routeReference.title,
              imageUrl: routeReference.imageUrl,
              category: routeReference.category,
            }
          : reference,
      ),
    );
  }, [routeReference]);

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
    const referencedNotes = activeReferences;
    const displayReferencedNotes = activeReferences.filter((reference) =>
      pendingReferenceIdsRef.current.has(reference.id),
    );
    setDraft("");
    pendingReferenceIdsRef.current.clear();
    void sendMessage(message, { referencedNotes, displayReferencedNotes });
  }, [activeReferences, draft, isStreaming, sendMessage]);

  const handleResetChat = useCallback(() => {
    resetChat();
    setDraft("");
    pendingReferenceIdsRef.current = new Set(
      routeReference ? [routeReference.id] : [],
    );
    setActiveReferences(routeReference ? [routeReference] : []);
  }, [resetChat, routeReference]);

  const handleOpenReferencePicker = useCallback(() => {
    if (isStreaming) return;
    setIsReferencePickerVisible(true);
  }, [isStreaming]);

  const handleSelectReference = useCallback(
    (note: ChatReferenceNote) => {
      setActiveReferences((prev) => {
        if (prev.some((reference) => reference.id === note.id)) return prev;
        if (prev.length >= MAX_REFERENCE_NOTES) {
          showWarning(
            t("chat.reference_limit_reached", { count: MAX_REFERENCE_NOTES }),
          );
          return prev;
        }
        pendingReferenceIdsRef.current.add(note.id);
        return [...prev, note];
      });
      setIsReferencePickerVisible(false);
    },
    [showWarning, t],
  );

  const handleRemoveReference = useCallback((id: string) => {
    pendingReferenceIdsRef.current.delete(id);
    setActiveReferences((prev) =>
      prev.filter((reference) => reference.id !== id),
    );
  }, []);

  const subtitle = useMemo(() => {
    if (isStreaming) return t("chat.streaming");
    if (conversationId) return t("chat.connected");
    if (activeReferences.length > 0) {
      return t("chat.references_ready", { count: activeReferences.length });
    }
    return t("chat.new_conversation");
  }, [activeReferences.length, conversationId, isStreaming, t]);

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
      const messageReferences = getMessageReferences(item.metadata);

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
            {isUser && messageReferences.length > 0 ? (
              <View style={styles.messageAttachmentBar}>
                <ChatReferenceChipBar references={messageReferences} />
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
            onPress={handleResetChat}
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
                {activeReferences.length > 0
                  ? t("chat.empty_with_reference")
                  : t("chat.empty_subtitle")}
              </Text>
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
              paddingBottom: composerBottomPadding,
            },
          ]}
        >
          {activeReferences.length > 0 ? (
            <View style={styles.composerReferenceRow}>
              <ChatReferenceChipBar
                references={activeReferences}
                disabled={isStreaming}
                onRemove={handleRemoveReference}
              />
            </View>
          ) : null}

          <View style={styles.composerInputRow}>
            <IconButton
              mode="contained-tonal"
              icon="note-plus-outline"
              size={20}
              accessibilityLabel={t("chat.add_reference")}
              disabled={isStreaming}
              onPress={handleOpenReferencePicker}
              style={styles.addReferenceButton}
            />
            <TextInput
              mode="outlined"
              dense
              value={draft}
              onChangeText={setDraft}
              placeholder={t("chat.input_placeholder")}
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

      <ChatReferencePickerSheet
        visible={isReferencePickerVisible}
        notes={notes}
        categories={categories}
        activeReferences={activeReferences}
        selectedIds={activeReferences.map((reference) => reference.id)}
        isLoading={isNotesLoading}
        isLimitReached={isReferenceLimitReached}
        onRemoveReference={handleRemoveReference}
        onSelect={handleSelectReference}
        onDismiss={() => setIsReferencePickerVisible(false)}
      />
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
  messageAttachmentBar: {
    marginBottom: 8,
    maxWidth: "100%",
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  composerReferenceRow: {
    marginBottom: 8,
  },
  composerInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  addReferenceButton: {
    margin: 0,
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
